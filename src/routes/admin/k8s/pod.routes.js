import express from "express";
import podController from "../../../controllers/k8s/pod.controller.js";
import { authenticateToken, authorizeRoles } from "../../../middleware/auth.js";

const router = express.Router();

router.get(
  "/",
  [authenticateToken, authorizeRoles("ADMINISTRATOR")],
  podController.getAllPods
);

export default router;
