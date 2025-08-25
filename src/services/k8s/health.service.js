import {
  getK8sClient,
  getAppsV1ApiClient,
  getMetricsApi,
  isK8sAvailable,
} from "../../config/kubernetes.js";
import prisma from "../../utils/prisma.js";
import logger from "../../utils/logger.js";

/**
 * Check health status of all running service instances
 * @returns {Promise<Object>} Health check results
 */
const checkAllInstancesHealth = async () => {
  try {
    if (!isK8sAvailable()) {
      logger.warn("Kubernetes not available for health checks");
      return {
        success: false,
        error: "Kubernetes cluster not available",
        instancesChecked: 0,
        healthyInstances: 0,
        unhealthyInstances: 0,
      };
    }

    // Get all running instances
    const instances = await prisma.serviceInstance.findMany({
      where: {
        status: { in: ["RUNNING", "PROVISIONING"] },
      },
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

    logger.info(`Checking health for ${instances.length} service instances`);

    const healthResults = await Promise.allSettled(
      instances.map((instance) => checkInstanceHealth(instance))
    );

    let healthyCount = 0;
    let unhealthyCount = 0;
    const results = [];

    healthResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
        if (result.value.isHealthy) {
          healthyCount++;
        } else {
          unhealthyCount++;
        }
      } else {
        unhealthyCount++;
        results.push({
          instanceId: instances[index].id,
          isHealthy: false,
          error: result.reason?.message || "Health check failed",
        });
      }
    });

    // Update database with health check results
    await updateInstanceHealthStatus(results);

    return {
      success: true,
      instancesChecked: instances.length,
      healthyInstances: healthyCount,
      unhealthyInstances: unhealthyCount,
      results,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Health check failed:", error);
    throw error;
  }
};

/**
 * Check health status of a specific service instance
 * @param {Object} instance - Service instance object
 * @returns {Promise<Object>} Health check result
 */
const checkInstanceHealth = async (instance) => {
  try {
    const healthData = {
      instanceId: instance.id,
      instanceName: instance.name,
      namespace: instance.namespace,
      status: instance.status,
      isHealthy: false,
      healthStatus: "Unknown",
      lastChecked: new Date(),
      metrics: null,
      pods: [],
      deployment: null,
      errors: [],
    };

    // Skip health check for non-running instances
    if (instance.status !== "RUNNING") {
      healthData.healthStatus = `Instance status: ${instance.status}`;
      healthData.isHealthy = instance.status === "RUNNING";
      return healthData;
    }

    // Check deployment status
    const deploymentHealth = await checkDeploymentHealth(
      instance.deploymentName,
      instance.namespace
    );
    healthData.deployment = deploymentHealth;

    if (!deploymentHealth.isReady) {
      healthData.errors.push("Deployment not ready");
    }

    // Check pod status
    const podHealth = await checkPodHealth(
      instance.deploymentName,
      instance.namespace
    );
    healthData.pods = podHealth.pods;

    if (podHealth.unhealthyPods > 0) {
      healthData.errors.push(`${podHealth.unhealthyPods} unhealthy pods`);
    }

    // Get resource metrics
    try {
      const metrics = await getInstanceMetrics(
        instance.name,
        instance.namespace
      );
      healthData.metrics = metrics;
    } catch (error) {
      logger.warn(
        `Failed to get metrics for instance ${instance.id}:`,
        error.message
      );
      healthData.errors.push("Metrics unavailable");
    }

    // Determine overall health
    healthData.isHealthy =
      deploymentHealth.isReady &&
      podHealth.healthyPods > 0 &&
      podHealth.unhealthyPods === 0;

    healthData.healthStatus = healthData.isHealthy
      ? "Healthy"
      : `Unhealthy: ${healthData.errors.join(", ")}`;

    return healthData;
  } catch (error) {
    logger.error(`Health check failed for instance ${instance.id}:`, error);
    return {
      instanceId: instance.id,
      isHealthy: false,
      healthStatus: `Health check failed: ${error.message}`,
      lastChecked: new Date(),
      error: error.message,
    };
  }
};

