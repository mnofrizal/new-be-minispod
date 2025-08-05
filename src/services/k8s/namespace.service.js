import { getK8sClient, isK8sAvailable } from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getAllNamespaces = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getK8sClient();
    const response = await k8sApi.listNamespace();

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const namespaces = responseData.items.map((namespace) => ({
      name: namespace.metadata.name,
      status: namespace.status.phase,
      createdAt: namespace.metadata.creationTimestamp,
    }));

    return {
      namespaces,
      total: namespaces.length,
    };
  } catch (error) {
    logger.error("Error fetching all namespaces:", error);
    throw new Error(`Failed to fetch namespaces: ${error.message}`);
  }
};

export default {
  getAllNamespaces,
};
