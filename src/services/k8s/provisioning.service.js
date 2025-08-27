import prisma from "../../utils/prisma.js";
import k8sTemplates from "../../config/k8s-templates.js";
import k8sHelper from "../../utils/k8s-helper.js";
import { isK8sAvailable } from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

/**
 * Provision a new service instance from subscription
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Provisioning result
 */
const provisionServiceInstance = async (subscriptionId) => {
  return await prisma.$transaction(async (tx) => {
    try {
      // Get subscription with all related data
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              dockerImage: true,
              defaultPort: true,
              envTemplate: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              planType: true,
              cpuMilli: true,
              memoryMb: true,
              storageGb: true,
              features: true,
            },
          },
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (subscription.status !== "ACTIVE") {
        throw new Error(
          "Can only provision instances for active subscriptions"
        );
      }

      // Check if Kubernetes is available
      if (!isK8sAvailable()) {
        throw new Error("Kubernetes cluster not available");
      }

      // Generate instance configuration
      const instanceConfig = generateInstanceConfig(subscription);

      // Create service instance record
      const instance = await tx.serviceInstance.create({
        data: {
          subscriptionId,
          name: instanceConfig.name,
          subdomain: instanceConfig.subdomain,
          namespace: instanceConfig.namespace,
          podName: instanceConfig.podName,
          serviceName: instanceConfig.serviceName,
          ingressName: instanceConfig.ingressName,
          deploymentName: instanceConfig.deploymentName,
          status: "PENDING",
          envVars: instanceConfig.envVars,
          sslEnabled: true, // Enable SSL by default
          publicUrl: instanceConfig.publicUrl,
          adminUrl: instanceConfig.adminUrl,
        },
      });

      logger.info(`Created service instance record: ${instance.id}`);

      // Start asynchronous provisioning process
      setImmediate(() => {
        provisionKubernetesResources(
          instance.id,
          subscription,
          instanceConfig
        ).catch((error) => {
          logger.error(
            `Provisioning failed for instance ${instance.id}:`,
            error
          );
          // Update instance status to ERROR
          prisma.serviceInstance
            .update({
              where: { id: instance.id },
              data: {
                status: "ERROR",
                healthStatus: `Provisioning failed: ${error.message}`,
              },
            })
            .catch((updateError) => {
              logger.error(`Failed to update instance status:`, updateError);
            });
        });
      });

      return {
        instance,
        message: "Service provisioning started",
        estimatedTime: "2-5 minutes",
        nextSteps: [
          "Kubernetes resources are being created",
          "You will be notified when the service is ready",
          "Check instance status for updates",
        ],
      };
    } catch (error) {
      logger.error("Service provisioning failed:", error);
      throw error;
    }
  });
};

/**
 * Provision Kubernetes resources for service instance
 * @param {string} instanceId - Service instance ID
 * @param {Object} subscription - Subscription data
 * @param {Object} instanceConfig - Instance configuration
 * @returns {Promise<void>}
 */
