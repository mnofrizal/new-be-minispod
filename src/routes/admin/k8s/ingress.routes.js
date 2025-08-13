import express from "express";
import ingressController from "../../../controllers/k8s/ingress.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// GET /api/admin/k8s/ingresses - Get all ingresses
router.get("/", ingressController.getAllIngresses);

export default router;
