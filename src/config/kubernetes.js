import {
  KubeConfig,
  CoreV1Api,
  AppsV1Api,
  Metrics,
} from "@kubernetes/client-node";
import logger from "../utils/logger.js";

// Kubernetes configuration and client management
let kc = null;
let k8sApi = null;
let metricsApi = null;
let appsV1Api = null;
let isInitialized = false;

const initializeKubernetesClient = () => {
  try {
    kc = new KubeConfig();

    // Load kubeconfig from default locations or in-cluster config
    if (process.env.NODE_ENV === "production") {
      // In-cluster configuration (when running inside K8s cluster)
      kc.loadFromCluster();
    } else {
      // Local development - load from ~/.kube/config
      kc.loadFromDefault();
    }

    k8sApi = kc.makeApiClient(CoreV1Api);
    appsV1Api = kc.makeApiClient(AppsV1Api);
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

// Initialize client when module loads
initializeKubernetesClient();

export {
  getK8sClient,
  getMetricsApi,
  isK8sAvailable,
  getKubeConfig,
  initializeKubernetesClient,
  getAppsV1ApiClient,
};