const provisionKubernetesResources = async (
  instanceId,
  subscription,
  instanceConfig
) => {
  try {
    logger.info(`Starting Kubernetes provisioning for instance: ${instanceId}`);

    // Update status to PROVISIONING
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: { status: "PROVISIONING" },
    });

    const { service, plan, user } = subscription;

    // Create instance object for templates
    const instance = {
      id: instanceId,
      ...instanceConfig,
      subscription: {
        userId: user.id,
      },
    };

    // Validate template parameters
    const validation = k8sTemplates.validateTemplateParams(
      service,
      plan,
      instance
    );
    if (!validation.isValid) {
      throw new Error(
        `Template validation failed: ${validation.errors.join(", ")}`
      );
    }

    // Step 1: Create or ensure namespace exists
    logger.info(`Creating namespace: ${instance.namespace}`);
    const namespaceManifest = k8sTemplates.generateNamespaceTemplate(user.id);
    await k8sHelper.applyManifest(namespaceManifest);

    // Step 2: Create ConfigMap
    logger.info(`Creating ConfigMap: ${instance.name}-config`);
    const configMapManifest = k8sTemplates.generateConfigMapTemplate(
      service,
      instance
    );
    await k8sHelper.applyManifest(configMapManifest);

    // Step 3: Create PVC if storage is required
    if (plan.storageGb > 0) {
      logger.info(`Creating PVC: ${instance.name}-pvc`);
      const pvcManifest = k8sTemplates.generatePVCTemplate(plan, instance);
      if (pvcManifest) {
        await k8sHelper.applyManifest(pvcManifest);
      }
    }

    // Step 4: Create Deployment
    logger.info(`Creating Deployment: ${instance.deploymentName}`);
    const deploymentManifest = k8sTemplates.generateDeploymentTemplate(
      service,
      plan,
      instance
    );
    await k8sHelper.applyManifest(deploymentManifest);

    // Step 5: Create Service
    logger.info(`Creating Service: ${instance.serviceName}`);
    const serviceManifest = k8sTemplates.generateServiceTemplate(
      service,
      instance
    );
    await k8sHelper.applyManifest(serviceManifest);

    // Step 6: Create Ingress
    logger.info(`Creating Ingress: ${instance.ingressName}`);
    const ingressManifest = k8sTemplates.generateIngressTemplate(
      service,
      instance
    );
    await k8sHelper.applyManifest(ingressManifest);

    // Step 7: Wait for deployment to be ready
    logger.info(
      `Waiting for deployment to be ready: ${instance.deploymentName}`
    );
    const readyResult = await k8sHelper.waitForDeploymentReady(
      instance.deploymentName,
      instance.namespace,
      300000 // 5 minutes timeout
    );

    if (!readyResult.ready) {
      throw new Error("Deployment failed to become ready within timeout");
    }

    // Step 8: Get the actual pod name created by Kubernetes
    logger.info(
      `Getting pod information for deployment: ${instance.deploymentName}`
    );
    const pods = await k8sHelper.getPodsForDeployment(
      instance.deploymentName,
      instance.namespace
    );

    let podName = null;
    if (pods && pods.length > 0) {
      // Get the first running pod name
      const runningPod =
        pods.find((pod) => pod.status === "Running") || pods[0];
      podName = runningPod.name;
      logger.info(`Found pod name: ${podName} for instance: ${instanceId}`);
    } else {
      logger.warn(`No pods found for deployment: ${instance.deploymentName}`);
    }

    // Step 9: Update instance status to RUNNING with actual pod name
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: {
        status: "RUNNING",
        healthStatus: "Healthy",
        podName: podName,
        lastStarted: new Date(),
        lastHealthCheck: new Date(),
      },
    });

    logger.info(`Successfully provisioned service instance: ${instanceId}`);
  } catch (error) {
    logger.error(
      `Kubernetes provisioning failed for instance ${instanceId}:`,
      error
    );

    // Update instance status to ERROR
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: {
        status: "ERROR",
        healthStatus: `Provisioning failed: ${error.message}`,
      },
    });

    // Attempt cleanup of partially created resources
    try {
      await cleanupFailedProvisioning(instanceId, instanceConfig);
    } catch (cleanupError) {
      logger.error(`Cleanup failed for instance ${instanceId}:`, cleanupError);
    }

    throw error;
  }
};

/**
 * Terminate service instance and cleanup Kubernetes resources
 * @param {string} instanceId - Service instance ID
 * @returns {Promise<Object>} Termination result
 */
const terminateServiceInstance = async (instanceId) => {
  return await prisma.$transaction(async (tx) => {
    try {
      // Get instance details
      const instance = await tx.serviceInstance.findUnique({
        where: { id: instanceId },
        include: {
          subscription: {
            include: {
              user: { select: { id: true } },
              plan: { select: { id: true } },
            },
          },
        },
      });

      if (!instance) {
        throw new Error("Service instance not found");
      }

      if (instance.status === "TERMINATED") {
        return {
          instance,
          message: "Service instance already terminated",
          resourcesDeleted: 0,
        };
      }

      // Update status to indicate termination in progress
      await tx.serviceInstance.update({
        where: { id: instanceId },
        data: {
          status: "TERMINATED",
          lastStopped: new Date(),
          healthStatus: "Terminated",
        },
      });

      // Cleanup Kubernetes resources if K8s is available
      let resourcesDeleted = 0;
      if (isK8sAvailable()) {
        resourcesDeleted = await cleanupKubernetesResources(instance);
      }

      logger.info(`Terminated service instance: ${instanceId}`);

      return {
        instance,
        message: "Service instance terminated successfully",
        resourcesDeleted,
        nextSteps: [
          "All Kubernetes resources have been cleaned up",
          "Instance data has been preserved for audit purposes",
        ],
      };
    } catch (error) {
      logger.error("Service termination failed:", error);
      throw error;
    }
  });
};

