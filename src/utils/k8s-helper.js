import {
  getK8sClient,
  getAppsV1ApiClient,
  getNetworkingV1ApiClient,
  isK8sAvailable,
} from "../config/kubernetes.js";
import logger from "./logger.js";

/**
 * Apply Kubernetes manifest to cluster
 * @param {Object} manifest - Kubernetes manifest object
 * @returns {Promise<Object>} Applied resource
 */
const applyManifest = async (manifest) => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not available");
    }

    const { kind, metadata } = manifest;
    const namespace = metadata.namespace || "default";

    logger.info(
      `Applying ${kind} manifest: ${metadata.name} in namespace: ${namespace}`
    );

    switch (kind) {
      case "Namespace":
        return await applyNamespace(manifest);
      case "ConfigMap":
        return await applyConfigMap(manifest);
      case "PersistentVolumeClaim":
        return await applyPVC(manifest);
      case "Deployment":
        return await applyDeployment(manifest);
      case "Service":
        return await applyService(manifest);
      case "Ingress":
        return await applyIngress(manifest);
      default:
        throw new Error(`Unsupported manifest kind: ${kind}`);
    }
  } catch (error) {
    logger.error(`Failed to apply ${manifest.kind} manifest:`, error);
    throw error;
  }
};

/**
 * Apply Namespace manifest
 * @param {Object} manifest - Namespace manifest
 * @returns {Promise<Object>} Applied namespace
 */
const applyNamespace = async (manifest) => {
  const k8sApi = getK8sClient();

  try {
    // Check if namespace exists
    logger.info(`Checking if namespace exists: ${manifest.metadata.name}`);

    await k8sApi.readNamespace({ name: manifest.metadata.name });
    logger.info(`Namespace ${manifest.metadata.name} already exists`);
    return { created: false, name: manifest.metadata.name };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }

    logger.info(
      `Read namespace error - statusCode: ${error.response?.statusCode}, body.code: ${error.body?.code}, parsedCode: ${errorCode}, checking if 404...`
    );

    if (errorCode === 404) {
      // Namespace doesn't exist, create it
      try {
        logger.info(
          `Creating namespace with manifest:`,
          JSON.stringify(manifest, null, 2)
        );
        const response = await k8sApi.createNamespace({ body: manifest });
        logger.info(
          `Successfully created namespace: ${manifest.metadata.name}`
        );
        return { created: true, resource: response.body };
      } catch (createError) {
        logger.error(`Failed to create namespace ${manifest.metadata.name}:`, {
          message: createError.message,
          statusCode: createError.response?.statusCode,
          body: createError.response?.body,
          manifest: manifest,
        });
        throw createError;
      }
    }
    logger.error(`Failed to read namespace ${manifest.metadata.name}:`, {
      message: error.message,
      statusCode: error.response?.statusCode,
      body: error.response?.body,
    });
    throw error;
  }
};

/**
 * Apply ConfigMap manifest
 * @param {Object} manifest - ConfigMap manifest
 * @returns {Promise<Object>} Applied ConfigMap
 */
const applyConfigMap = async (manifest) => {
  const k8sApi = getK8sClient();
  const { name, namespace } = manifest.metadata;

  try {
    // Try to update existing ConfigMap
    const response = await k8sApi.replaceNamespacedConfigMap({
      name: name,
      namespace: namespace,
      body: manifest,
    });
    logger.info(`Updated ConfigMap: ${name} in namespace: ${namespace}`);
    return { updated: true, resource: response.body };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (errorCode === 404) {
      // ConfigMap doesn't exist, create it
      const response = await k8sApi.createNamespacedConfigMap({
        namespace: namespace,
        body: manifest,
      });
      logger.info(`Created ConfigMap: ${name} in namespace: ${namespace}`);
      return { created: true, resource: response.body };
    }
    throw error;
  }
};

/**
 * Apply PersistentVolumeClaim manifest
 * @param {Object} manifest - PVC manifest
 * @returns {Promise<Object>} Applied PVC
 */
