import logger from "../utils/logger.js";

/**
 * Generate Kubernetes Deployment template
 * @param {Object} service - Service configuration
 * @param {Object} plan - Service plan configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Kubernetes Deployment manifest
 */
const generateDeploymentTemplate = (service, plan, instance) => {
  const envVars = generateEnvVars(service, instance);

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: instance.deploymentName,
      namespace: instance.namespace,
      labels: {
        app: service.slug,
        instance: instance.id,
        user: instance.subscription.userId,
        service: service.slug,
        "minispod.com/managed": "true",
      },
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: service.slug,
          instance: instance.id,
        },
      },
      template: {
        metadata: {
          labels: {
            app: service.slug,
            instance: instance.id,
            "minispod.com/managed": "true",
          },
        },
        spec: {
          containers: [
            {
              name: service.slug,
              image: service.dockerImage,
              ports: [
                {
                  containerPort: service.defaultPort,
                  name: "http",
                },
              ],
              resources: {
                requests: {
                  cpu: `${plan.cpuMilli}m`,
                  memory: `${plan.memoryMb}Mi`,
                },
                limits: {
                  cpu: `${plan.cpuMilli}m`,
                  memory: `${plan.memoryMb}Mi`,
                },
              },
              env: envVars,
              volumeMounts:
                plan.storageGb > 0
                  ? [
                      {
                        name: "data-storage",
                        mountPath: "/data",
                      },
                    ]
                  : [],
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: "http",
                },
                initialDelaySeconds: 60,
                periodSeconds: 20,
                timeoutSeconds: 10,
                failureThreshold: 5,
              },
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: "http",
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 5,
              },
            },
          ],
          volumes:
            plan.storageGb > 0
              ? [
                  {
                    name: "data-storage",
                    persistentVolumeClaim: {
                      claimName: instance.name + "-pvc",
                    },
                  },
                ]
              : [],
          restartPolicy: "Always",
        },
      },
    },
  };
};

/**
 * Generate Kubernetes Service template
 * @param {Object} service - Service configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Kubernetes Service manifest
 */
const generateServiceTemplate = (service, instance) => {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: instance.serviceName,
      namespace: instance.namespace,
      labels: {
        "minispod.com/app": service.slug,
        instance: instance.id,
        "minispod.com/managed": "true",
      },
    },
    spec: {
      selector: {
        app: service.slug,
        instance: instance.id,
      },
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: service.defaultPort,
          protocol: "TCP",
        },
      ],
      type: "ClusterIP",
    },
  };
};

/**
 * Generate Kubernetes Ingress template
 * @param {Object} service - Service configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Kubernetes Ingress manifest
 */
const generateIngressTemplate = (service, instance) => {
  const host = instance.customDomain || instance.subdomain;

  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: instance.ingressName,
      namespace: instance.namespace,
      labels: {
        "minispod.com/app": service.slug,
        instance: instance.id,
        "minispod.com/managed": "true",
      },
      annotations: {
        "kubernetes.io/ingress.class": "nginx",
        "nginx.ingress.kubernetes.io/ssl-redirect": "true",
        "nginx.ingress.kubernetes.io/force-ssl-redirect": "true",
        ...(instance.sslEnabled && {
          "cert-manager.io/cluster-issuer": "letsencrypt-prod",
        }),
      },
    },
    spec: {
      ...(instance.sslEnabled && {
        tls: [
          {
            hosts: [host],
            secretName: `${instance.name}-tls`,
          },
        ],
      }),
      rules: [
        {
          host: host,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: instance.serviceName,
                    port: {
                      number: 80,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
};

/**
 * Generate Kubernetes PersistentVolumeClaim template
 * @param {Object} plan - Service plan configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Kubernetes PVC manifest
 */
const generatePVCTemplate = (plan, instance) => {
  if (plan.storageGb <= 0) {
    return null;
  }

  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: instance.name + "-pvc",
      namespace: instance.namespace,
      labels: {
        instance: instance.id,
        "minispod.com/managed": "true",
      },
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: `${plan.storageGb}Gi`,
        },
      },
      storageClassName: "local-path", // K3s default storage class
    },
  };
};

/**
 * Generate Kubernetes ConfigMap template
 * @param {Object} service - Service configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Kubernetes ConfigMap manifest
 */
const generateConfigMapTemplate = (service, instance) => {
  const envData = {};

  // Add service-specific environment variables
  if (service.envTemplate) {
    Object.entries(service.envTemplate).forEach(([key, value]) => {
      envData[key] = String(value);
    });
  }

  // Add instance-specific environment variables
  if (instance.envVars) {
    Object.entries(instance.envVars).forEach(([key, value]) => {
      envData[key] = String(value);
    });
  }

  // Add common environment variables
  envData.INSTANCE_ID = instance.id;
  envData.INSTANCE_NAME = instance.name;
  envData.SUBDOMAIN = instance.subdomain;
  envData.PUBLIC_URL = instance.publicUrl || "";

  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: instance.name + "-config",
      namespace: instance.namespace,
      labels: {
        "minispod.com/app": service.slug,
        instance: instance.id,
        "minispod.com/managed": "true",
      },
    },
    data: envData,
  };
};

