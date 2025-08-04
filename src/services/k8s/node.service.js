import {
  getK8sClient,
  getMetricsApi,
  isK8sAvailable,
} from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getNodeStatus = (node) => {
  const conditions = node.status.conditions || [];
  const readyCondition = conditions.find(
    (condition) => condition.type === "Ready"
  );

  if (readyCondition) {
    return readyCondition.status === "True" ? "Ready" : "NotReady";
  }

  return "Unknown";
};

const getNodeMetrics = async (nodeName) => {
  try {
    const metricsApi = getMetricsApi();
    if (!metricsApi) {
      return null;
    }

    const metrics = await metricsApi.getNodeMetrics();
    const nodeMetric = metrics.items.find(
      (item) => item.metadata.name === nodeName
    );

    if (!nodeMetric) {
      return null;
    }

    const cpuRaw = nodeMetric.usage.cpu;
    const memoryRaw = nodeMetric.usage.memory;

    // Parse CPU (format: "68465441n" -> nanocores)
    const cpuNanocores = parseInt(cpuRaw.replace("n", ""));
    const cpuMillicores = Math.round(cpuNanocores / 1000000);
    const cpuCores = parseFloat((cpuNanocores / 1000000000).toFixed(2));

    // Parse Memory (format: "1430408Ki" -> bytes)
    const memoryKiloBytes = parseInt(memoryRaw.replace("Ki", ""));
    const memoryBytes = memoryKiloBytes * 1024;
    const memoryMegabytes = parseFloat((memoryBytes / 1024 / 1024).toFixed(2));
    const memoryGigabytes = parseFloat(
      (memoryBytes / 1024 / 1024 / 1024).toFixed(2)
    );

    return {
      timestamp: nodeMetric.timestamp,
      window: nodeMetric.window,
      usage: {
        cpu: {
          raw: cpuRaw,
          millicores: cpuMillicores,
          cores: cpuCores,
        },
        memory: {
          raw: memoryRaw,
          bytes: memoryBytes,
          megabytes: memoryMegabytes,
          gigabytes: memoryGigabytes,
        },
      },
    };
  } catch (error) {
    logger.warn(`Failed to get metrics for node ${nodeName}:`, error.message);
    return null;
  }
};

const getAllNodes = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getK8sClient();
    const response = await k8sApi.listNode();

    // Handle different response structures
    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    // Get metrics for all nodes
    const nodesWithMetrics = await Promise.allSettled(
      responseData.items.map(async (node) => {
        const metrics = await getNodeMetrics(node.metadata.name);
        return {
          name: node.metadata.name,
          status: getNodeStatus(node),
          version: node.status.nodeInfo.kubeletVersion,
          os: node.status.nodeInfo.osImage,
          kernel: node.status.nodeInfo.kernelVersion,
          containerRuntime: node.status.nodeInfo.containerRuntimeVersion,
          capacity: {
            cpu: node.status.capacity.cpu,
            memory: node.status.capacity.memory,
            pods: node.status.capacity.pods,
            storage: node.status.capacity["ephemeral-storage"],
          },
          allocatable: {
            cpu: node.status.allocatable.cpu,
            memory: node.status.allocatable.memory,
            pods: node.status.allocatable.pods,
            storage: node.status.allocatable["ephemeral-storage"],
          },
          conditions: node.status.conditions,
          addresses: node.status.addresses,
          nodeInfo: node.status.nodeInfo,
          createdAt: node.metadata.creationTimestamp,
          labels: node.metadata.labels,
          annotations: node.metadata.annotations,
          metrics: metrics,
        };
      })
    );

    const nodes = nodesWithMetrics
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return {
      nodes,
      total: nodes.length,
    };
  } catch (error) {
    logger.error("Error fetching all nodes:", error);
    throw new Error(`Failed to fetch nodes: ${error.message}`);
  }
};

const getNodeByName = async (nodeName) => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getK8sClient();
    const response = await k8sApi.readNode({ name: nodeName });

    // Handle different response structures
    const node = response.body || response;
    if (!node || !node.metadata) {
      logger.error(
        "Invalid node response structure from Kubernetes API:",
        node
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    // Get metrics for this specific node
    const metrics = await getNodeMetrics(node.metadata.name);

    return {
      name: node.metadata.name,
      uid: node.metadata.uid,
      status: getNodeStatus(node),
      version: node.status.nodeInfo.kubeletVersion,
      os: node.status.nodeInfo.osImage,
      kernel: node.status.nodeInfo.kernelVersion,
      containerRuntime: node.status.nodeInfo.containerRuntimeVersion,
      architecture: node.status.nodeInfo.architecture,
      capacity: {
        cpu: node.status.capacity.cpu,
        memory: node.status.capacity.memory,
        pods: node.status.capacity.pods,
        storage: node.status.capacity["ephemeral-storage"],
      },
      allocatable: {
        cpu: node.status.allocatable.cpu,
        memory: node.status.allocatable.memory,
        pods: node.status.allocatable.pods,
        storage: node.status.allocatable["ephemeral-storage"],
      },
      conditions: node.status.conditions,
      addresses: node.status.addresses,
      nodeInfo: node.status.nodeInfo,
      taints: node.spec.taints || [],
      createdAt: node.metadata.creationTimestamp,
      labels: node.metadata.labels,
      annotations: node.metadata.annotations,
      spec: node.spec,
      metrics: metrics,
    };
  } catch (error) {
    logger.error(`Error fetching node ${nodeName}:`, error);
    if (error.response && error.response.statusCode === 404) {
      throw new Error(`Node '${nodeName}' not found`);
    }
    throw new Error(`Failed to fetch node: ${error.message}`);
  }
};

export default {
  getAllNodes,
  getNodeByName,
};
