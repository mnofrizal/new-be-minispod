import Joi from "joi";

const adminSubscriptionValidation = {
  /**
   * Validation for admin create subscription for user
   */
  createSubscriptionForUser: {
    body: Joi.object({
      userId: Joi.string().required().messages({
        "string.empty": "User ID is required",
        "any.required": "User ID is required",
      }),
      planId: Joi.string().required().messages({
        "string.empty": "Plan ID is required",
        "any.required": "Plan ID is required",
      }),
      skipCreditCheck: Joi.boolean().default(false).messages({
        "boolean.base": "Skip credit check must be a boolean value",
      }),
      reason: Joi.string().min(10).max(500).optional().messages({
        "string.min": "Reason must be at least 10 characters long",
        "string.max": "Reason cannot exceed 500 characters",
      }),
    }),
  },

  /**
   * Validation for force cancel subscription
   */
  forceCancelSubscription: {
    params: Joi.object({
      subscriptionId: Joi.string().required().messages({
        "string.empty": "Subscription ID is required",
        "any.required": "Subscription ID is required",
      }),
    }),
    body: Joi.object({
      reason: Joi.string().min(10).max(500).required().messages({
        "string.empty": "Cancellation reason is required",
        "string.min": "Reason must be at least 10 characters long",
        "string.max": "Reason cannot exceed 500 characters",
        "any.required": "Cancellation reason is required",
      }),
      terminateInstances: Joi.boolean().default(true).messages({
        "boolean.base": "Terminate instances must be a boolean value",
      }),
    }),
  },

  /**
   * Validation for process refund
   */
  processRefund: {
    params: Joi.object({
      subscriptionId: Joi.string().required().messages({
        "string.empty": "Subscription ID is required",
        "any.required": "Subscription ID is required",
      }),
    }),
    body: Joi.object({
      amount: Joi.number()
        .integer()
        .min(1000)
        .max(10000000)
        .required()
        .messages({
          "number.base": "Refund amount must be a number",
          "number.integer": "Refund amount must be an integer",
          "number.min": "Minimum refund amount is Rp 1,000",
          "number.max": "Maximum refund amount is Rp 10,000,000",
          "any.required": "Refund amount is required",
        }),
      reason: Joi.string().min(10).max(500).required().messages({
        "string.empty": "Refund reason is required",
        "string.min": "Reason must be at least 10 characters long",
        "string.max": "Reason cannot exceed 500 characters",
        "any.required": "Refund reason is required",
      }),
      refundType: Joi.string()
        .valid("PARTIAL", "FULL")
        .default("PARTIAL")
        .messages({
          "string.base": "Refund type must be a string",
          "any.only": "Refund type must be either PARTIAL or FULL",
        }),
    }),
  },

  /**
   * Validation for extend subscription
   */
  extendSubscription: {
    params: Joi.object({
      subscriptionId: Joi.string().required().messages({
        "string.empty": "Subscription ID is required",
        "any.required": "Subscription ID is required",
      }),
    }),
    body: Joi.object({
      extensionDays: Joi.number()
        .integer()
        .min(1)
        .max(365)
        .required()
        .messages({
          "number.base": "Extension days must be a number",
          "number.integer": "Extension days must be an integer",
          "number.min": "Minimum extension is 1 day",
          "number.max": "Maximum extension is 365 days",
          "any.required": "Extension days is required",
        }),
      reason: Joi.string().min(10).max(500).required().messages({
        "string.empty": "Extension reason is required",
        "string.min": "Reason must be at least 10 characters long",
        "string.max": "Reason cannot exceed 500 characters",
        "any.required": "Extension reason is required",
      }),
    }),
  },

  /**
   * Validation for get all subscriptions query parameters
   */
  getAllSubscriptions: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1).messages({
        "number.base": "Page must be a number",
        "number.integer": "Page must be an integer",
        "number.min": "Page must be at least 1",
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
      status: Joi.string()
        .valid("ACTIVE", "CANCELLED", "PENDING_PAYMENT", "PENDING_UPGRADE")
        .messages({
          "string.base": "Status must be a string",
          "any.only":
            "Status must be one of: ACTIVE, CANCELLED, PENDING_PAYMENT, PENDING_UPGRADE",
        }),
      serviceId: Joi.string().messages({
        "string.base": "Service ID must be a string",
      }),
      userId: Joi.string().messages({
        "string.base": "User ID must be a string",
      }),
      search: Joi.string().min(2).max(100).messages({
        "string.base": "Search must be a string",
        "string.min": "Search must be at least 2 characters long",
        "string.max": "Search cannot exceed 100 characters",
      }),
    }),
  },

  /**
   * Validation for subscription stats query parameters
   */
  getSubscriptionStats: {
    query: Joi.object({
      startDate: Joi.date().iso().messages({
        "date.base": "Start date must be a valid date",
        "date.format": "Start date must be in ISO format (YYYY-MM-DD)",
      }),
      endDate: Joi.date().iso().min(Joi.ref("startDate")).messages({
        "date.base": "End date must be a valid date",
        "date.format": "End date must be in ISO format (YYYY-MM-DD)",
        "date.min": "End date must be after start date",
      }),
    })
      .with("startDate", "endDate")
      .messages({
        "object.with":
          "Both start date and end date are required when filtering by date",
      }),
  },

  /**
   * Validation for upgrade subscription
   */
  upgradeSubscription: {
    params: Joi.object({
      subscriptionId: Joi.string().required().messages({
        "string.empty": "Subscription ID is required",
        "any.required": "Subscription ID is required",
      }),
    }),
    body: Joi.object({
      newPlanId: Joi.string().required().messages({
        "string.empty": "New plan ID is required",
        "any.required": "New plan ID is required",
      }),
      skipCreditCheck: Joi.boolean().default(false).messages({
        "boolean.base": "Skip credit check must be a boolean value",
      }),
      reason: Joi.string().min(10).max(500).optional().messages({
        "string.min": "Reason must be at least 10 characters long",
        "string.max": "Reason cannot exceed 500 characters",
      }),
    }),
  },
};

export default adminSubscriptionValidation;
