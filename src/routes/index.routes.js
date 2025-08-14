import express from "express";
import authRoutes from "./auth.routes.js";
import userProfileRoutes from "./user/profile.routes.js";
import catalogRoutes from "./catalog.routes.js";
import adminUserRoutes from "./admin/users.routes.js";
import adminK8sNodeRoutes from "./admin/k8s/node.routes.js";
import adminK8sNamespaceRoutes from "./admin/k8s/namespace.routes.js";
import adminK8sDeploymentRoutes from "./admin/k8s/deployment.routes.js";
import adminK8sPodRoutes from "./admin/k8s/pod.routes.js";
import adminK8sIngressRoutes from "./admin/k8s/ingress.routes.js";
import adminK8sServiceRoutes from "./admin/k8s/service.routes.js";

const router = express.Router();

// Auth routes
router.use("/auth", authRoutes);

// Protected catalog routes (authentication required)
router.use("/catalog", catalogRoutes);

// User routes (protected)
router.use("/user", userProfileRoutes);

// Admin routes
router.use("/admin/users", adminUserRoutes);
router.use("/admin/k8s/nodes", adminK8sNodeRoutes);
router.use("/admin/k8s/namespaces", adminK8sNamespaceRoutes);
router.use("/admin/k8s/deployments", adminK8sDeploymentRoutes);
router.use("/admin/k8s/pods", adminK8sPodRoutes);
router.use("/admin/k8s/ingresses", adminK8sIngressRoutes);
router.use("/admin/k8s/services", adminK8sServiceRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
