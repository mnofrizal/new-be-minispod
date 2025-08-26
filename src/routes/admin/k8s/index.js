import express from "express";
import nodeRoutes from "./node.routes.js";
import namespaceRoutes from "./namespace.routes.js";
import deploymentRoutes from "./deployment.routes.js";
import podRoutes from "./pod.routes.js";
import ingressRoutes from "./ingress.routes.js";
import serviceRoutes from "./service.routes.js";
import logRoutes from "./log.routes.js";

const router = express.Router();

router.use("/nodes", nodeRoutes);
router.use("/namespaces", namespaceRoutes);
router.use("/deployments", deploymentRoutes);
router.use("/pods", podRoutes);
router.use("/ingresses", ingressRoutes);
router.use("/services", serviceRoutes);
router.use("/logs", logRoutes);

export default router;
