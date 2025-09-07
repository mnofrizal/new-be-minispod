import Joi from "joi";

// Common coupon code validation
const couponCodeSchema = Joi.string()
  .trim()
  .uppercase()
  .min(3)
  .max(50)
  .pattern(/^[A-Z0-9_-]+$/)
  .messages({
    "string.pattern.base":
      "Coupon code can only contain letters, numbers, hyphens, and underscores",
    "string.min": "Coupon code must be at least 3 characters long",
    "string.max": "Coupon code cannot exceed 50 characters",
  });

// Validate coupon schema
const validateCouponSchema = Joi.object({
  couponCode: couponCodeSchema.required(),
  serviceId: Joi.string().optional(),
  subscriptionAmount: Joi.number().integer().min(0).optional(),
});

// Redeem credit top-up coupon schema
const redeemCouponSchema = Joi.object({
  couponCode: couponCodeSchema.required(),
});

// Coupon history query schema
const couponHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string()
    .valid(
      "CREDIT_TOPUP",
      "SUBSCRIPTION_DISCOUNT",
      "FREE_SERVICE",
      "WELCOME_BONUS"
    )
    .optional(),
});

// Admin create coupon schema
const createCouponSchema = Joi.object({
  code: couponCodeSchema.required(),
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional().allow(""),
  type: Joi.string()
    .valid(
      "CREDIT_TOPUP",
      "SUBSCRIPTION_DISCOUNT",
      "FREE_SERVICE",
      "WELCOME_BONUS"
    )
    .required(),

  // Credit amount for CREDIT_TOPUP and FIXED_AMOUNT discounts
  creditAmount: Joi.number().integer().min(1000).max(10000000).optional(),

  // Discount configuration for SUBSCRIPTION_DISCOUNT
  discountType: Joi.string().valid("FIXED_AMOUNT", "PERCENTAGE").optional(),
  discountPercent: Joi.number().integer().min(1).max(100).optional(),

  // Usage limits
  maxUses: Joi.number().integer().min(1).max(1000000).default(1),
  maxUsesPerUser: Joi.number().integer().min(1).max(100).default(1),

  // Service restrictions
  serviceId: Joi.string().optional(),
  planType: Joi.string()
    .valid("FREE", "BASIC", "PRO", "PREMIUM", "ENTERPRISE")
    .optional(),

  // Validity period
  validFrom: Joi.date().iso().optional(),
  validUntil: Joi.date().iso().min("now").optional(),
})
  .custom((value, helpers) => {
    // Custom validation for coupon type specific fields
    const {
      type,
      creditAmount,
      discountType,
      discountPercent,
      serviceId,
      validFrom,
      validUntil,
    } = value;

    // Validate date relationship
    if (
      validFrom &&
      validUntil &&
      new Date(validUntil) <= new Date(validFrom)
    ) {
      return helpers.error("custom.validUntilMustBeAfterValidFrom");
    }

    if (type === "CREDIT_TOPUP" || type === "WELCOME_BONUS") {
      if (!creditAmount) {
        return helpers.error("custom.creditAmountRequired");
      }
    }

    if (type === "SUBSCRIPTION_DISCOUNT") {
      if (!discountType) {
        return helpers.error("custom.discountTypeRequired");
      }
      if (discountType === "FIXED_AMOUNT" && !creditAmount) {
        return helpers.error("custom.creditAmountRequiredForFixed");
      }
      if (discountType === "PERCENTAGE" && !discountPercent) {
        return helpers.error("custom.discountPercentRequired");
      }
    }

    if (type === "FREE_SERVICE") {
      if (!serviceId) {
        return helpers.error("custom.serviceIdRequired");
      }
    }

    return value;
  }, "Coupon type validation")
  .messages({
    "custom.creditAmountRequired":
      "Credit amount is required for credit top-up and welcome bonus coupons",
    "custom.discountTypeRequired":
      "Discount type is required for subscription discount coupons",
    "custom.creditAmountRequiredForFixed":
      "Credit amount is required for fixed amount discount coupons",
    "custom.discountPercentRequired":
      "Discount percentage is required for percentage discount coupons",
    "custom.serviceIdRequired":
      "Service ID is required for free service coupons",
    "custom.validUntilMustBeAfterValidFrom":
      "Valid until date must be after valid from date",
  });

// Admin update coupon schema
const updateCouponSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(""),
  status: Joi.string().valid("ACTIVE", "EXPIRED", "DISABLED").optional(),
  maxUses: Joi.number().integer().min(1).max(1000000).optional(),
  maxUsesPerUser: Joi.number().integer().min(1).max(100).optional(),
  validFrom: Joi.date().iso().optional(),
  validUntil: Joi.date().iso().optional(),
});

// Admin list coupons query schema
const listCouponsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid("ACTIVE", "EXPIRED", "DISABLED", "USED_UP")
    .optional(),
  type: Joi.string()
    .valid(
      "CREDIT_TOPUP",
      "SUBSCRIPTION_DISCOUNT",
      "FREE_SERVICE",
      "WELCOME_BONUS"
    )
    .optional(),
  serviceId: Joi.string().optional(),
  search: Joi.string().trim().min(1).max(100).optional(),
});

// Admin coupon statistics query schema
const couponStatisticsSchema = Joi.object({
  period: Joi.string().valid("week", "month", "year").default("month"),
});

// Admin bulk update status schema
const bulkUpdateStatusSchema = Joi.object({
  couponIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
  status: Joi.string().valid("ACTIVE", "DISABLED", "EXPIRED").required(),
});

// Subscription creation with coupon schema (extends existing)
const subscriptionWithCouponSchema = Joi.object({
  planId: Joi.string().required(),
  couponCode: couponCodeSchema.optional(),
});

// Coupon ID parameter validation
const couponIdSchema = Joi.object({
  couponId: Joi.string().required(),
});

export default {
  // User validations
  validateCouponSchema,
  redeemCouponSchema,
  couponHistorySchema,
  subscriptionWithCouponSchema,

  // Admin validations
  createCouponSchema,
  updateCouponSchema,
  listCouponsSchema,
  couponStatisticsSchema,
  bulkUpdateStatusSchema,
  couponIdSchema,
};
