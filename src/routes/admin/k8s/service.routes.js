import express from "express";
import serviceController from "../../../controllers/k8s/service.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// GET /api/admin/k8s/services - Get all services
router.get("/", serviceController.getAllServices);

export default router;