/**
 * Update service instance resources (for upgrades)
 * @param {string} instanceId - Service instance ID
 * @param {Object} newPlan - New service plan
 * @returns {Promise<Object>} Update result
 */
const updateServiceInstance = async (instanceId, newPlan) => {
  try {
    // Get instance details
    const instance = await prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      include: {
        subscription: {
          include: {
            service: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!instance) {
      throw new Error("Service instance not found");
    }

    if (instance.status !== "RUNNING") {
      throw new Error("Can only update running instances");
    }

    if (!isK8sAvailable()) {
      throw new Error("Kubernetes cluster not available");
    }

    logger.info(`Updating service instance: ${instanceId}`);

    // Update deployment with new resource limits
    const { service, user } = instance.subscription;
    const instanceConfig = {
      ...instance,
      subscription: { userId: user.id },
    };

    const deploymentManifest = k8sTemplates.generateDeploymentTemplate(
      service,
      newPlan,
      instanceConfig
    );

    await k8sHelper.applyManifest(deploymentManifest);

    // Wait for deployment to be ready with new configuration
    const readyResult = await k8sHelper.waitForDeploymentReady(
      instance.deploymentName,
      instance.namespace,
      180000 // 3 minutes timeout for updates
    );

    if (!readyResult.ready) {
      throw new Error(
        "Deployment update failed to become ready within timeout"
      );
    }

    // Get the new pod name after rolling update
    // Wait a moment for the new pod to be created and become running
    logger.info(
      `Getting updated pod information for deployment: ${instance.deploymentName}`
    );

    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay for new pod

    const updatedPods = await k8sHelper.getPodsForDeployment(
      instance.deploymentName,
      instance.namespace
    );

    let newPodName = instance.podName; // Keep existing if no pods found
    if (updatedPods && updatedPods.length > 0) {
      // Sort pods by creation time (newest first) - ignore status
      const sortedPods = updatedPods.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Always select the newest pod regardless of status
      const selectedPod = sortedPods[0];
      newPodName = selectedPod.name;

      logger.info(
        `Pod selection: Found ${updatedPods.length} pods. Selected newest: ${newPodName} (status: ${selectedPod.status}, created: ${selectedPod.createdAt})`
      );
      if (newPodName !== instance.podName) {
        logger.info(
          `Updated pod name from '${instance.podName}' to '${newPodName}' for instance: ${instanceId}`
        );
      } else {
        logger.debug(
          `Pod name unchanged for instance ${instanceId}: ${newPodName}`
        );
      }
    } else {
      logger.warn(
        `No pods found for deployment after update: ${instance.deploymentName}. Keeping existing pod name: ${instance.podName}`
      );
    }

    // Update instance record with new pod name
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: {
        podName: newPodName,
        lastHealthCheck: new Date(),
        healthStatus: "Healthy - Updated",
      },
    });

    logger.info(`Successfully updated service instance: ${instanceId}`);

    return {
      instance,
      message: "Service instance updated successfully",
      newResources: {
        cpu: `${newPlan.cpuMilli}m`,
        memory: `${newPlan.memoryMb}Mi`,
        storage: `${newPlan.storageGb}Gi`,
      },
    };
  } catch (error) {
    logger.error("Service instance update failed:", error);
    throw error;
  }
};

/**
 * Get service instance status and health
 * @param {string} instanceId - Service instance ID
 * @returns {Promise<Object>} Instance status
 */
