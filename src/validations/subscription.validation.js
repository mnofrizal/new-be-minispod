import Joi from "joi";

// Get user subscriptions query validation
export const getUserSubscriptionsValidation = Joi.object({
  status: Joi.string().valid(
    "ACTIVE",
    "SUSPENDED",
    "CANCELLED",
    "EXPIRED",
    "PENDING_UPGRADE",
    "PENDING_PAYMENT"
  ),
  includeInstances: Joi.boolean().default(false),
});

// Subscription ID parameter validation
export const subscriptionIdValidation = Joi.object({
  subscriptionId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Subscription ID must contain only letters and numbers",
    "string.min": "Subscription ID must be at least 20 characters long",
    "string.max": "Subscription ID must not exceed 30 characters",
    "any.required": "Subscription ID is required",
  }),
});

// Create subscription validation (with optional coupon support)
export const createSubscriptionValidation = Joi.object({
  planId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Plan ID must contain only letters and numbers",
    "string.min": "Plan ID must be at least 20 characters long",
    "string.max": "Plan ID must not exceed 30 characters",
    "any.required": "Plan ID is required",
  }),
  couponCode: Joi.string()
    .trim()
    .uppercase()
    .min(3)
    .max(50)
    .pattern(/^[A-Z0-9_-]+$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Coupon code can only contain letters, numbers, hyphens, and underscores",
      "string.min": "Coupon code must be at least 3 characters long",
      "string.max": "Coupon code cannot exceed 50 characters",
    }),
});

// Upgrade subscription validation
export const upgradeSubscriptionValidation = Joi.object({
  newPlanId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "New plan ID must contain only letters and numbers",
    "string.min": "New plan ID must be at least 20 characters long",
    "string.max": "New plan ID must not exceed 30 characters",
    "any.required": "New plan ID is required",
  }),
});

// Cancel subscription validation
export const cancelSubscriptionValidation = Joi.object({
  reason: Joi.string().min(3).max(500).optional().messages({
    "string.min": "Cancellation reason must be at least 3 characters long",
    "string.max": "Cancellation reason must not exceed 500 characters",
  }),
});

// Validate subscription validation (for pre-validation endpoint)
export const validateSubscriptionValidation = Joi.object({
  planId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Plan ID must contain only letters and numbers",
    "string.min": "Plan ID must be at least 20 characters long",
    "string.max": "Plan ID must not exceed 30 characters",
    "any.required": "Plan ID is required",
  }),
});

// Service instance related validations (for future use)
export const instanceIdValidation = Joi.object({
  instanceId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Instance ID must contain only letters and numbers",
    "string.min": "Instance ID must be at least 20 characters long",
    "string.max": "Instance ID must not exceed 30 characters",
    "any.required": "Instance ID is required",
  }),
});

// Get subscription instances validation
export const getSubscriptionInstancesValidation = Joi.object({
  status: Joi.string().valid(
    "PENDING",
    "PROVISIONING",
    "RUNNING",
    "STOPPED",
    "ERROR",
    "TERMINATED",
    "MAINTENANCE"
  ),
  includeMetrics: Joi.boolean().default(false),
});

// Update instance configuration validation (for future use)
export const updateInstanceValidation = Joi.object({
  envVars: Joi.object()
    .pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
    )
    .optional(),
  customDomain: Joi.string().domain().optional().messages({
    "string.domain": "Custom domain must be a valid domain name",
  }),
  sslEnabled: Joi.boolean().optional(),
});

// Instance action validation (start/stop/restart)
export const instanceActionValidation = Joi.object({
  action: Joi.string().valid("start", "stop", "restart").required().messages({
    "any.only": "Action must be one of: start, stop, restart",
    "any.required": "Action is required",
  }),
});

// Subscription statistics validation (for future analytics)
export const getSubscriptionStatsValidation = Joi.object({
  period: Joi.string().valid("day", "week", "month", "year").default("month"),
  includeInstances: Joi.boolean().default(false),
});

// Bulk operations validation (for future admin features)
export const bulkSubscriptionActionValidation = Joi.object({
  subscriptionIds: Joi.array()
    .items(Joi.string().alphanum().min(20).max(30))
    .min(1)
    .max(50)
    .required()
    .messages({
      "array.min": "At least one subscription ID is required",
      "array.max": "Cannot process more than 50 subscriptions at once",
      "any.required": "Subscription IDs are required",
    }),
  action: Joi.string()
    .valid("suspend", "resume", "cancel")
    .required()
    .messages({
      "any.only": "Action must be one of: suspend, resume, cancel",
      "any.required": "Action is required",
    }),
  reason: Joi.string().min(3).max(500).optional().messages({
    "string.min": "Reason must be at least 3 characters long",
    "string.max": "Reason must not exceed 500 characters",
  }),
});

// Toggle auto-renew validation
export const toggleAutoRenewValidation = Joi.object({
  autoRenew: Joi.boolean().required().messages({
    "boolean.base": "Auto-renew must be a boolean value",
    "any.required": "Auto-renew setting is required",
  }),
});
