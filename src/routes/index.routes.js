import express from "express";
import authRoutes from "./auth.routes.js";
import userProfileRoutes from "./user/profile.routes.js";
import adminUserRoutes from "./admin/users.routes.js";
import adminK8sNodeRoutes from "./admin/k8s/node.routes.js";

const router = express.Router();

// Auth routes
router.use("/auth", authRoutes);

// User routes
router.use("/user", userProfileRoutes);

// Admin routes
router.use("/admin/users", adminUserRoutes);
router.use("/admin/k8s", adminK8sNodeRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;