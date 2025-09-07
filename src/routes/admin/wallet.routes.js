import express from "express";
import validate from "../../middleware/validate.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  getWalletOverview,
  getUserWalletDetails,
  addCreditToUser,
  deductCreditFromUser,
  getWalletStatistics,
  bulkCreditAdjustment,
} from "../../controllers/admin/wallet.controller.js";
import {
  getWalletOverviewValidation,
  userIdValidation,
  addCreditValidation,
  deductCreditValidation,
  bulkCreditAdjustmentValidation,
} from "../../validations/admin/wallet.validation.js";

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   GET /api/admin/wallets/statistics
 * @desc    Get wallet statistics
 * @access  Admin only
 */
router.get("/statistics", getWalletStatistics);

/**
 * @route   GET /api/admin/wallets/overview
 * @desc    Get wallet overview for all users
 * @access  Admin only
 */
router.get(
  "/overview",
  validate(getWalletOverviewValidation),
  getWalletOverview
);

/**
 * @route   GET /api/admin/wallets/users/:userId
 * @desc    Get detailed wallet information for a specific user
 * @access  Admin only
 */
router.get("/users/:userId", validate(userIdValidation), getUserWalletDetails);

/**
 * @route   POST /api/admin/wallets/users/:userId/add-credit
 * @desc    Add credit to user's wallet (Admin adjustment)
 * @access  Admin only
 */
router.post(
  "/users/:userId/add-credit",
  validate(addCreditValidation),
  addCreditToUser
);

/**
 * @route   POST /api/admin/wallets/users/:userId/deduct-credit
 * @desc    Deduct credit from user's wallet (Admin adjustment)
 * @access  Admin only
 */
router.post(
  "/users/:userId/deduct-credit",
  validate(deductCreditValidation),
  deductCreditFromUser
);

/**
 * @route   POST /api/admin/wallets/bulk-adjustment
 * @desc    Bulk credit adjustment for multiple users
 * @access  Admin only
 */
router.post(
  "/bulk-adjustment",
  validate(bulkCreditAdjustmentValidation),
  bulkCreditAdjustment
);

export default router;
