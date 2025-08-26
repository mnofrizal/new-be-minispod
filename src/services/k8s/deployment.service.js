import { getAppsV1ApiClient, isK8sAvailable } from "../../config/kubernetes.js";
import logger from "../../utils/logger.js";

const getAllDeployments = async () => {
  try {
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes client not initialized");
    }

    const k8sApi = getAppsV1ApiClient();
    const response = await k8sApi.listDeploymentForAllNamespaces();

    const responseData = response.body || response;
    if (!responseData || !responseData.items) {
      logger.error(
        "Invalid response structure from Kubernetes API:",
        responseData
      );
      throw new Error("Invalid response from Kubernetes API");
    }

    const deployments = responseData.items.map((deployment) => {
      const containers = deployment.spec.template.spec.containers;
      const images = containers.map((c) => c.image);

      return {
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        replicas: deployment.spec.replicas,
        readyReplicas: deployment.status.readyReplicas || 0,
        availableReplicas: deployment.status.availableReplicas || 0,
        unavailableReplicas: deployment.status.unavailableReplicas || 0,
        conditions: deployment.status.conditions || [],
        containers: containers.map((c) => ({
          name: c.name,
          image: c.image,
          resources: {
            requests: {
              cpu: c.resources?.requests?.cpu || "0m",
              memory: c.resources?.requests?.memory || "0Mi",
            },
            limits: {
              cpu: c.resources?.limits?.cpu || "0m",
              memory: c.resources?.limits?.memory || "0Mi",
            },
          },
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
        })),
        images,
        createdAt: deployment.metadata.creationTimestamp,
      };
    });

    return {
      deployments,
      total: deployments.length,
    };
  } catch (error) {
    logger.error("Error fetching all deployments:", error);
    throw new Error(`Failed to fetch deployments: ${error.message}`);
  }
};

export default {
  getAllDeployments,
};
