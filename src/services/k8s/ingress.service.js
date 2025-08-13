import {
  getNetworkingV1ApiClient,
  isK8sAvailable,
} from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getAllIngresses = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const networkingApi = getNetworkingV1ApiClient();
    const response = await networkingApi.listIngressForAllNamespaces();

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const ingresses = responseData.items.map((ingress) => {
      // Extract hosts from rules
      const hosts = ingress.spec.rules
        ? ingress.spec.rules.map((rule) => rule.host).filter(Boolean)
        : [];

      // Extract paths from rules
      const paths = ingress.spec.rules
        ? ingress.spec.rules.flatMap(
            (rule) =>
              rule.http?.paths?.map((path) => ({
                path: path.path,
                pathType: path.pathType,
                serviceName:
                  path.backend?.service?.name || path.backend?.serviceName,
                servicePort:
                  path.backend?.service?.port?.number ||
                  path.backend?.servicePort,
              })) || []
          )
        : [];

      // Extract load balancer ingress (external IPs/hostnames)
      const loadBalancer = ingress.status?.loadBalancer?.ingress || [];
      const externalIPs = loadBalancer
        .map((lb) => lb.ip || lb.hostname)
        .filter(Boolean);

      // Extract TLS information
      const tls = ingress.spec.tls
        ? ingress.spec.tls.map((tlsConfig) => ({
            hosts: tlsConfig.hosts || [],
            secretName: tlsConfig.secretName,
          }))
        : [];

      return {
        name: ingress.metadata.name,
        namespace: ingress.metadata.namespace,
        className: ingress.spec.ingressClassName || null,
        hosts,
        paths,
        externalIPs,
        tls,
        annotations: ingress.metadata.annotations || {},
        createdAt: ingress.metadata.creationTimestamp,
        conditions: ingress.status?.conditions || [],
      };
    });

    return {
      ingresses,
      total: ingresses.length,
    };
  } catch (error) {
    logger.error("Error fetching all ingresses:", error);
    throw new Error(`Failed to fetch ingresses: ${error.message}`);
  }
};

export default {
  getAllIngresses,
};
