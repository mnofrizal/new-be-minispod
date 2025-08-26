import {
  getK8sClient,
  getMetricsApi,
  isK8sAvailable,
} from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getPodMetrics = async (podName, namespace) => {
  try {
    const metricsApi = getMetricsApi();
    if (!metricsApi) {
      return null;
    }

    const metrics = await metricsApi.getPodMetrics(namespace);
    const podMetric = metrics.items.find(
      (item) => item.metadata.name === podName
    );

    if (!podMetric) {
      return null;
    }

    const containers = podMetric.containers.map((container) => {
      const cpuRaw = container.usage.cpu;
      const memoryRaw = container.usage.memory;

      const cpuNanocores = parseInt(cpuRaw.replace("n", ""));
      const cpuMillicores = Math.round(cpuNanocores / 1000000);
      const cpuCores = parseFloat((cpuNanocores / 1000000000).toFixed(2));

      const memoryKiloBytes = parseInt(memoryRaw.replace("Ki", ""));
      const memoryBytes = memoryKiloBytes * 1024;
      const memoryMegabytes = parseFloat(
        (memoryBytes / 1024 / 1024).toFixed(2)
      );
      const memoryGigabytes = parseFloat(
        (memoryBytes / 1024 / 1024 / 1024).toFixed(2)
      );

      return {
        name: container.name,
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
    });

    return {
      timestamp: podMetric.timestamp,
      window: podMetric.window,
      containers,
    };
  } catch (error) {
    logger.warn(
      `Failed to get metrics for pod ${namespace}/${podName}:`,
      error.message
    );
    return null;
  }
};

const getAllPods = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getK8sClient();
    const response = await k8sApi.listPodForAllNamespaces();

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const podsWithMetrics = await Promise.allSettled(
      responseData.items.map(async (pod) => {
        const metrics = await getPodMetrics(
          pod.metadata.name,
          pod.metadata.namespace
        );

        // Merge container info with metrics
        const containers = pod.spec.containers.map((c) => {
          const containerStatus = pod.status.containerStatuses
            ? pod.status.containerStatuses.find((cs) => cs.name === c.name)
            : null;

          const containerMetrics = metrics?.containers?.find(
            (mc) => mc.name === c.name
          );

          return {
            name: c.name,
            image: c.image,
            ready: containerStatus?.ready || false,
            resources: {
              requests: {
                cpu: c.resources?.requests?.cpu || "0m",
                memory: c.resources?.requests?.memory || "0Mi",
                ...(c.resources?.requests?.storage && {
                  storage: c.resources.requests.storage,
                }),
              },
              limits: {
                cpu: c.resources?.limits?.cpu || "0m",
                memory: c.resources?.limits?.memory || "0Mi",
                ...(c.resources?.limits?.storage && {
                  storage: c.resources.limits.storage,
                }),
              },
            },
            usage: containerMetrics?.usage || null,
            ports:
              c.ports?.map((p) => ({
                containerPort: p.containerPort,
                name: p.name,
                protocol: p.protocol || "TCP",
              })) || [],
            volumeMounts:
              c.volumeMounts?.map((vm) => ({
                name: vm.name,
                mountPath: vm.mountPath,
                readOnly: vm.readOnly || false,
              })) || [],
          };
        });

        return {
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          status: pod.status.phase,
          nodeName: pod.spec.nodeName,
          podIP: pod.status.podIP,
          hostIP: pod.status.hostIP,
          restarts: pod.status.containerStatuses
            ? pod.status.containerStatuses.reduce(
                (acc, cs) => acc + cs.restartCount,
                0
              )
            : 0,
          createdAt: pod.metadata.creationTimestamp,
          containers,
          metricsTimestamp: metrics?.timestamp || null,
          metricsWindow: metrics?.window || null,
        };
      })
    );

    const pods = podsWithMetrics
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return {
      pods,
      total: pods.length,
    };
  } catch (error) {
    logger.error("Error fetching all pods:", error);
    throw new Error(`Failed to fetch pods: ${error.message}`);
  }
};

export default {
  getAllPods,
};
