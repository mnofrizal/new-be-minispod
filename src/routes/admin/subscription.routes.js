import express from "express";
import adminSubscriptionController from "../../controllers/admin/subscription.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import adminSubscriptionValidation from "../../validations/admin/subscription.validation.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   POST /api/admin/subscriptions
 * @desc    Create subscription for a user (admin only)
 * @access  Admin only
 */
router.post(
  "/",
  validate(adminSubscriptionValidation.createSubscriptionForUser),
  adminSubscriptionController.createSubscriptionForUser
);

/**
 * @route   GET /api/admin/subscriptions
 * @desc    Get all subscriptions with filtering and pagination
 * @access  Admin only
 */
router.get("/", adminSubscriptionController.getAllSubscriptions);

/**
 * @route   GET /api/admin/subscriptions/stats
 * @desc    Get subscription statistics for admin dashboard
 * @access  Admin only
 */
router.get("/stats", adminSubscriptionController.getSubscriptionStats);

/**
 * @route   DELETE /api/admin/subscriptions/:subscriptionId/force-cancel
 * @desc    Force cancel subscription immediately (admin only)
 * @access  Admin only
 */
router.delete(
  "/:subscriptionId/force-cancel",
  validate(adminSubscriptionValidation.forceCancelSubscription),
  adminSubscriptionController.forceCancelSubscription
);

/**
 * @route   POST /api/admin/subscriptions/:subscriptionId/refund
 * @desc    Process manual refund for subscription
 * @access  Admin only
 */
router.post(
  "/:subscriptionId/refund",
  validate(adminSubscriptionValidation.processRefund),
  adminSubscriptionController.processRefund
);

/**
 * @route   PUT /api/admin/subscriptions/:subscriptionId/extend
 * @desc    Extend subscription end date
 * @access  Admin only
 */
router.put(
  "/:subscriptionId/extend",
  validate(adminSubscriptionValidation.extendSubscription),
  adminSubscriptionController.extendSubscription
);

/**
 * @route   PUT /api/admin/subscriptions/:subscriptionId/upgrade
 * @desc    Upgrade subscription for user (admin only)
 * @access  Admin only
 */
router.put(
  "/:subscriptionId/upgrade",
  validate(adminSubscriptionValidation.upgradeSubscription),
  adminSubscriptionController.upgradeSubscriptionForUser
);

export default router;
