import { getK8sClient, getKubeConfig } from "../../config/kubernetes.js";
import prisma from "../../utils/prisma.js";
import logger from "../../utils/logger.js";
import { Log } from "@kubernetes/client-node";
import stream from "stream";
import k8sHelper from "../../utils/k8s-helper.js";

/**
 * Finds the latest running pod for a given service instance.
 * @param {string} instanceId - The ID of the service instance.
 * @returns {Promise<string|null>} The name of the latest running pod, or null if not found.
 */
const findLatestPodForInstance = async (instanceId) => {
  const instance = await prisma.serviceInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance || !instance.deploymentName) {
    logger.warn(
      `Service instance or deployment name not found for ID: ${instanceId}`
    );
    return null;
  }

  const { deploymentName, namespace } = instance;

  try {
    const pods = await k8sHelper.getPodsForDeployment(
      deploymentName,
      namespace
    );

    if (!pods || pods.length === 0) {
      logger.warn(
        `No pods found for deployment: ${deploymentName} in namespace ${namespace}`
      );
      return null;
    }

    // Sort pods by creation timestamp to find the newest one
    pods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const latestPod = pods[0];
    logger.info(`Latest pod for instance ${instanceId} is ${latestPod.name}`);
    return latestPod.name;
  } catch (error) {
    logger.error(
      `Error fetching pods for deployment ${deploymentName}:`,
      error
    );
    return null;
  }
};

/**
 * Streams logs from a specific pod to a Socket.IO client.
 * @param {object} socket - The Socket.IO socket instance.
 * @param {string} subscriptionId - The ID of the user's subscription.
 */
const streamLogs = async (socket, subscriptionId) => {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      instances: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      user: true, // Include user to get the userId for the namespace
      service: true, // Include service to get the slug for the container name
    },
  });

  if (!sub || !sub.instances || sub.instances.length === 0) {
    socket.emit(
      "log-error",
      "No active service instance found for this subscription."
    );
    socket.disconnect();
    return;
  }

  const latestInstance = sub.instances[0];
  const instanceId = latestInstance.id;
  const podName = await findLatestPodForInstance(instanceId);

  if (!podName) {
    socket.emit("log-error", "Could not find a running pod for this service.");
    socket.disconnect();
    return;
  }

  const namespace = `user-${sub.userId}`;
  const containerName = sub.service.slug;

  const k8sApi = getK8sClient();
  if (!k8sApi) {
    socket.emit("log-error", "Kubernetes client not available.");
    socket.disconnect();
    return;
  }

  const logStream = new stream.PassThrough();
  logStream.on("data", (chunk) => {
    socket.emit("log-data", chunk.toString());
  });

  try {
    const log = new Log(getKubeConfig());

    let req;

    socket.on("disconnect", () => {
      logger.info(`Client disconnected, stopping log stream for ${podName}`);
      if (req) {
        req.abort();
      }
    });

    req = await log.log(
      namespace,
      podName,
      containerName, // Explicitly specify the container name
      logStream,
      (err) => {
        if (err) {
          logger.error(`Log stream error for pod ${podName}:`, err);
          socket.emit("log-error", "Log stream unexpectedly ended.");
        }
        socket.disconnect();
      },
      { follow: true, pretty: false, timestamps: true }
    );
    socket.emit(
      "log-start",
      `Streaming logs for pod: ${podName}, container: ${containerName}`
    );
  } catch (error) {
    logger.error(`Error streaming logs for pod ${podName}:`, error);
    socket.emit("log-error", "Failed to start log stream.");
    socket.disconnect();
  }
};

export default {
  streamLogs,
};
