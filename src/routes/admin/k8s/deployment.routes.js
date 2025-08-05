import express from "express";
import deploymentController from "../../../controllers/k8s/deployment.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

router.get(
  "/",
  [authenticateToken, authorizeRoles("ADMINISTRATOR")],
  deploymentController.getAllDeployments
);

export default router;
