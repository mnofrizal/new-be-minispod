import express from "express";
import walletController from "../controllers/wallet.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  getTransactionHistoryValidation,
  createTopUpValidation,
  transactionIdValidation,
  getWalletStatisticsValidation,
  checkCreditValidation,
  midtransWebhookValidation,
} from "../validations/wallet.validation.js";
import couponValidation from "../validations/coupon.validation.js";

const router = express.Router();

// User wallet endpoints (require authentication)
router.get("/info", authenticateToken, walletController.getWalletInfo);

router.get(
  "/transactions",
  authenticateToken,
  validate({ query: getTransactionHistoryValidation }),
  walletController.getTransactionHistory
);

router.post(
  "/topup",
  authenticateToken,
  validate({ body: createTopUpValidation }),
  walletController.createTopUp
);

router.get(
  "/payment-methods",
  authenticateToken,
  walletController.getPaymentMethods
);

router.get(
  "/transactions/:transactionId/status",
  authenticateToken,
  validate({ params: transactionIdValidation }),
  walletController.checkTransactionStatus
);

router.post(
  "/transactions/:transactionId/cancel",
  authenticateToken,
  validate({ params: transactionIdValidation }),
  walletController.cancelTransaction
);

router.get(
  "/statistics",
  authenticateToken,
  validate({ query: getWalletStatisticsValidation }),
  walletController.getWalletStatistics
);

router.post(
  "/check-credit",
  authenticateToken,
  validate({ body: checkCreditValidation }),
  walletController.checkCreditSufficiency
);

// Coupon endpoints
router.post(
  "/validate-coupon",
  authenticateToken,
  validate({ body: couponValidation.validateCouponSchema }),
  walletController.validateCoupon
);

router.post(
  "/redeem-coupon",
  authenticateToken,
  validate({ body: couponValidation.redeemCouponSchema }),
  walletController.redeemCoupon
);

router.get(
  "/coupon-history",
  authenticateToken,
  validate({ query: couponValidation.couponHistorySchema }),
  walletController.getCouponHistory
);

// Webhook endpoint (no authentication - Midtrans will call this)
router.post(
  "/webhook/midtrans",
  validate({ body: midtransWebhookValidation }),
  walletController.handleMidtransWebhook
);

export default router;
