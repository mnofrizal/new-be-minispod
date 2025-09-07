import express from "express";
import validate from "../../middleware/validate.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  getRevenueAnalytics,
  getSubscriptionAnalytics,
  getUserAnalytics,
  getServiceControlMetrics,
  getDashboardAnalytics,
} from "../../controllers/admin/analytics.controller.js";
import { analyticsQueryValidation } from "../../validations/admin/analytics.validation.js";

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   GET /api/admin/analytics/dashboard
 * @desc    Get comprehensive dashboard analytics
 * @access  Admin only
 */
router.get("/dashboard", getDashboardAnalytics);

/**
 * @route   GET /api/admin/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin only
 */
router.get("/revenue", validate(analyticsQueryValidation), getRevenueAnalytics);

/**
 * @route   GET /api/admin/analytics/subscriptions
 * @desc    Get subscription analytics
 * @access  Admin only
 */
router.get(
  "/subscriptions",
  validate(analyticsQueryValidation),
  getSubscriptionAnalytics
);

/**
 * @route   GET /api/admin/analytics/users
 * @desc    Get user analytics
 * @access  Admin only
 */
router.get("/users", validate(analyticsQueryValidation), getUserAnalytics);

/**
 * @route   GET /api/admin/analytics/service-control
 * @desc    Get service control usage metrics
 * @access  Admin only
 */
router.get(
  "/service-control",
  validate(analyticsQueryValidation),
  getServiceControlMetrics
);

export default router;
