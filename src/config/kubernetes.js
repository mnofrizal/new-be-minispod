import {
  KubeConfig,
  CoreV1Api,
  AppsV1Api,
  NetworkingV1Api,
  Metrics,
} from "@kubernetes/client-node";
import os from "os";
import path from "path";
import logger from "../utils/logger.js";

// Kubernetes configuration and client management
let kc = null;
let k8sApi = null;
let metricsApi = null;
let appsV1Api = null;
let networkingV1Api = null;
let isInitialized = false;

const initializeKubernetesClient = () => {
  try {
    kc = new KubeConfig();

    // Load kubeconfig from a specific path if KUBECONFIG_PATH is set,
    // otherwise load from default locations or in-cluster config
    if (process.env.KUBECONFIG_PATH) {
      let kubeconfigPath = process.env.KUBECONFIG_PATH;
      // Expand tilde to home directory
      if (kubeconfigPath.startsWith("~")) {
        kubeconfigPath = path.join(os.homedir(), kubeconfigPath.slice(1));
      }
      kc.loadFromFile(kubeconfigPath);
    } else if (process.env.NODE_ENV === "production") {
      // In-cluster configuration (when running inside K8s cluster)
      kc.loadFromCluster();
    } else {
      // Local development - load from ~/.kube/config
      kc.loadFromDefault();
    }

    // (INSECURE) Skip TLS verification if the environment variable is set
    // This is useful for development with self-signed certificates
    logger.info(
      `Checking for K8S_SKIP_TLS_VERIFY env var: "${process.env.K8S_SKIP_TLS_VERIFY}"`
    );
    if (process.env.K8S_SKIP_TLS_VERIFY === "true") {
      const cluster = kc.getCurrentCluster();
      if (cluster) {
        logger.warn(
          "K8S_SKIP_TLS_VERIFY is true. Attempting to disable Kubernetes TLS certificate verification..."
        );
        cluster.skipTlsVerify = true;
        logger.info(
          `Cluster's skipTlsVerify flag is now set to: ${cluster.skipTlsVerify}`
        );
      } else {
        logger.warn("Could not get current cluster to set skipTlsVerify flag.");
      }
    }

    k8sApi = kc.makeApiClient(CoreV1Api);
    appsV1Api = kc.makeApiClient(AppsV1Api);
    networkingV1Api = kc.makeApiClient(NetworkingV1Api);
    metricsApi = new Metrics(kc);
    isInitialized = true;
    logger.info("Kubernetes client and metrics API initialized successfully");
  } catch (error) {
    logger.warn(
      "Kubernetes client initialization failed (this is normal if not running in K8s environment):",
      error.message
    );
    isInitialized = false;
    k8sApi = null;
    metricsApi = null;
    appsV1Api = null;
    networkingV1Api = null;
  }
};

const getK8sClient = () => {
  if (!isInitialized) {
    initializeKubernetesClient();
  }
  return k8sApi;
};

const isK8sAvailable = () => {
  return isInitialized && k8sApi !== null;
};

const getKubeConfig = () => {
  return kc;
};

const getMetricsApi = () => {
  if (!isInitialized) {
    initializeKubernetesClient();
  }
  return metricsApi;
};

const getAppsV1ApiClient = () => {
  if (!isInitialized) {
    initializeKubernetesClient();
  }
  return appsV1Api;
};

const getNetworkingV1ApiClient = () => {
  if (!isInitialized) {
    initializeKubernetesClient();
  }
  return networkingV1Api;
};

// Initialize client when module loads
initializeKubernetesClient();

export {
  getK8sClient,
  getMetricsApi,
  isK8sAvailable,
  getKubeConfig,
  initializeKubernetesClient,
  getAppsV1ApiClient,
  getNetworkingV1ApiClient,
};
