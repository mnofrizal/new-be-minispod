import express from "express";
import billingController from "../../controllers/admin/billing.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import Joi from "joi";

// Environment configuration
const GRACE_PERIOD_MIN_DAYS = parseInt(process.env.GRACE_PERIOD_MIN_DAYS) || 1;
const GRACE_PERIOD_MAX_DAYS = parseInt(process.env.GRACE_PERIOD_MAX_DAYS) || 30;

const router = express.Router();

// All billing routes require admin authentication
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// Validation schemas
const subscriptionIdValidation = Joi.object({
  subscriptionId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Subscription ID must contain only letters and numbers",
    "string.min": "Subscription ID must be at least 20 characters long",
    "string.max": "Subscription ID must not exceed 30 characters",
    "any.required": "Subscription ID is required",
  }),
});

const jobNameValidation = Joi.object({
  jobName: Joi.string()
    .valid(
      "daily-renewals",
      "grace-period",
      "low-credit-notifications",
      "grace-period-reminders",
      "billing-stats"
    )
    .required()
    .messages({
      "any.only": "Invalid job name",
      "any.required": "Job name is required",
    }),
});

const gracePeriodValidation = Joi.object({
  graceDays: Joi.number()
    .integer()
    .min(GRACE_PERIOD_MIN_DAYS)
    .max(GRACE_PERIOD_MAX_DAYS)
    .optional()
    .messages({
      "number.base": "Grace days must be a number",
      "number.integer": "Grace days must be an integer",
      "number.min": `Grace days must be at least ${GRACE_PERIOD_MIN_DAYS}`,
      "number.max": `Grace days cannot exceed ${GRACE_PERIOD_MAX_DAYS}`,
    }),
});

const expireValidation = Joi.object({
  reason: Joi.string().min(3).max(500).optional().messages({
    "string.min": "Reason must be at least 3 characters long",
    "string.max": "Reason must not exceed 500 characters",
  }),
});

// Billing statistics
router.get("/stats", billingController.getBillingStats);

// Manual renewal processing
router.post("/process-renewals", billingController.processRenewals);

// Manual grace period processing
router.post("/process-grace-period", billingController.processGracePeriod);

// Get low credit subscriptions
router.get("/low-credit", billingController.getLowCreditSubscriptions);

// Send low credit notifications
router.post(
  "/send-low-credit-notifications",
  billingController.sendLowCreditNotifications
);

// Get job status
router.get("/job-status", billingController.getJobStatus);

// Run specific job manually
router.post(
  "/run-job/:jobName",
  validate({ params: jobNameValidation }),
  billingController.runJob
);

// Set grace period for subscription
router.post(
  "/set-grace-period/:subscriptionId",
  validate({
    params: subscriptionIdValidation,
    body: gracePeriodValidation,
  }),
  billingController.setGracePeriod
);

// Expire subscription manually
router.post(
  "/expire/:subscriptionId",
  validate({
    params: subscriptionIdValidation,
    body: expireValidation,
  }),
  billingController.expireSubscription
);

export default router;
