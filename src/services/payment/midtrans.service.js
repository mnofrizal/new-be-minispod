import { snap, coreApi } from "../../config/midtrans.js";
import prisma from "../../utils/prisma.js";
import creditService from "../credit.service.js";

class MidtransService {
  /**
   * Create a top-up transaction with Midtrans
   * @param {string} userId - User ID
   * @param {number} amount - Amount in IDR
   * @param {string} paymentMethod - Payment method type
   * @returns {Promise<Object>} Midtrans transaction details
   */
  async createTopUpTransaction(userId, amount, paymentMethod) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Validate amount (minimum 10,000 IDR)
    if (amount < 10000) {
      throw new Error("Minimum top-up amount is Rp 10,000");
    }

    // Create transaction record first
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: "TOP_UP",
        status: "PENDING",
        amount,
        balanceBefore: user.creditBalance || 0,
        balanceAfter: user.creditBalance || 0, // Will be updated after payment
        description: `Top-up credit via ${paymentMethod}`,
        paymentMethod: `MIDTRANS_${paymentMethod.toUpperCase()}`,
        paymentReference: null, // Will be set after Midtrans response
      },
    });

    // Prepare Midtrans transaction parameters
    const parameter = {
      transaction_details: {
        order_id: transaction.id,
        gross_amount: amount,
      },
      // enabled_payments: ["other_qris"],
      customer_details: {
        first_name: user.name,
        email: user.email,
        phone: user.phone || "",
      },
      item_details: [
        {
          id: "topup-credit",
          price: amount,
          quantity: 1,
          name: "Credit Top-Up",
          category: "Digital Credit",
        },
      ],
      callbacks: {
        finish: process.env.MIDTRANS_FINISH_URL,
        unfinish: process.env.MIDTRANS_UNFINISH_URL,
        error: process.env.MIDTRANS_ERROR_URL,
      },
      expiry: {
        start_time:
          new Date()
            .toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" })
            .replace("T", " ") + " +0700",
        unit: "minutes",
        duration: 60, // 1 hour expiry
      },
    };

    try {
      // Create Snap transaction
      const snapTransaction = await snap.createTransaction(parameter);

      // Update transaction with Midtrans reference
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentReference: snapTransaction.token,
          metadata: {
            midtrans_redirect_url: snapTransaction.redirect_url,
            midtrans_token: snapTransaction.token,
            payment_method: paymentMethod,
            expiry_time: parameter.expiry.start_time,
          },
        },
      });

      return {
        transactionId: transaction.id,
        snapToken: snapTransaction.token,
        redirectUrl: snapTransaction.redirect_url,
        amount,
        paymentMethod,
        expiryTime: parameter.expiry.start_time,
      };
    } catch (error) {
      // Mark transaction as failed if Midtrans creation fails
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "FAILED",
          metadata: {
            error: error.message,
            failed_at: new Date().toISOString(),
          },
        },
      });

      throw new Error(`Failed to create payment transaction: ${error.message}`);
    }
  }

  /**
   * Handle Midtrans webhook notification
   * @param {Object} notification - Midtrans notification payload
   * @returns {Promise<Object>} Processing result
   */
  async handleNotification(notification) {
    try {
      // Verify notification with Midtrans
      const statusResponse = await coreApi.transaction.notification(
        notification
      );

      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const paymentType = statusResponse.payment_type;
      const transactionTime = statusResponse.transaction_time;

      // Get transaction from database
      const transaction = await prisma.transaction.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (!transaction) {
        throw new Error(`Transaction not found: ${orderId}`);
      }

      // Determine new transaction status
      let newStatus = "PENDING";
      let shouldCreditAccount = false;

      if (transactionStatus === "capture") {
        if (fraudStatus === "challenge") {
          newStatus = "PENDING";
        } else if (fraudStatus === "accept") {
          newStatus = "COMPLETED";
          shouldCreditAccount = true;
        }
      } else if (transactionStatus === "settlement") {
        newStatus = "COMPLETED";
        shouldCreditAccount = true;
      } else if (
        transactionStatus === "cancel" ||
        transactionStatus === "deny" ||
        transactionStatus === "expire"
      ) {
        newStatus = "FAILED";
      } else if (transactionStatus === "pending") {
        newStatus = "PENDING";
      }

      // Process transaction based on status
      if (shouldCreditAccount && transaction.type === "TOP_UP") {
        // Use database transaction to ensure atomicity for successful payments
        await prisma.$transaction(async (tx) => {
          // Get current user balance
          const user = await tx.user.findUnique({
            where: { id: transaction.userId },
            select: {
              id: true,
              creditBalance: true,
              totalTopUp: true,
            },
          });

          const balanceBefore = user.creditBalance;
          const balanceAfter = balanceBefore + transaction.amount;

          // Update user balance and total top-up
          await tx.user.update({
            where: { id: transaction.userId },
            data: {
              creditBalance: balanceAfter,
              totalTopUp: { increment: transaction.amount },
            },
          });

          // Update the existing transaction record with completion details
          await tx.transaction.update({
            where: { id: orderId },
            data: {
              status: "COMPLETED",
              balanceAfter: balanceAfter,
              completedAt: new Date(),
              metadata: {
                ...transaction.metadata,
                midtrans_status: transactionStatus,
                midtrans_fraud_status: fraudStatus,
                midtrans_payment_type: paymentType,
                midtrans_transaction_time: transactionTime,
                midtrans_transaction_id: statusResponse.transaction_id,
                notification_received_at: new Date().toISOString(),
              },
            },
          });
        });
      } else {
        // Update transaction status for non-successful or non-topup transactions
        await prisma.transaction.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            completedAt: shouldCreditAccount ? new Date() : null,
            metadata: {
              ...transaction.metadata,
              midtrans_status: transactionStatus,
              midtrans_fraud_status: fraudStatus,
              midtrans_payment_type: paymentType,
              midtrans_transaction_time: transactionTime,
              notification_received_at: new Date().toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        transactionId: orderId,
        status: newStatus,
        shouldCreditAccount,
        amount: transaction.amount,
        paymentType,
        message: `Transaction ${orderId} processed successfully`,
      };
    } catch (error) {
      console.error("Midtrans notification error:", error);

      // Log the error but don't throw to avoid webhook retry loops
      if (notification.order_id) {
        await prisma.transaction
          .update({
            where: { id: notification.order_id },
            data: {
              metadata: {
                webhook_error: error.message,
                webhook_error_at: new Date().toISOString(),
                raw_notification: notification,
              },
            },
          })
          .catch(() => {
            // Ignore if transaction doesn't exist
          });
      }

      return {
        success: false,
        error: error.message,
        orderId: notification.order_id || "unknown",
      };
    }
  }

  /**
   * Check transaction status with Midtrans
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction status from Midtrans
   */
  async checkTransactionStatus(transactionId) {
    try {
      const statusResponse = await coreApi.transaction.status(transactionId);

      // Update local transaction record with latest status
      const localTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (localTransaction) {
        let newStatus = "PENDING";

        if (statusResponse.transaction_status === "settlement") {
          newStatus = "COMPLETED";
        } else if (
          ["cancel", "deny", "expire"].includes(
            statusResponse.transaction_status
          )
        ) {
          newStatus = "FAILED";
        }

        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            metadata: {
              ...localTransaction.metadata,
              last_status_check: new Date().toISOString(),
              midtrans_status: statusResponse.transaction_status,
              midtrans_fraud_status: statusResponse.fraud_status,
            },
          },
        });
      }

      return {
        transactionId,
        status: statusResponse.transaction_status,
        fraudStatus: statusResponse.fraud_status,
        paymentType: statusResponse.payment_type,
        transactionTime: statusResponse.transaction_time,
        grossAmount: statusResponse.gross_amount,
        currency: statusResponse.currency,
      };
    } catch (error) {
      console.error("Check transaction status error:", error);
      throw new Error(`Failed to check transaction status: ${error.message}`);
    }
  }

  /**
   * Cancel a pending transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelTransaction(transactionId) {
    try {
      // Check if transaction exists and is cancellable
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      if (transaction.status !== "PENDING") {
        throw new Error("Can only cancel pending transactions");
      }

      // Cancel with Midtrans
      const cancelResponse = await coreApi.transaction.cancel(transactionId);

      // Update local transaction
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "CANCELLED",
          metadata: {
            ...transaction.metadata,
            cancelled_at: new Date().toISOString(),
            midtrans_cancel_response: cancelResponse,
          },
        },
      });

      return {
        success: true,
        transactionId,
        message: "Transaction cancelled successfully",
      };
    } catch (error) {
      console.error("Cancel transaction error:", error);
      throw new Error(`Failed to cancel transaction: ${error.message}`);
    }
  }

  /**
   * Get payment methods available for top-up
   * @returns {Array} Available payment methods
   */
  getAvailablePaymentMethods() {
    return [
      {
        type: "BANK_TRANSFER",
        name: "Bank Transfer",
        description: "Transfer via BCA, BNI, BRI, Mandiri",
        icon: "bank",
        processingTime: "Instant verification",
      },
      {
        type: "E_WALLET",
        name: "E-Wallet",
        description: "GoPay, OVO, DANA, LinkAja",
        icon: "wallet",
        processingTime: "Instant",
      },
      {
        type: "CREDIT_CARD",
        name: "Credit Card",
        description: "Visa, Mastercard",
        icon: "credit-card",
        processingTime: "Instant",
      },
      {
        type: "QRIS",
        name: "QRIS",
        description: "Quick Response Indonesian Standard",
        icon: "qr-code",
        processingTime: "Instant",
      },
    ];
  }

  /**
   * Get transaction summary for admin dashboard
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction summary
   */
  async getTransactionSummary(options = {}) {
    const { startDate, endDate } = options;

    const whereClause = {
      paymentMethod: { startsWith: "MIDTRANS_" },
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [summary, statusBreakdown, methodBreakdown] = await Promise.all([
      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ["paymentMethod"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      overview: {
        totalAmount: summary._sum.amount || 0,
        totalTransactions: summary._count.id || 0,
        averageAmount: summary._avg.amount || 0,
      },
      byStatus: statusBreakdown.reduce((acc, item) => {
        acc[item.status] = {
          amount: item._sum.amount || 0,
          count: item._count.id || 0,
        };
        return acc;
      }, {}),
      byPaymentMethod: methodBreakdown.reduce((acc, item) => {
        const method = item.paymentMethod.replace("MIDTRANS_", "");
        acc[method] = {
          amount: item._sum.amount || 0,
          count: item._count.id || 0,
        };
        return acc;
      }, {}),
    };
  }

  /**
   * Retry failed webhook processing
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Retry result
   */
  async retryWebhookProcessing(transactionId) {
    try {
      // Get current status from Midtrans
      const statusResponse = await this.checkTransactionStatus(transactionId);

      // Process as if it's a new notification
      const mockNotification = {
        order_id: transactionId,
        transaction_status: statusResponse.status,
        fraud_status: statusResponse.fraudStatus,
        payment_type: statusResponse.paymentType,
        transaction_time: statusResponse.transactionTime,
      };

      return await this.handleNotification(mockNotification);
    } catch (error) {
      console.error("Retry webhook processing error:", error);
      throw new Error(`Failed to retry webhook processing: ${error.message}`);
    }
  }

  /**
   * Validate Midtrans configuration
   * @returns {Promise<Object>} Configuration validation result
   */
  async validateConfiguration() {
    try {
      // Test API connectivity by checking a dummy transaction
      const testOrderId = `test-${Date.now()}`;

      try {
        await coreApi.transaction.status(testOrderId);
      } catch (error) {
        // Expected to fail for non-existent transaction, but should not be auth error
        if (
          error.message.includes("401") ||
          error.message.includes("authentication")
        ) {
          throw new Error("Invalid Midtrans credentials");
        }
      }

      return {
        isValid: true,
        serverKey: process.env.MIDTRANS_SERVER_KEY ? "Set" : "Missing",
        clientKey: process.env.MIDTRANS_CLIENT_KEY ? "Set" : "Missing",
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
        webhookUrl: process.env.MIDTRANS_NOTIFICATION_URL,
        message: "Midtrans configuration is valid",
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        message: "Midtrans configuration validation failed",
      };
    }
  }
}

export default new MidtransService();