/**
 * Check deployment health status
 * @param {string} deploymentName - Deployment name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deployment health status
 */
const checkDeploymentHealth = async (deploymentName, namespace) => {
  try {
    const appsV1Api = getAppsV1ApiClient();
    const response = await appsV1Api.readNamespacedDeployment({
      name: deploymentName,
      namespace: namespace,
    });
    const responseData = response.body || response;
    if (!responseData) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const deployment = responseData;

    const replicas = deployment.spec?.replicas || 1;
    const readyReplicas = deployment.status?.readyReplicas || 0;
    const availableReplicas = deployment.status?.availableReplicas || 0;
    const updatedReplicas = deployment.status?.updatedReplicas || 0;

    const isReady = readyReplicas >= replicas && availableReplicas >= replicas;

    return {
      name: deploymentName,
      namespace,
      replicas,
      readyReplicas,
      availableReplicas,
      updatedReplicas,
      isReady,
      conditions: deployment.status?.conditions || [],
      creationTimestamp: deployment.metadata?.creationTimestamp,
    };
  } catch (error) {
    logger.error(`Failed to check deployment ${deploymentName}:`, error);
    return {
      name: deploymentName,
      namespace,
      isReady: false,
      error: error.message,
    };
  }
};

/**
 * Check pod health status
 * @param {string} deploymentName - Deployment name (used as label selector)
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Pod health status
 */
const checkPodHealth = async (deploymentName, namespace) => {
  try {
    const k8sApi = getK8sClient();
    const response = await k8sApi.listNamespacedPod({
      namespace: namespace,
      labelSelector: `app=${deploymentName}`,
    });

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const pods = responseData.items.map((pod) => {
      const containerStatuses = pod.status?.containerStatuses || [];
      const isReady = containerStatuses.every((cs) => cs.ready);
      const restarts = containerStatuses.reduce(
        (acc, cs) => acc + cs.restartCount,
        0
      );

      return {
        name: pod.metadata.name,
        phase: pod.status?.phase,
        isReady,
        restarts,
        startTime: pod.status?.startTime,
        containerStatuses: containerStatuses.map((cs) => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          state: cs.state,
        })),
      };
    });

    const healthyPods = pods.filter(
      (pod) => pod.isReady && pod.phase === "Running"
    ).length;
    const unhealthyPods = pods.length - healthyPods;

    return {
      totalPods: pods.length,
      healthyPods,
      unhealthyPods,
      pods,
    };
  } catch (error) {
    logger.error(
      `Failed to check pods for deployment ${deploymentName}:`,
      error
    );
    return {
      totalPods: 0,
      healthyPods: 0,
      unhealthyPods: 0,
      pods: [],
      error: error.message,
    };
  }
};

/**
 * Get resource metrics for instance
 * @param {string} instanceName - Instance name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Resource metrics
 */
const getInstanceMetrics = async (instanceName, namespace) => {
  try {
    const metricsApi = getMetricsApi();
    if (!metricsApi) {
      return null;
    }

    const metrics = await metricsApi.getPodMetrics(namespace);
    const podMetrics = metrics.items.filter((item) =>
      item.metadata.name.startsWith(instanceName)
    );

    if (podMetrics.length === 0) {
      return null;
    }

    // Aggregate metrics from all pods
    let totalCpuNanocores = 0;
    let totalMemoryBytes = 0;
    let containerCount = 0;

    podMetrics.forEach((podMetric) => {
      podMetric.containers.forEach((container) => {
        const cpuRaw = container.usage.cpu;
        const memoryRaw = container.usage.memory;

        totalCpuNanocores += parseInt(cpuRaw.replace("n", ""));
        totalMemoryBytes += parseInt(memoryRaw.replace("Ki", "")) * 1024;
        containerCount++;
      });
    });

    return {
      timestamp: podMetrics[0].timestamp,
      window: podMetrics[0].window,
      totalPods: podMetrics.length,
      totalContainers: containerCount,
      cpu: {
        nanocores: totalCpuNanocores,
        millicores: Math.round(totalCpuNanocores / 1000000),
        cores: parseFloat((totalCpuNanocores / 1000000000).toFixed(3)),
      },
      memory: {
        bytes: totalMemoryBytes,
        megabytes: parseFloat((totalMemoryBytes / 1024 / 1024).toFixed(2)),
        gigabytes: parseFloat(
          (totalMemoryBytes / 1024 / 1024 / 1024).toFixed(3)
        ),
      },
    };
  } catch (error) {
    logger.warn(
      `Failed to get metrics for instance ${instanceName}:`,
      error.message
    );
    return null;
  }
};

