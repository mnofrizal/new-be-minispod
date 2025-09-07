import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import subscriptionService from "../../services/subscription.service.js";
import logger from "../../utils/logger.js";

/**
 * Create subscription for a user (admin only)
 * POST /api/admin/subscriptions
 */
const createSubscriptionForUser = async (req, res) => {
  try {
    const { userId, planId, skipCreditCheck = false, reason } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminCreateSubscriptionForUser(
      userId,
      planId,
      {
        skipCreditCheck,
        reason,
        adminId,
      }
    );

    sendResponse(
      res,
      StatusCodes.CREATED,
      {
        subscription: result.subscription,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        plan: {
          id: result.plan.id,
          name: result.plan.name,
          serviceName: result.plan.service.name,
          monthlyPrice: result.plan.monthlyPrice,
        },
        billing: {
          chargeAmount: result.chargeAmount,
          isBonusSubscription: result.isBonusSubscription,
          originalPrice: result.plan.monthlyPrice,
        },
        adminAction: result.adminAction,
      },
      result.message || "Subscription created successfully by admin"
    );
  } catch (error) {
    logger.error("Admin create subscription error:", error);

    if (error.message.includes("User not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Service plan not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("already has an active subscription")) {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.message.includes("insufficient credit")) {
      if (error.details) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          error.details,
          error.message
        );
      }
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("full capacity")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        error.message
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to create subscription"
    );
  }
};

/**
 * Get all subscriptions (admin view)
 * GET /api/admin/subscriptions
 */
const getAllSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      serviceId,
      userId,
      search,
    } = req.query;

    const result = await subscriptionService.adminGetAllSubscriptions({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      serviceId,
      userId,
      search,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Subscriptions retrieved successfully"
    );
  } catch (error) {
    logger.error("Admin get all subscriptions error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscriptions"
    );
  }
};

/**
 * Force cancel subscription (admin only)
 * DELETE /api/admin/subscriptions/:subscriptionId/force-cancel
 */
const forceCancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const {
      reason,
      processRefund = false,
      terminateInstances = true,
    } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminForceCancelSubscription(
      subscriptionId,
      {
        reason,
        processRefund,
        terminateInstances,
        adminId,
      }
    );

    // Log admin action
    logger.info("Admin force cancelled subscription", {
      adminId,
      subscriptionId,
      userId: result.originalSubscription.userId,
      reason,
      processRefund,
      refundAmount: result.refundAmount,
      instancesTerminated: result.instancesTerminated,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      {
        subscription: result.subscription,
        instancesTerminated: result.instancesTerminated,
        refund:
          result.refundAmount > 0
            ? {
                amount: result.refundAmount,
                transactionId: result.refundTransaction?.id,
                processed: true,
              }
            : {
                amount: 0,
                processed: false,
                reason: processRefund
                  ? "No remaining days to refund"
                  : "Refund not requested",
              },
        message: "Subscription force-cancelled successfully",
        nextSteps: [
          "Subscription has been immediately cancelled",
          "End date set to cancellation time",
          `${result.instancesTerminated} instances have been terminated`,
          result.refundAmount > 0
            ? `Prorated refund of ${result.refundAmount} IDR has been added to user credit`
            : processRefund
            ? "No refund processed - no remaining days"
            : "No refund processed - not requested",
          "User can now create new subscriptions for this service",
        ],
        adminAction: {
          cancelledBy: adminId,
          reason: reason || "Admin force cancellation",
          processRefund,
          immediateTermination: true,
        },
      },
      "Subscription force-cancelled successfully"
    );
  } catch (error) {
    logger.error("Admin force cancel subscription error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("already cancelled")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to force cancel subscription"
    );
  }
};

/**
 * Process manual refund for subscription (admin only)
 * POST /api/admin/subscriptions/:subscriptionId/refund
 */
const processRefund = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { amount, reason, refundType = "PARTIAL" } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminProcessRefund(
      subscriptionId,
      {
        amount,
        reason,
        refundType,
        adminId,
      }
    );

    sendResponse(res, StatusCodes.OK, result, "Refund processed successfully");
  } catch (error) {
    logger.error("Admin process refund error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("must be greater than 0")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("cannot exceed monthly price")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to process refund"
    );
  }
};

/**
 * Get subscription statistics (admin dashboard)
 * GET /api/admin/subscriptions/stats
 */
const getSubscriptionStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await subscriptionService.adminGetSubscriptionStats({
      startDate,
      endDate,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      stats,
      "Subscription statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Admin get subscription stats error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscription statistics"
    );
  }
};

/**
 * Extend subscription end date (admin only)
 * PUT /api/admin/subscriptions/:subscriptionId/extend
 */
const extendSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { extensionDays, reason } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminExtendSubscription(
      subscriptionId,
      {
        extensionDays,
        reason,
        adminId,
      }
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Subscription extended successfully"
    );
  } catch (error) {
    logger.error("Admin extend subscription error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("must be greater than 0")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to extend subscription"
    );
  }
};

/**
 * Upgrade subscription for a user (admin only)
 * PUT /api/admin/subscriptions/:subscriptionId/upgrade
 */
const upgradeSubscriptionForUser = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanId, skipCreditCheck = false, reason } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminUpgradeSubscription(
      subscriptionId,
      {
        newPlanId,
        skipCreditCheck,
        reason,
        adminId,
      }
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      result.message || "Subscription upgraded successfully by admin"
    );
  } catch (error) {
    logger.error("Admin upgrade subscription error:", error);

    // Handle specific business logic errors
    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only upgrade")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("Cannot upgrade to")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("insufficient credit")) {
      if (error.details) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          error.details,
          error.message
        );
      }
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("full capacity")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        error.message
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to upgrade subscription"
    );
  }
};

/**
 * Set subscription to expired status (admin only)
 * PUT /api/admin/subscriptions/:subscriptionId/expire
 */
const expireSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason, terminateInstances = true } = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminExpireSubscription(
      subscriptionId,
      {
        reason,
        terminateInstances,
        adminId,
      }
    );

    // Log admin action
    logger.info("Admin expired subscription", {
      adminId,
      subscriptionId,
      userId: result.originalSubscription.userId,
      reason,
      terminateInstances,
      instancesTerminated: result.instancesTerminated,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      {
        subscription: result.subscription,
        instancesTerminated: result.instancesTerminated,
        message: "Subscription expired successfully",
        nextSteps: [
          "Subscription has been set to expired status",
          "Quota has been released",
          result.instancesTerminated > 0
            ? `${result.instancesTerminated} instances have been terminated`
            : "Service instances remain running",
          "Use refund endpoint if refund is needed",
        ],
        adminAction: {
          expiredBy: adminId,
          reason: reason || "Admin expired subscription",
          terminateInstances,
        },
      },
      "Subscription expired successfully"
    );
  } catch (error) {
    logger.error("Admin expire subscription error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("already expired")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to expire subscription"
    );
  }
};

/**
 * Update subscription details (admin only)
 * PUT /api/admin/subscriptions/:subscriptionId
 */
const updateSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const updateData = req.body;
    const adminId = req.user.userId;

    const result = await subscriptionService.adminUpdateSubscription(
      subscriptionId,
      updateData,
      adminId
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Subscription updated successfully"
    );
  } catch (error) {
    logger.error("Admin update subscription error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Invalid")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update subscription"
    );
  }
};

export default {
  createSubscriptionForUser,
  getAllSubscriptions,
  forceCancelSubscription,
  processRefund,
  getSubscriptionStats,
  extendSubscription,
  upgradeSubscriptionForUser,
  expireSubscription,
  updateSubscription,
};
