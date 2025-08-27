import express from "express";
import instanceController from "../controllers/instance.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import instanceValidation from "../validations/instance.validation.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route POST /api/instances
 * @desc Create a new service instance from subscription
 * @access Private (User)
 */
router.post(
  "/",
  validate(instanceValidation.createInstance),
  instanceController.createInstance
);

/**
 * @route GET /api/instances
 * @desc Get user's service instances
 * @access Private (User)
 */
router.get(
  "/",
  validate(instanceValidation.getUserInstances),
  instanceController.getUserInstances
);

/**
 * @route GET /api/instances/:id
 * @desc Get service instance details and status
 * @access Private (User)
 */
router.get(
  "/:id",
  validate(instanceValidation.getInstanceDetails),
  instanceController.getInstanceDetails
);

/**
 * @route PUT /api/instances/:id/update
 * @desc Update service instance (for subscription upgrades)
 * @access Private (User)
 */
router.put(
  "/:id/update",
  validate(instanceValidation.updateInstance),
  instanceController.updateInstance
);

/**
 * @route DELETE /api/instances/:id
 * @desc Terminate service instance
 * @access Private (User)
 */
router.delete(
  "/:id",
  validate(instanceValidation.terminateInstance),
  instanceController.terminateInstance
);

/**
 * @route GET /api/instances/:id/logs
 * @desc Get instance logs
 * @access Private (User)
 */
router.get(
  "/:id/logs",
  validate(instanceValidation.getInstanceLogs),
  instanceController.getInstanceLogs
);

/**
 * @route POST /api/instances/:id/restart
 * @desc Restart service instance
 * @access Private (User)
 */
router.post(
  "/:id/restart",
  validate(instanceValidation.restartInstance),
  instanceController.restartInstance
);

/**
 * @route PUT /api/instances/:id/stop
 * @desc Stop service instance temporarily
 * @access Private (User)
 */
router.put(
  "/:id/stop",
  validate(instanceValidation.stopInstance),
  instanceController.stopInstance
);

/**
 * @route PUT /api/instances/:id/start
 * @desc Start service instance from stopped state
 * @access Private (User)
 */
router.put(
  "/:id/start",
  validate(instanceValidation.startInstance),
  instanceController.startInstance
);

export default router;
