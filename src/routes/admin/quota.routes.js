import express from "express";
import validate from "../../middleware/validate.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  getQuotaOverview,
  getPlanQuotaDetails,
  updatePlanQuota,
  getQuotaStatistics,
  bulkUpdateQuotas,
} from "../../controllers/admin/quota.controller.js";
import {
  updateQuotaValidation,
  bulkUpdateQuotasValidation,
  planIdValidation,
} from "../../validations/admin/quota.validation.js";

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   GET /api/admin/quota/statistics
 * @desc    Get quota utilization statistics
 * @access  Admin only
 */
router.get("/statistics", getQuotaStatistics);

/**
 * @route   GET /api/admin/quota/overview
 * @desc    Get quota overview for all service plans
 * @access  Admin only
 */
router.get("/overview", getQuotaOverview);

/**
 * @route   GET /api/admin/quota/plans/:planId
 * @desc    Get detailed quota information for a specific service plan
 * @access  Admin only
 */
router.get("/plans/:planId", validate(planIdValidation), getPlanQuotaDetails);

/**
 * @route   PUT /api/admin/quota/plans/:planId
 * @desc    Update quota for a service plan
 * @access  Admin only
 */
router.put("/plans/:planId", validate(updateQuotaValidation), updatePlanQuota);

/**
 * @route   PUT /api/admin/quota/bulk-update
 * @desc    Bulk update quotas for multiple plans
 * @access  Admin only
 */
router.put(
  "/bulk-update",
  validate(bulkUpdateQuotasValidation),
  bulkUpdateQuotas
);

export default router;