const applyPVC = async (manifest) => {
  const k8sApi = getK8sClient();
  const { name, namespace } = manifest.metadata;

  try {
    // Check if PVC exists
    await k8sApi.readNamespacedPersistentVolumeClaim({
      name: name,
      namespace: namespace,
    });
    logger.info(`PVC ${name} already exists in namespace: ${namespace}`);
    return { exists: true, name };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (errorCode === 404) {
      // PVC doesn't exist, create it
      const response = await k8sApi.createNamespacedPersistentVolumeClaim({
        namespace: namespace,
        body: manifest,
      });
      logger.info(`Created PVC: ${name} in namespace: ${namespace}`);
      return { created: true, resource: response.body };
    }
    throw error;
  }
};

/**
 * Apply Deployment manifest
 * @param {Object} manifest - Deployment manifest
 * @returns {Promise<Object>} Applied Deployment
 */
const applyDeployment = async (manifest) => {
  const appsV1Api = getAppsV1ApiClient();
  const { name, namespace } = manifest.metadata;

  try {
    // Try to update existing Deployment
    const response = await appsV1Api.replaceNamespacedDeployment({
      name: name,
      namespace: namespace,
      body: manifest,
    });
    logger.info(`Updated Deployment: ${name} in namespace: ${namespace}`);
    return { updated: true, resource: response.body };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (errorCode === 404) {
      // Deployment doesn't exist, create it
      const response = await appsV1Api.createNamespacedDeployment({
        namespace: namespace,
        body: manifest,
      });
      logger.info(`Created Deployment: ${name} in namespace: ${namespace}`);
      return { created: true, resource: response.body };
    }
    throw error;
  }
};

/**
 * Apply Service manifest
 * @param {Object} manifest - Service manifest
 * @returns {Promise<Object>} Applied Service
 */
const applyService = async (manifest) => {
  const k8sApi = getK8sClient();
  const { name, namespace } = manifest.metadata;

  try {
    // Try to update existing Service
    const response = await k8sApi.replaceNamespacedService({
      name: name,
      namespace: namespace,
      body: manifest,
    });
    logger.info(`Updated Service: ${name} in namespace: ${namespace}`);
    return { updated: true, resource: response.body };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (errorCode === 404) {
      // Service doesn't exist, create it
      const response = await k8sApi.createNamespacedService({
        namespace: namespace,
        body: manifest,
      });
      logger.info(`Created Service: ${name} in namespace: ${namespace}`);
      return { created: true, resource: response.body };
    }
    throw error;
  }
};

/**
 * Apply Ingress manifest
 * @param {Object} manifest - Ingress manifest
 * @returns {Promise<Object>} Applied Ingress
 */
const applyIngress = async (manifest) => {
  const networkingV1Api = getNetworkingV1ApiClient();
  const { name, namespace } = manifest.metadata;

  try {
    // Try to update existing Ingress
    const response = await networkingV1Api.replaceNamespacedIngress({
      name: name,
      namespace: namespace,
      body: manifest,
    });
    logger.info(`Updated Ingress: ${name} in namespace: ${namespace}`);
    return { updated: true, resource: response.body };
  } catch (error) {
    let errorCode = error.response?.statusCode || error.body?.code;
    if (!errorCode && typeof error.body === "string") {
      try {
        const parsedBody = JSON.parse(error.body);
        errorCode = parsedBody.code;
      } catch (e) {
        // Ignore parsing error
      }
    }
    if (errorCode === 404) {
      // Ingress doesn't exist, create it
      const response = await networkingV1Api.createNamespacedIngress({
        namespace: namespace,
        body: manifest,
      });
      logger.info(`Created Ingress: ${name} in namespace: ${namespace}`);
      return { created: true, resource: response.body };
    }
    throw error;
  }
};

/**
 * Delete Kubernetes resource
 * @param {string} kind - Resource kind
 * @param {string} name - Resource name
 * @param {string} namespace - Resource namespace
 * @returns {Promise<Object>} Deletion result
 */
