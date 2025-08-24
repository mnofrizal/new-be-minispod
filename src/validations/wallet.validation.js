import Joi from "joi";

// Transaction history query validation
export const getTransactionHistoryValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid(
    "TOP_UP",
    "SUBSCRIPTION",
    "UPGRADE",
    "REFUND",
    "ADMIN_ADJUSTMENT"
  ),
  status: Joi.string().valid("PENDING", "COMPLETED", "FAILED", "CANCELLED"),
  startDate: Joi.date().iso(),
  endDate: Joi.date()
    .iso()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")),
      otherwise: Joi.optional(),
    }),
});

// Top-up creation validation
export const createTopUpValidation = Joi.object({
  amount: Joi.number().integer().min(10000).max(10000000).required().messages({
    "number.min": "Minimum top-up amount is Rp 10,000",
    "number.max": "Maximum top-up amount is Rp 10,000,000",
    "any.required": "Amount is required",
  }),
  paymentMethod: Joi.string()
    .valid("BANK_TRANSFER", "E_WALLET", "CREDIT_CARD", "QRIS")
    .required()
    .messages({
      "any.only":
        "Payment method must be one of: BANK_TRANSFER, E_WALLET, CREDIT_CARD, QRIS",
      "any.required": "Payment method is required",
    }),
});

// Transaction ID parameter validation
export const transactionIdValidation = Joi.object({
  transactionId: Joi.string().alphanum().min(20).max(30).required().messages({
    "string.alphanum": "Transaction ID must contain only letters and numbers",
    "string.min": "Transaction ID must be at least 20 characters long",
    "string.max": "Transaction ID must not exceed 30 characters",
    "any.required": "Transaction ID is required",
  }),
});

// Wallet statistics query validation
export const getWalletStatisticsValidation = Joi.object({
  period: Joi.string().valid("day", "week", "month", "year").default("month"),
});

// Credit check validation
export const checkCreditValidation = Joi.object({
  amount: Joi.number().integer().min(1).required().messages({
    "number.min": "Amount must be greater than 0",
    "any.required": "Amount is required",
  }),
});

// Webhook notification validation (basic structure)
export const midtransWebhookValidation = Joi.object({
  order_id: Joi.string().required(),
  transaction_status: Joi.string().required(),
  fraud_status: Joi.string().optional(),
  payment_type: Joi.string().optional(),
  transaction_time: Joi.string().optional(),
  signature_key: Joi.string().optional(),
  // Allow additional fields from Midtrans
}).unknown(true);
