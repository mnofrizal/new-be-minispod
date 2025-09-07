import express from "express";
import subscriptionController from "../controllers/subscription.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  getUserSubscriptionsValidation,
  subscriptionIdValidation,
  createSubscriptionValidation,
  upgradeSubscriptionValidation,
  cancelSubscriptionValidation,
  validateSubscriptionValidation,
  toggleAutoRenewValidation,
} from "../validations/subscription.validation.js";

const router = express.Router();

// All subscription routes require authentication
router.use(authenticateToken);

// Get user's subscriptions
router.get(
  "/",
  validate({ query: getUserSubscriptionsValidation }),
  subscriptionController.getUserSubscriptions
);

// Validate subscription before creation
router.post(
  "/validate",
  validate({ body: validateSubscriptionValidation }),
  subscriptionController.validateSubscription
);

// Create new subscription
router.post(
  "/",
  validate({ body: createSubscriptionValidation }),
  subscriptionController.createSubscription
);

// Get subscription details
router.get(
  "/:subscriptionId",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.getSubscriptionDetails
);

// Get subscription metrics
router.get(
  "/:subscriptionId/metrics",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.getSubscriptionMetrics
);

// Get subscription billing info with available upgrade plans
router.get(
  "/:subscriptionId/billing-info",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.getAvailableUpgrades
);

// Upgrade subscription
router.put(
  "/:subscriptionId/upgrade",
  validate({
    params: subscriptionIdValidation,
    body: upgradeSubscriptionValidation,
  }),
  subscriptionController.upgradeSubscription
);

// Retry provisioning for subscription
router.post(
  "/:subscriptionId/retry-provisioning",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.retryProvisioning
);

// Restart subscription service instance
router.post(
  "/:subscriptionId/restart",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.restartSubscription
);

// Stop subscription service temporarily
router.put(
  "/:subscriptionId/stop",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.stopSubscription
);

// Start subscription service from stopped state
router.put(
  "/:subscriptionId/start",
  validate({ params: subscriptionIdValidation }),
  subscriptionController.startSubscription
);

// Toggle auto-renew setting
router.put(
  "/:subscriptionId/auto-renew",
  validate({
    params: subscriptionIdValidation,
    body: toggleAutoRenewValidation,
  }),
  subscriptionController.toggleAutoRenew
);

// Cancel subscription
router.delete(
  "/:subscriptionId",
  validate({
    params: subscriptionIdValidation,
    body: cancelSubscriptionValidation,
  }),
  subscriptionController.cancelSubscription
);

export default router;
