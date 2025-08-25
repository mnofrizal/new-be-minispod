import express from "express";
import healthController from "../../controllers/admin/health.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import Joi from "joi";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use([authenticateToken, authorizeRoles("ADMINISTRATOR")]);

/**
 * Validation schemas
 */
const healthValidation = {
  getInstanceHealth: {
    params: Joi.object({
      id: Joi.string().required().messages({
        "string.empty": "Instance ID is required",
        "any.required": "Instance ID is required",
      }),
    }),
  },
  getHealthStats: {
    query: Joi.object({
      timeRange: Joi.string()
        .valid("1h", "6h", "24h", "7d")
        .optional()
        .default("24h")
        .messages({
          "any.only": "Time range must be one of: 1h, 6h, 24h, 7d",
        }),
    }),
  },
};

/**
 * @route GET /api/admin/health/summary
 * @desc Get health summary for all service instances
 * @access Private (Admin)
 */
router.get("/summary", healthController.getHealthSummary);

/**
 * @route POST /api/admin/health/check
 * @desc Run health check for all service instances
 * @access Private (Admin)
 */
router.post("/check", healthController.runHealthCheck);

/**
 * @route GET /api/admin/health/instances/:id
 * @desc Get detailed health status for a specific instance
 * @access Private (Admin)
 */
router.get(
  "/instances/:id",
  validate(healthValidation.getInstanceHealth),
  healthController.getInstanceHealth
);

/**
 * @route GET /api/admin/health/stats
 * @desc Get health monitoring statistics
 * @access Private (Admin)
 */
router.get(
  "/stats",
  validate(healthValidation.getHealthStats),
  healthController.getHealthStats
);

export default router;