/**
 * Update instance health status in database
 * @param {Array} healthResults - Array of health check results
 * @returns {Promise<void>}
 */
const updateInstanceHealthStatus = async (healthResults) => {
  try {
    const updatePromises = healthResults.map((result) => {
      const updateData = {
        healthStatus: result.healthStatus,
        lastHealthCheck: result.lastChecked,
      };

      // Update resource usage if metrics are available
      if (result.metrics) {
        updateData.cpuUsage = result.metrics.cpu.millicores;
        updateData.memoryUsage = result.metrics.memory.megabytes;
      }

      // Update status if instance is unhealthy
      if (!result.isHealthy && result.instanceId) {
        // Only update status if it's currently RUNNING but unhealthy
        return prisma.serviceInstance.updateMany({
          where: {
            id: result.instanceId,
            status: "RUNNING",
          },
          data: updateData,
        });
      }

      // Update healthy instances
      if (result.instanceId) {
        return prisma.serviceInstance.update({
          where: { id: result.instanceId },
          data: updateData,
        });
      }

      return Promise.resolve();
    });

    await Promise.allSettled(updatePromises);
    logger.info(`Updated health status for ${healthResults.length} instances`);
  } catch (error) {
    logger.error("Failed to update instance health status:", error);
  }
};

/**
 * Get health summary for all instances
 * @returns {Promise<Object>} Health summary
 */
const getHealthSummary = async () => {
  try {
    const summary = await prisma.serviceInstance.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
      where: {
        status: { not: "TERMINATED" },
      },
    });

    const totalInstances = summary.reduce(
      (acc, item) => acc + item._count.id,
      0
    );

    const statusCounts = summary.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    // Get recent health check data
    const recentHealthChecks = await prisma.serviceInstance.findMany({
      where: {
        status: { not: "TERMINATED" },
        lastHealthCheck: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
      select: {
        id: true,
        healthStatus: true,
        lastHealthCheck: true,
      },
    });

    const healthyCount = recentHealthChecks.filter(
      (instance) => instance.healthStatus === "Healthy"
    ).length;

    return {
      totalInstances,
      statusCounts,
      recentHealthChecks: recentHealthChecks.length,
      healthyInstances: healthyCount,
      unhealthyInstances: recentHealthChecks.length - healthyCount,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Failed to get health summary:", error);
    throw error;
  }
};

/**
 * Start periodic health monitoring
 * @param {number} intervalMs - Check interval in milliseconds (default: 5 minutes)
 * @returns {NodeJS.Timeout} Interval timer
 */
const startHealthMonitoring = (intervalMs = 5 * 60 * 1000) => {
  logger.info(`Starting health monitoring with ${intervalMs}ms interval`);

  // Run initial health check
  setImmediate(() => {
    checkAllInstancesHealth()
      .then((result) => {
        logger.info("Initial health check completed:", {
          instancesChecked: result.instancesChecked,
          healthy: result.healthyInstances,
          unhealthy: result.unhealthyInstances,
        });
      })
      .catch((error) => {
        logger.error("Initial health check failed:", error);
      });
  });

  // Schedule periodic health checks
  return setInterval(() => {
    checkAllInstancesHealth()
      .then((result) => {
        logger.info("Periodic health check completed:", {
          instancesChecked: result.instancesChecked,
          healthy: result.healthyInstances,
          unhealthy: result.unhealthyInstances,
        });
      })
      .catch((error) => {
        logger.error("Periodic health check failed:", error);
      });
  }, intervalMs);
};

export default {
  checkAllInstancesHealth,
  checkInstanceHealth,
  getHealthSummary,
  startHealthMonitoring,
};
