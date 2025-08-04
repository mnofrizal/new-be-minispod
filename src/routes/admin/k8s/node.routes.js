import express from "express";
import nodeController from "../../../controllers/k8s/node.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

// All K8s routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// GET /api/admin/k8s/nodes - Get all Kubernetes nodes
router.get("/nodes", nodeController.getAllNodes);

// GET /api/admin/k8s/nodes/:name - Get specific Kubernetes node by name
router.get("/nodes/:name", nodeController.getNodeByName);

export default router;
