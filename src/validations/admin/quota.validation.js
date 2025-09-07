import Joi from "joi";

/**
 * Validation schema for updating plan quota
 */
export const updateQuotaValidation = {
  params: Joi.object({
    planId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Plan ID must contain only letters and numbers",
      "string.min": "Plan ID must be at least 20 characters long",
      "string.max": "Plan ID must not exceed 30 characters",
      "any.required": "Plan ID is required",
    }),
  }),

  body: Joi.object({
    totalQuota: Joi.number().integer().min(0).max(10000).required().messages({
      "number.base": "Total quota must be a number",
      "number.integer": "Total quota must be an integer",
      "number.min": "Total quota cannot be negative",
      "number.max": "Total quota cannot exceed 10,000",
      "any.required": "Total quota is required",
    }),

    reason: Joi.string().min(5).max(500).required().messages({
      "string.empty": "Reason is required",
      "string.min": "Reason must be at least 5 characters long",
      "string.max": "Reason cannot exceed 500 characters",
    }),
  }),
};

/**
 * Validation schema for bulk quota updates
 */
export const bulkUpdateQuotasValidation = {
  body: Joi.object({
    updates: Joi.array()
      .items(
        Joi.object({
          planId: Joi.string().alphanum().min(20).max(30).required().messages({
            "string.alphanum": "Plan ID must contain only letters and numbers",
            "string.min": "Plan ID must be at least 20 characters long",
            "string.max": "Plan ID must not exceed 30 characters",
            "any.required": "Plan ID is required",
          }),

          totalQuota: Joi.number()
            .integer()
            .min(0)
            .max(10000)
            .required()
            .messages({
              "number.base": "Total quota must be a number",
              "number.integer": "Total quota must be an integer",
              "number.min": "Total quota cannot be negative",
              "number.max": "Total quota cannot exceed 10,000",
              "any.required": "Total quota is required",
            }),
        })
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        "array.base": "Updates must be an array",
        "array.min": "At least one update is required",
        "array.max": "Cannot update more than 50 plans at once",
        "any.required": "Updates array is required",
      }),

    reason: Joi.string().min(5).max(500).required().messages({
      "string.empty": "Reason is required",
      "string.min": "Reason must be at least 5 characters long",
      "string.max": "Reason cannot exceed 500 characters",
    }),
  }),
};

/**
 * Validation schema for plan ID parameter
 */
export const planIdValidation = {
  params: Joi.object({
    planId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Plan ID must contain only letters and numbers",
      "string.min": "Plan ID must be at least 20 characters long",
      "string.max": "Plan ID must not exceed 30 characters",
      "any.required": "Plan ID is required",
    }),
  }),
};
