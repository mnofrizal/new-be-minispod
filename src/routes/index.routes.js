import express from "express";
import authRoutes from "./auth.routes.js";
import userProfileRoutes from "./user/profile.routes.js";
import catalogRoutes from "./catalog.routes.js";
import walletRoutes from "./wallet.routes.js";
import subscriptionRoutes from "./subscription.routes.js";
import instanceRoutes from "./instance.routes.js";
import adminUserRoutes from "./admin/users.routes.js";
import adminSubscriptionRoutes from "./admin/subscription.routes.js";
import adminHealthRoutes from "./admin/health.routes.js";
import adminK8sRoutes from "./admin/k8s/index.js";

const router = express.Router();

// Auth routes
router.use("/auth", authRoutes);

// Protected catalog routes (authentication required)
router.use("/catalog", catalogRoutes);

// Wallet routes (authentication required)
router.use("/wallet", walletRoutes);

// Subscription routes (authentication required)
router.use("/subscriptions", subscriptionRoutes);

// Instance routes (authentication required)
router.use("/instances", instanceRoutes);

// User routes (protected)
router.use("/user", userProfileRoutes);

// Admin routes
router.use("/admin/users", adminUserRoutes);
router.use("/admin/subscriptions", adminSubscriptionRoutes);
router.use("/admin/health", adminHealthRoutes);
router.use("/admin/k8s", adminK8sRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
