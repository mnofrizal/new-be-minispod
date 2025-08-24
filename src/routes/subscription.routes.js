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

// Upgrade subscription
router.put(
  "/:subscriptionId/upgrade",
  validate({
    params: subscriptionIdValidation,
    body: upgradeSubscriptionValidation,
  }),
  subscriptionController.upgradeSubscription
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