/**
 * Generate Kubernetes Namespace template
 * @param {string} userId - User ID
 * @returns {Object} Kubernetes Namespace manifest
 */
const generateNamespaceTemplate = (userId) => {
  const namespaceName = `user-${userId}`;

  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: namespaceName,
      labels: {
        "minispod.com/managed": "true",
        "minispod.com/user-id": userId,
        "minispod.com/type": "user-namespace",
      },
      annotations: {
        "minispod.com/created-at": new Date().toISOString(),
        "minispod.com/user-id": userId,
      },
    },
  };
};

/**
 * Generate environment variables for container
 * @param {Object} service - Service configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Array} Array of environment variable objects
 */
const generateEnvVars = (service, instance) => {
  const envVars = [];

  // Add service-specific environment variables from template
  if (service.envTemplate) {
    Object.entries(service.envTemplate).forEach(([key, value]) => {
      envVars.push({
        name: key,
        value: String(value),
      });
    });
  }

  // Add instance-specific environment variables
  if (instance.envVars) {
    Object.entries(instance.envVars).forEach(([key, value]) => {
      envVars.push({
        name: key,
        value: String(value),
      });
    });
  }

  // Add common environment variables
  envVars.push(
    {
      name: "INSTANCE_ID",
      value: instance.id,
    },
    {
      name: "INSTANCE_NAME",
      value: instance.name,
    },
    {
      name: "SUBDOMAIN",
      value: instance.subdomain,
    }
  );

  // Add public URL if available
  if (instance.publicUrl) {
    envVars.push({
      name: "PUBLIC_URL",
      value: instance.publicUrl,
    });
  }

  // Add environment variables from ConfigMap
  envVars.push({
    name: "CONFIG_MAP_NAME",
    value: instance.name + "-config",
  });

  return envVars;
};

/**
 * Generate service-specific templates based on service type
 * @param {string} serviceSlug - Service slug (n8n-automation, ghost-blog, etc.)
 * @param {Object} service - Service configuration
 * @param {Object} plan - Service plan configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Service-specific template modifications
 */
const generateServiceSpecificTemplate = (
  serviceSlug,
  service,
  plan,
  instance
) => {
  const templates = {
    "n8n-automation": {
      envVars: {
        N8N_HOST: instance.subdomain,
        N8N_PORT: String(service.defaultPort),
        N8N_PROTOCOL: instance.sslEnabled ? "https" : "http",
        WEBHOOK_URL: `${instance.sslEnabled ? "https" : "http"}://${
          instance.subdomain
        }`,
        GENERIC_TIMEZONE: "Asia/Jakarta",
        N8N_METRICS: "true",
        DB_SQLITE_POOL_SIZE: "10",
        N8N_RUNNERS_ENABLED: "true",
      },
      volumeMounts: [
        {
          name: "data-storage",
          mountPath: "/home/node/.n8n",
        },
      ],
    },
    "ghost-blog": {
      envVars: {
        url: `${instance.sslEnabled ? "https" : "http"}://${
          instance.subdomain
        }`,
        NODE_ENV: "production",
        database__client: "sqlite3",
        database__connection__filename: "/var/lib/ghost/content/data/ghost.db",
        database__useNullAsDefault: "true",
      },
      volumeMounts: [
        {
          name: "data-storage",
          mountPath: "/var/lib/ghost/content",
        },
      ],
    },
    "postgresql-database": {
      envVars: {
        POSTGRES_DB: instance.name,
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: generateRandomPassword(),
        PGDATA: "/var/lib/postgresql/data/pgdata",
      },
      volumeMounts: [
        {
          name: "data-storage",
          mountPath: "/var/lib/postgresql/data",
        },
      ],
      ports: [
        {
          containerPort: 5432,
          name: "postgres",
        },
      ],
    },
  };

  return templates[serviceSlug] || {};
};

/**
 * Generate random password for database services
 * @returns {string} Random password
 */
const generateRandomPassword = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Validate template generation parameters
 * @param {Object} service - Service configuration
 * @param {Object} plan - Service plan configuration
 * @param {Object} instance - Service instance configuration
 * @returns {Object} Validation result
 */
const validateTemplateParams = (service, plan, instance) => {
  const errors = [];

  if (!service || !service.slug || !service.dockerImage) {
    errors.push("Invalid service configuration");
  }

  if (!plan || !plan.cpuMilli || !plan.memoryMb) {
    errors.push("Invalid plan configuration");
  }

  if (!instance || !instance.name || !instance.namespace) {
    errors.push("Invalid instance configuration");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default {
  generateDeploymentTemplate,
  generateServiceTemplate,
  generateIngressTemplate,
  generatePVCTemplate,
  generateConfigMapTemplate,
  generateNamespaceTemplate,
  generateEnvVars,
  generateServiceSpecificTemplate,
  validateTemplateParams,
};
