import Joi from "joi";

/**
 * Validation schema for getting wallet overview
 */
export const getWalletOverviewValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),

    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),

    search: Joi.string().min(1).max(100).messages({
      "string.min": "Search term must be at least 1 character long",
      "string.max": "Search term cannot exceed 100 characters",
    }),

    sortBy: Joi.string()
      .valid("creditBalance", "totalTopUp", "totalSpent", "createdAt")
      .default("totalSpent")
      .messages({
        "any.only":
          "sortBy must be one of: creditBalance, totalTopUp, totalSpent, createdAt",
      }),

    sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
      "any.only": 'sortOrder must be either "asc" or "desc"',
    }),

    minBalance: Joi.number().integer().messages({
      "number.base": "Minimum balance must be a number",
      "number.integer": "Minimum balance must be an integer",
    }),

    maxBalance: Joi.number().integer().messages({
      "number.base": "Maximum balance must be a number",
      "number.integer": "Maximum balance must be an integer",
    }),
  }),
};

/**
 * Validation schema for user ID parameter
 */
export const userIdValidation = {
  params: Joi.object({
    userId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "User ID must contain only letters and numbers",
      "string.min": "User ID must be at least 20 characters long",
      "string.max": "User ID must not exceed 30 characters",
      "any.required": "User ID is required",
    }),
  }),
};

/**
 * Validation schema for adding credit to user
 */
export const addCreditValidation = {
  params: Joi.object({
    userId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "User ID must contain only letters and numbers",
      "string.min": "User ID must be at least 20 characters long",
      "string.max": "User ID must not exceed 30 characters",
      "any.required": "User ID is required",
    }),
  }),

  body: Joi.object({
    amount: Joi.number()
      .integer()
      .min(1000)
      .max(100000000)
      .required()
      .messages({
        "number.base": "Amount must be a number",
        "number.integer": "Amount must be an integer",
        "number.min": "Amount must be at least 1,000 IDR",
        "number.max": "Amount cannot exceed 100,000,000 IDR",
        "any.required": "Amount is required",
      }),

    reason: Joi.string().min(5).max(200).required().messages({
      "string.empty": "Reason is required",
      "string.min": "Reason must be at least 5 characters long",
      "string.max": "Reason cannot exceed 200 characters",
    }),

    description: Joi.string().max(500).messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
  }),
};

/**
 * Validation schema for deducting credit from user
 */
export const deductCreditValidation = {
  params: Joi.object({
    userId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "User ID must contain only letters and numbers",
      "string.min": "User ID must be at least 20 characters long",
      "string.max": "User ID must not exceed 30 characters",
      "any.required": "User ID is required",
    }),
  }),

  body: Joi.object({
    amount: Joi.number()
      .integer()
      .min(1000)
      .max(100000000)
      .required()
      .messages({
        "number.base": "Amount must be a number",
        "number.integer": "Amount must be an integer",
        "number.min": "Amount must be at least 1,000 IDR",
        "number.max": "Amount cannot exceed 100,000,000 IDR",
        "any.required": "Amount is required",
      }),

    reason: Joi.string().min(5).max(200).required().messages({
      "string.empty": "Reason is required",
      "string.min": "Reason must be at least 5 characters long",
      "string.max": "Reason cannot exceed 200 characters",
    }),

    description: Joi.string().max(500).messages({
      "string.max": "Description cannot exceed 500 characters",
    }),

    allowNegative: Joi.boolean().default(false).messages({
      "boolean.base": "allowNegative must be a boolean value",
    }),
  }),
};

/**
 * Validation schema for bulk credit adjustment
 */
export const bulkCreditAdjustmentValidation = {
  body: Joi.object({
    adjustments: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().alphanum().min(20).max(30).required().messages({
            "string.alphanum": "User ID must contain only letters and numbers",
            "string.min": "User ID must be at least 20 characters long",
            "string.max": "User ID must not exceed 30 characters",
            "any.required": "User ID is required",
          }),

          type: Joi.string().valid("ADD", "DEDUCT").required().messages({
            "any.only": 'Type must be either "ADD" or "DEDUCT"',
            "any.required": "Type is required",
          }),

          amount: Joi.number()
            .integer()
            .min(1000)
            .max(100000000)
            .required()
            .messages({
              "number.base": "Amount must be a number",
              "number.integer": "Amount must be an integer",
              "number.min": "Amount must be at least 1,000 IDR",
              "number.max": "Amount cannot exceed 100,000,000 IDR",
              "any.required": "Amount is required",
            }),

          allowNegative: Joi.boolean().default(false).messages({
            "boolean.base": "allowNegative must be a boolean value",
          }),
        })
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.base": "Adjustments must be an array",
        "array.min": "At least one adjustment is required",
        "array.max": "Cannot process more than 100 adjustments at once",
        "any.required": "Adjustments array is required",
      }),

    reason: Joi.string().min(5).max(200).required().messages({
      "string.empty": "Reason is required",
      "string.min": "Reason must be at least 5 characters long",
      "string.max": "Reason cannot exceed 200 characters",
    }),

    description: Joi.string().max(500).messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
  }),
};
