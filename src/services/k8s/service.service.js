import { getK8sClient, isK8sAvailable } from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getAllServices = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getK8sClient();
    const response = await k8sApi.listServiceForAllNamespaces();

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const services = responseData.items.map((service) => {
      // Extract ports information
      const ports = service.spec.ports
        ? service.spec.ports.map((port) => ({
            name: port.name || null,
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol || "TCP",
            nodePort: port.nodePort || null,
          }))
        : [];

      // Extract external IPs
      const externalIPs = service.spec.externalIPs || [];

      // Extract load balancer information
      const loadBalancer = service.status?.loadBalancer?.ingress || [];
      const loadBalancerIPs = loadBalancer
        .map((lb) => lb.ip || lb.hostname)
        .filter(Boolean);

      // Determine service endpoints
      const endpoints = [
        ...externalIPs,
        ...loadBalancerIPs,
        ...(service.spec.type === "NodePort" &&
        service.spec.clusterIP !== "None"
          ? [`${service.spec.clusterIP}:${ports.map((p) => p.port).join(",")}`]
          : []),
      ];

      return {
        name: service.metadata.name,
        namespace: service.metadata.namespace,
        type: service.spec.type || "ClusterIP",
        clusterIP: service.spec.clusterIP,
        externalIPs,
        loadBalancerIPs,
        ports,
        selector: service.spec.selector || {},
        sessionAffinity: service.spec.sessionAffinity || "None",
        endpoints: endpoints.length > 0 ? endpoints : null,
        annotations: service.metadata.annotations || {},
        labels: service.metadata.labels || {},
        createdAt: service.metadata.creationTimestamp,
        conditions: service.status?.conditions || [],
      };
    });

    return {
      services,
      total: services.length,
    };
  } catch (error) {
    logger.error("Error fetching all services:", error);
    throw new Error(`Failed to fetch services: ${error.message}`);
  }
};

export default {
  getAllServices,
};