const deleteResource = async (kind, name, namespace = "default") => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not available");
    }

    logger.info(`Deleting ${kind}: ${name} in namespace: ${namespace}`);

    switch (kind) {
      case "Namespace":
        return await deleteNamespace(name);
      case "ConfigMap":
        return await deleteConfigMap(name, namespace);
      case "PersistentVolumeClaim":
        return await deletePVC(name, namespace);
      case "Deployment":
        return await deleteDeployment(name, namespace);
      case "Service":
        return await deleteService(name, namespace);
      case "Ingress":
        return await deleteIngress(name, namespace);
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
  } catch (error) {
    logger.error(`Failed to delete ${kind} ${name}:`, error);
    throw error;
  }
};

/**
 * Delete Namespace
 * @param {string} name - Namespace name
 * @returns {Promise<Object>} Deletion result
 */
const deleteNamespace = async (name) => {
  const k8sApi = getK8sClient();

  try {
    await k8sApi.deleteNamespace({ name: name });
    logger.info(`Deleted namespace: ${name}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      logger.info(`Namespace ${name} not found (already deleted)`);
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Delete ConfigMap
 * @param {string} name - ConfigMap name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deletion result
 */
const deleteConfigMap = async (name, namespace) => {
  const k8sApi = getK8sClient();

  try {
    await k8sApi.deleteNamespacedConfigMap({
      name: name,
      namespace: namespace,
    });
    logger.info(`Deleted ConfigMap: ${name} in namespace: ${namespace}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Delete PersistentVolumeClaim
 * @param {string} name - PVC name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deletion result
 */
const deletePVC = async (name, namespace) => {
  const k8sApi = getK8sClient();

  try {
    await k8sApi.deleteNamespacedPersistentVolumeClaim({
      name: name,
      namespace: namespace,
    });
    logger.info(`Deleted PVC: ${name} in namespace: ${namespace}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Delete Deployment
 * @param {string} name - Deployment name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deletion result
 */
const deleteDeployment = async (name, namespace) => {
  const appsV1Api = getAppsV1ApiClient();

  try {
    await appsV1Api.deleteNamespacedDeployment({
      name: name,
      namespace: namespace,
    });
    logger.info(`Deleted Deployment: ${name} in namespace: ${namespace}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Delete Service
 * @param {string} name - Service name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deletion result
 */
const deleteService = async (name, namespace) => {
  const k8sApi = getK8sClient();

  try {
    await k8sApi.deleteNamespacedService({
      name: name,
      namespace: namespace,
    });
    logger.info(`Deleted Service: ${name} in namespace: ${namespace}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Delete Ingress
 * @param {string} name - Ingress name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object>} Deletion result
 */
const deleteIngress = async (name, namespace) => {
  const networkingV1Api = getNetworkingV1ApiClient();

  try {
    await networkingV1Api.deleteNamespacedIngress({
      name: name,
      namespace: namespace,
    });
    logger.info(`Deleted Ingress: ${name} in namespace: ${namespace}`);
    return { deleted: true, name };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      return { notFound: true, name };
    }
    throw error;
  }
};

/**
 * Wait for deployment to be ready
 * @param {string} name - Deployment name
 * @param {string} namespace - Namespace
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Readiness result
 */
const waitForDeploymentReady = async (name, namespace, timeoutMs = 3000000) => {
  const appsV1Api = getAppsV1ApiClient();
  const startTime = Date.now();

  logger.info(
    `Waiting for deployment ${name} to be ready (timeout: ${timeoutMs}ms)`
  );

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await appsV1Api.readNamespacedDeployment({
        name: name,
        namespace: namespace,
      });
      const deployment = response.body || response;
      if (deployment && deployment.status && deployment.status.conditions) {
        const availableCondition = deployment.status.conditions.find(
          (c) => c.type === "Available" && c.status === "True"
        );

        if (availableCondition) {
          logger.info(`Deployment ${name} is fully ready and available.`);
          return {
            ready: true,
            replicas: deployment.spec?.replicas || 1,
            readyReplicas: deployment.status.readyReplicas || 0,
            availableReplicas: deployment.status.availableReplicas || 0,
            updatedReplicas: deployment.status.updatedReplicas || 0,
          };
        }
      }
      logger.info(
        `[WAIT] Waiting for deployment ${name} to become available...`
      );
    } catch (error) {
      logger.warn(
        `[WAIT] Error checking deployment status for ${name}: ${error.message}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5 seconds
  }

  logger.error(`Timeout waiting for deployment ${name} to be ready`);
  return { ready: false, timeout: true };
};

/**
 * Get pod status for deployment
 * @param {string} deploymentName - Deployment name
 * @param {string} namespace - Namespace
 * @returns {Promise<Array>} Pod status array
 */
const getPodsForDeployment = async (deploymentName, namespace) => {
  const k8sApi = getK8sClient();

  try {
    // First try to get the deployment to find the correct label selector
    const appsV1Api = getAppsV1ApiClient();
    let labelSelector = `app=${deploymentName}`;

    try {
      const deploymentResponse = await appsV1Api.readNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
      });

      const deployment = deploymentResponse.body || deploymentResponse;
      if (
        deployment &&
        deployment.spec &&
        deployment.spec.selector &&
        deployment.spec.selector.matchLabels
      ) {
        // Use the actual matchLabels from the deployment
        const matchLabels = deployment.spec.selector.matchLabels;
        labelSelector = Object.entries(matchLabels)
          .map(([key, value]) => `${key}=${value}`)
          .join(",");
        logger.info(`Using label selector from deployment: ${labelSelector}`);
      }
    } catch (deploymentError) {
      logger.warn(
        `Could not read deployment ${deploymentName}, using fallback label selector: ${labelSelector}`
      );
    }

    const response = await k8sApi.listNamespacedPod({
      namespace: namespace,
      labelSelector: labelSelector,
    });

    // Handle different response structures from Kubernetes client
    const podList = response.body || response;
    const items = podList.items || [];

    logger.info(
      `Found ${items.length} pods for deployment ${deploymentName} in namespace ${namespace} with selector: ${labelSelector}`
    );

    return items.map((pod) => ({
      name: pod.metadata.name,
      status: pod.status.phase,
      ready: pod.status.containerStatuses?.every((cs) => cs.ready) || false,
      restarts:
        pod.status.containerStatuses?.reduce(
          (acc, cs) => acc + cs.restartCount,
          0
        ) || 0,
      createdAt: pod.metadata.creationTimestamp,
    }));
  } catch (error) {
    logger.error(`Failed to get pods for deployment ${deploymentName}:`, error);
    return [];
  }
};

/**
 * Generate unique subdomain
 * @param {string} serviceName - Service name
 * @param {string} userId - User ID
 * @returns {string} Unique subdomain
 */
const generateSubdomain = (serviceName, userId) => {
  const timestamp = Date.now().toString(36);
  const userSuffix = userId.slice(-6);
  const serviceSlug = serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return `${serviceSlug}-${userSuffix}-${timestamp}.minispod.com`;
};

/**
 * Validate Kubernetes resource names
 * @param {string} name - Resource name
 * @returns {boolean} Is valid
 */
const isValidK8sName = (name) => {
  // Kubernetes resource names must be lowercase alphanumeric with hyphens
  const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  return k8sNameRegex.test(name) && name.length <= 63;
};

/**
 * Sanitize name for Kubernetes
 * @param {string} name - Original name
 * @returns {string} Sanitized name
 */
const sanitizeK8sName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .substring(0, 63);
};

export default {
  applyManifest,
  deleteResource,
  waitForDeploymentReady,
  getPodsForDeployment,
  generateSubdomain,
  isValidK8sName,
  sanitizeK8sName,
};
