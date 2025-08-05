import express from "express";
import namespaceController from "../../../controllers/k8s/namespace.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

router.get(
  "/",
  [authenticateToken, authorizeRoles("ADMINISTRATOR")],
  namespaceController.getAllNamespaces
);

export default router;