const getInstanceStatus = async (instanceId) => {
  try {
    const instance = await prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      include: {
        subscription: {
          include: {
            service: { select: { name: true, slug: true } },
            plan: { select: { name: true, planType: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!instance) {
      throw new Error("Service instance not found");
    }

    let kubernetesStatus = null;
    if (isK8sAvailable() && instance.status === "RUNNING") {
      try {
        // Get pod status
        const pods = await k8sHelper.getPodsForDeployment(
          instance.deploymentName,
          instance.namespace
        );

        kubernetesStatus = {
          pods,
          namespace: instance.namespace,
          deployment: instance.deploymentName,
          service: instance.serviceName,
          ingress: instance.ingressName,
        };
      } catch (error) {
        logger.warn(
          `Failed to get Kubernetes status for instance ${instanceId}:`,
          error
        );
      }
    }

    return {
      instance,
      kubernetesStatus,
      urls: {
        public: instance.publicUrl,
        admin: instance.adminUrl,
        custom: instance.customDomain,
      },
      ssl: {
        enabled: instance.sslEnabled,
        status: instance.sslEnabled ? "Active" : "Disabled",
      },
    };
  } catch (error) {
    logger.error("Failed to get instance status:", error);
    throw error;
  }
};

/**
 * Generate instance configuration
 * @param {Object} subscription - Subscription data
 * @returns {Object} Instance configuration
 */
const generateInstanceConfig = (subscription) => {
  const { service, user } = subscription;
  const timestamp = Date.now().toString(36);
  const userSuffix = user.id.slice(-6);

  // Generate unique names
  const baseName = k8sHelper.sanitizeK8sName(
    `${service.slug}-${userSuffix}-${timestamp}`
  );
  const namespace = `user-${user.id}`;
  const subdomain = k8sHelper.generateSubdomain(service.name, user.id);

  // Generate service-specific environment variables
  const serviceSpecific = k8sTemplates.generateServiceSpecificTemplate(
    service.slug,
    service,
    subscription.plan,
    { subdomain, sslEnabled: true }
  );

  return {
    name: baseName,
    namespace,
    subdomain,
    deploymentName: baseName,
    serviceName: `${baseName}-svc`,
    ingressName: `${baseName}-ingress`,
    podName: null, // Will be set by Kubernetes
    envVars: {
      ...service.envTemplate,
      ...serviceSpecific.envVars,
      INSTANCE_NAME: baseName,
      SUBDOMAIN: subdomain,
    },
    publicUrl: `https://${subdomain}`,
    adminUrl: `https://${subdomain}/admin`,
  };
};

/**
 * Cleanup Kubernetes resources for instance
 * @param {Object} instance - Service instance
 * @returns {Promise<number>} Number of resources deleted
 */
const cleanupKubernetesResources = async (instance) => {
  let deletedCount = 0;
  const resources = [
    { kind: "Ingress", name: instance.ingressName },
    { kind: "Service", name: instance.serviceName },
    { kind: "Deployment", name: instance.deploymentName },
    { kind: "PersistentVolumeClaim", name: `${instance.name}-pvc` },
    { kind: "ConfigMap", name: `${instance.name}-config` },
  ];

  for (const resource of resources) {
    try {
      const result = await k8sHelper.deleteResource(
        resource.kind,
        resource.name,
        instance.namespace
      );
      if (result.deleted) {
        deletedCount++;
      }
    } catch (error) {
      logger.warn(
        `Failed to delete ${resource.kind} ${resource.name}:`,
        error.message
      );
    }
  }

  return deletedCount;
};

/**
 * Cleanup failed provisioning attempt
 * @param {string} instanceId - Service instance ID
 * @param {Object} instanceConfig - Instance configuration
 * @returns {Promise<void>}
 */
const cleanupFailedProvisioning = async (instanceId, instanceConfig) => {
  logger.info(`Cleaning up failed provisioning for instance: ${instanceId}`);

  const instance = {
    name: instanceConfig.name,
    namespace: instanceConfig.namespace,
    deploymentName: instanceConfig.deploymentName,
    serviceName: instanceConfig.serviceName,
    ingressName: instanceConfig.ingressName,
  };

  await cleanupKubernetesResources(instance);
};

/**
 * List all service instances for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Service instances
 */
const getUserInstances = async (userId, options = {}) => {
  const { status = null, includeTerminated = false } = options;

  const whereClause = {
    subscription: { userId },
    ...(status && { status }),
    ...(!includeTerminated && { status: { not: "TERMINATED" } }),
  };

  return await prisma.serviceInstance.findMany({
    where: whereClause,
    include: {
      subscription: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              planType: true,
              cpuMilli: true,
              memoryMb: true,
              storageGb: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Refresh pod name for service instance (maintenance function)
 * @param {string} instanceId - Service instance ID
 * @returns {Promise<Object>} Refresh result
 */
const refreshInstancePodName = async (instanceId) => {
  try {
    const instance = await prisma.serviceInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new Error("Service instance not found");
    }

    if (instance.status !== "RUNNING") {
      throw new Error("Can only refresh pod names for running instances");
    }

    if (!isK8sAvailable()) {
      throw new Error("Kubernetes cluster not available");
    }

    logger.info(`Refreshing pod name for instance: ${instanceId}`);

    // Get current pods for the deployment
    const pods = await k8sHelper.getPodsForDeployment(
      instance.deploymentName,
      instance.namespace
    );

    let newPodName = instance.podName; // Keep existing if no pods found
    if (pods && pods.length > 0) {
      // Sort pods by creation time (newest first) - ignore status
      const sortedPods = pods.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Always select the newest pod regardless of status
      const selectedPod = sortedPods[0];
      newPodName = selectedPod.name;

      logger.info(
        `Pod refresh selection: Found ${pods.length} pods. Selected newest: ${newPodName} (created: ${selectedPod.createdAt})`
      );

      if (newPodName !== instance.podName) {
        logger.info(
          `Refreshed pod name from '${instance.podName}' to '${newPodName}' for instance: ${instanceId}`
        );

        // Update database with new pod name
        await prisma.serviceInstance.update({
          where: { id: instanceId },
          data: {
            podName: newPodName,
            lastHealthCheck: new Date(),
          },
        });
      } else {
        logger.info(`Pod name unchanged for instance: ${instanceId}`);
      }
    } else {
      logger.warn(
        `No pods found for deployment: ${instance.deploymentName}. Keeping existing pod name: ${instance.podName}`
      );
    }

    return {
      instanceId,
      oldPodName: instance.podName,
      newPodName,
      updated: newPodName !== instance.podName,
      message:
        newPodName !== instance.podName
          ? "Pod name refreshed successfully"
          : "Pod name already up to date",
    };
  } catch (error) {
    logger.error("Pod name refresh failed:", error);
    throw error;
  }
};

/**
 * Restart service instance using Kubernetes rolling restart
 * @param {string} instanceId - Service instance ID
 * @returns {Promise<Object>} Restart result
 */
const restartServiceInstance = async (instanceId) => {
  try {
    // Get instance details
    const instance = await prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      include: {
        subscription: {
          include: {
            service: { select: { name: true, slug: true } },
            plan: { select: { name: true, planType: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!instance) {
      throw new Error("Service instance not found");
    }

    if (instance.status !== "RUNNING") {
      throw new Error("Can only restart running instances");
    }

    if (!isK8sAvailable()) {
      throw new Error("Kubernetes cluster not available");
    }

    logger.info(`Restarting service instance: ${instanceId}`);

    // Update status to indicate restart in progress
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: {
        healthStatus: "Restarting...",
        lastHealthCheck: new Date(),
      },
    });

    // Perform Kubernetes rolling restart
    const restartResult = await performKubernetesRollingRestart(instance);

    // Update instance with new pod information
    await prisma.serviceInstance.update({
      where: { id: instanceId },
      data: {
        podName: restartResult.newPodName,
        healthStatus: "Healthy - Restarted",
        lastStarted: new Date(),
        lastHealthCheck: new Date(),
      },
    });

    logger.info(`Successfully restarted service instance: ${instanceId}`);

    return {
      instance: {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        service: instance.subscription.service,
        plan: instance.subscription.plan,
      },
      restart: {
        oldPodName: restartResult.oldPodName,
        newPodName: restartResult.newPodName,
        restartTime: new Date().toISOString(),
        method: "Rolling Restart",
      },
      message: "Service instance restarted successfully",
      estimatedDowntime: restartResult.downtime,
      nextSteps: [
        "New pod is being created with fresh state",
        "Old pod will be terminated gracefully",
        "Service should be available shortly",
        "Check instance status for updates",
      ],
    };
  } catch (error) {
    logger.error("Service instance restart failed:", error);

    // Update instance status to indicate restart failed
    try {
      await prisma.serviceInstance.update({
        where: { id: instanceId },
        data: {
          healthStatus: `Restart failed: ${error.message}`,
          lastHealthCheck: new Date(),
        },
      });
    } catch (updateError) {
      logger.error(
        "Failed to update instance status after restart failure:",
        updateError
      );
    }

    throw error;
  }
};

/**
 * Perform Kubernetes rolling restart for deployment
 * @param {Object} instance - Service instance
 * @returns {Promise<Object>} Restart result
 */
const performKubernetesRollingRestart = async (instance) => {
  try {
    logger.info(
      `Performing rolling restart for deployment: ${instance.deploymentName}`
    );

    // Get current pod name before restart
    const currentPods = await k8sHelper.getPodsForDeployment(
      instance.deploymentName,
      instance.namespace
    );

    let oldPodName = instance.podName;
    if (currentPods && currentPods.length > 0) {
      const runningPod =
        currentPods.find((pod) => pod.status === "Running") || currentPods[0];
      oldPodName = runningPod.name;
    }

    // Alternative approach: Update deployment template to trigger rolling restart
    logger.info(
      `Triggering rolling restart by updating deployment: ${instance.deploymentName}`
    );

    // Get current deployment to preserve all settings
    const { getAppsV1ApiClient } = await import("../../config/kubernetes.js");
    const appsV1Api = getAppsV1ApiClient();

    const deploymentResponse = await appsV1Api.readNamespacedDeployment({
      name: instance.deploymentName,
      namespace: instance.namespace,
    });

    const deployment = deploymentResponse.body || deploymentResponse;

    // Add restart annotation to pod template to trigger rolling update
    const currentTime = new Date().toISOString();
    const updatedDeployment = {
      ...deployment,
      spec: {
        ...deployment.spec,
        template: {
          ...deployment.spec.template,
          metadata: {
            ...deployment.spec.template.metadata,
            annotations: {
              ...deployment.spec.template.metadata.annotations,
              "kubectl.kubernetes.io/restartedAt": currentTime,
            },
          },
        },
      },
    };

    logger.info(`Updating deployment with restart annotation: ${currentTime}`);
    await appsV1Api.replaceNamespacedDeployment({
      name: instance.deploymentName,
      namespace: instance.namespace,
      body: updatedDeployment,
    });

    // Wait for rolling restart to complete
    logger.info(
      `Waiting for rolling restart to complete: ${instance.deploymentName}`
    );
    const readyResult = await k8sHelper.waitForDeploymentReady(
      instance.deploymentName,
      instance.namespace,
      120000 // 2 minutes timeout for restart
    );

    if (!readyResult.ready) {
      throw new Error("Rolling restart failed to complete within timeout");
    }

    // Get new pod name after restart
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay for new pod

    const newPods = await k8sHelper.getPodsForDeployment(
      instance.deploymentName,
      instance.namespace
    );

    let newPodName = oldPodName; // Fallback to old name if no pods found
    if (newPods && newPods.length > 0) {
      // Sort pods by creation time (newest first)
      const sortedPods = newPods.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Select the newest pod (should be the restarted one)
      const newestPod = sortedPods[0];
      newPodName = newestPod.name;

      logger.info(
        `Rolling restart completed. Old pod: ${oldPodName}, New pod: ${newPodName}`
      );
    } else {
      logger.warn(
        `No pods found after restart for deployment: ${instance.deploymentName}`
      );
    }

    return {
      oldPodName,
      newPodName,
      downtime: "< 30 seconds", // Typical rolling restart downtime
      success: true,
    };
  } catch (error) {
    logger.error(
      `Rolling restart failed for deployment ${instance.deploymentName}:`,
      error
    );
    throw error;
  }
};

export default {
  provisionServiceInstance,
  terminateServiceInstance,
  updateServiceInstance,
  getInstanceStatus,
  getUserInstances,
  refreshInstancePodName,
  restartServiceInstance,
};
