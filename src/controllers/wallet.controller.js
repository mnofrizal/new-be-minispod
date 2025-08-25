import { StatusCodes } from "http-status-codes";
import sendResponse from "../utils/response.js";
import creditService from "../services/credit.service.js";
import midtransService from "../services/payment/midtrans.service.js";
import transactionService from "../services/transaction.service.js";

/**
 * Get user wallet information (balance, statistics, recent transactions)
 * GET /api/wallet/info
 */
const getWalletInfo = async (req, res) => {
  try {
    const userId = req.user.userId;

    const walletInfo = await creditService.getUserCreditInfo(userId);

    sendResponse(
      res,
      StatusCodes.OK,
      { wallet: walletInfo },
      "Wallet information retrieved successfully"
    );
  } catch (error) {
    console.error("Get wallet info error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve wallet information"
    );
  }
};

/**
 * Get transaction history with filtering and pagination
 * GET /api/wallet/transactions
 */
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      type,
      status,
      startDate,
      endDate,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status,
      startDate,
      endDate,
    };

    const result = await creditService.getTransactionHistory(userId, options);

    sendResponse(
      res,
      StatusCodes.OK,
      {
        transactions: result.transactions,
        pagination: result.pagination,
      },
      "Transaction history retrieved successfully"
    );
  } catch (error) {
    console.error("Get transaction history error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve transaction history"
    );
  }
};

/**
 * Create credit top-up transaction
 * POST /api/wallet/topup
 */
const createTopUp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod } = req.body;

    // Create Midtrans transaction
    const topUpTransaction = await midtransService.createTopUpTransaction(
      userId,
      amount,
      paymentMethod
    );

    sendResponse(
      res,
      StatusCodes.CREATED,
      { transaction: topUpTransaction },
      "Top-up transaction created successfully"
    );
  } catch (error) {
    console.error("Create top-up error:", error);
    if (error.message.includes("Minimum top-up")) {
      sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    } else {
      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to create top-up transaction"
      );
    }
  }
};

/**
 * Get available payment methods
 * GET /api/wallet/payment-methods
 */
const getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = midtransService.getAvailablePaymentMethods();

    sendResponse(
      res,
      StatusCodes.OK,
      { paymentMethods },
      "Payment methods retrieved successfully"
    );
  } catch (error) {
    console.error("Get payment methods error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve payment methods"
    );
  }
};

/**
 * Check transaction status
 * GET /api/wallet/transactions/:transactionId/status
 */
const checkTransactionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    // Get transaction details (ensure user can only access their own transactions)
    const transaction = await transactionService.getTransactionById(
      transactionId,
      userId
    );

    // If it's a Midtrans transaction and pending, check with Midtrans
    if (
      transaction.paymentMethod?.startsWith("MIDTRANS_") &&
      transaction.status === "PENDING"
    ) {
      try {
        const midtransStatus = await midtransService.checkTransactionStatus(
          transactionId
        );
        sendResponse(
          res,
          StatusCodes.OK,
          {
            transaction: {
              id: transaction.id,
              status: transaction.status,
              amount: transaction.amount,
              type: transaction.type,
              description: transaction.description,
              createdAt: transaction.createdAt,
              completedAt: transaction.completedAt,
              midtransStatus,
            },
          },
          "Transaction status retrieved successfully"
        );
      } catch (midtransError) {
        // If Midtrans check fails, return local transaction status
        sendResponse(
          res,
          StatusCodes.OK,
          {
            transaction: {
              id: transaction.id,
              status: transaction.status,
              amount: transaction.amount,
              type: transaction.type,
              description: transaction.description,
              createdAt: transaction.createdAt,
              completedAt: transaction.completedAt,
            },
          },
          "Transaction status retrieved successfully"
        );
      }
    } else {
      sendResponse(
        res,
        StatusCodes.OK,
        {
          transaction: {
            id: transaction.id,
            status: transaction.status,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            createdAt: transaction.createdAt,
            completedAt: transaction.completedAt,
          },
        },
        "Transaction status retrieved successfully"
      );
    }
  } catch (error) {
    console.error("Check transaction status error:", error);
    if (error.message.includes("not found")) {
      sendResponse(res, StatusCodes.NOT_FOUND, null, "Transaction not found");
    } else {
      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to check transaction status"
      );
    }
  }
};

/**
 * Cancel pending transaction
 * POST /api/wallet/transactions/:transactionId/cancel
 */
const cancelTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    // Verify transaction belongs to user
    const transaction = await transactionService.getTransactionById(
      transactionId,
      userId
    );

    if (transaction.status !== "PENDING") {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only cancel pending transactions"
      );
    }

    // Cancel with Midtrans if it's a Midtrans transaction
    if (transaction.paymentMethod?.startsWith("MIDTRANS_")) {
      await midtransService.cancelTransaction(transactionId);
    } else {
      // Update local transaction status
      await transactionService.updateTransactionStatus(
        transactionId,
        "CANCELLED"
      );
    }

    sendResponse(
      res,
      StatusCodes.OK,
      null,
      "Transaction cancelled successfully"
    );
  } catch (error) {
    console.error("Cancel transaction error:", error);
    if (error.message.includes("not found")) {
      sendResponse(res, StatusCodes.NOT_FOUND, null, "Transaction not found");
    } else if (error.message.includes("Can only cancel")) {
      sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    } else {
      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to cancel transaction"
      );
    }
  }
};

/**
 * Handle Midtrans webhook notification
 * POST /api/wallet/webhook/midtrans
 */
const handleMidtransWebhook = async (req, res) => {
  try {
    const notification = req.body;

    const result = await midtransService.handleNotification(notification);

    // Return success response to Midtrans
    res.status(StatusCodes.OK).json({
      success: result.success,
      message: result.message || "Notification processed",
    });
  } catch (error) {
    console.error("Midtrans webhook error:", error);

    // Return success to avoid retry loop, but log the error
    res.status(StatusCodes.OK).json({
      success: false,
      message: "Notification received but processing failed",
    });
  }
};

/**
 * Get wallet statistics (for user dashboard)
 * GET /api/wallet/statistics
 */
const getWalletStatistics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = "month" } = req.query;

    const stats = await transactionService.getTransactionStatistics({
      userId,
      period,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      { statistics: stats },
      "Wallet statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Get wallet statistics error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve wallet statistics"
    );
  }
};

/**
 * Check credit sufficiency for a specific amount
 * POST /api/wallet/check-credit
 */
const checkCreditSufficiency = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Valid amount is required"
      );
    }

    const creditCheck = await creditService.checkSufficientCredit(
      userId,
      amount
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { creditCheck },
      "Credit check completed"
    );
  } catch (error) {
    console.error("Check credit error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to check credit sufficiency"
    );
  }
};

export default {
  getWalletInfo,
  getTransactionHistory,
  createTopUp,
  getPaymentMethods,
  checkTransactionStatus,
  cancelTransaction,
  handleMidtransWebhook,
  getWalletStatistics,
  checkCreditSufficiency,
};
