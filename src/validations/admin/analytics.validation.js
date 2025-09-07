import Joi from "joi";

/**
 * Validation schema for analytics query parameters
 */
export const analyticsQueryValidation = {
  query: Joi.object({
    period: Joi.string()
      .valid("7d", "30d", "90d", "1y")
      .default("30d")
      .messages({
        "any.only": "Period must be one of: 7d, 30d, 90d, 1y",
      }),

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
      "object.with": "Both startDate and endDate must be provided together",
    }),
};
