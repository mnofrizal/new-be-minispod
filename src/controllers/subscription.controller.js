import { StatusCodes } from "http-status-codes";
import sendResponse from "../utils/response.js";
import subscriptionService from "../services/subscription.service.js";
import logger from "../utils/logger.js";

/**
 * Get user's subscriptions
 * GET /api/subscriptions
 */
const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, includeInstances = "true" } = req.query;

    const options = {
      status,
      includeInstances: includeInstances === "true",
    };

    const subscriptions = await subscriptionService.getUserSubscriptions(
      userId,
      options
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { subscriptions },
      "Subscriptions retrieved successfully"
    );
  } catch (error) {
    logger.error("Get user subscriptions error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscriptions"
    );
  }
};

/**
 * Get subscription details
 * GET /api/subscriptions/:subscriptionId
 */
const getSubscriptionDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { subscription },
      "Subscription details retrieved successfully"
    );
  } catch (error) {
    logger.error("Get subscription details error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscription details"
    );
  }
};

/**
 * Create new subscription
 * POST /api/subscriptions
 */
const createSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;

    // Validate subscription before creating
    const validation = await subscriptionService.validateSubscription(
      userId,
      planId
    );

    if (!validation.isValid) {
      const statusCode = getValidationStatusCode(validation.code);
      return sendResponse(res, statusCode, null, validation.error);
    }

    const result = await subscriptionService.createSubscription(userId, planId);

    sendResponse(
      res,
      StatusCodes.CREATED,
      result,
      "Subscription created successfully"
    );
  } catch (error) {
    logger.error("Create subscription error:", error);

    // Handle specific business logic errors
    if (error.message.includes("already has an active subscription")) {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.message.includes("Insufficient credit")) {
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

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
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
 * Upgrade subscription
 * PUT /api/subscriptions/:subscriptionId/upgrade
 */
const upgradeSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;
    const { newPlanId } = req.body;

    // Verify subscription belongs to user
    const existingSubscription =
      await subscriptionService.getSubscriptionDetails(subscriptionId, userId);

    if (!existingSubscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    const result = await subscriptionService.upgradeSubscription(
      subscriptionId,
      newPlanId
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Subscription upgraded successfully"
    );
  } catch (error) {
    logger.error("Upgrade subscription error:", error);

    // Handle specific upgrade errors
    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only upgrade active")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("Cannot upgrade to a different service")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("Can only upgrade to a higher tier")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("Insufficient credit")) {
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
 * Cancel subscription
 * DELETE /api/subscriptions/:subscriptionId
 */
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    // Verify subscription belongs to user
    const existingSubscription =
      await subscriptionService.getSubscriptionDetails(subscriptionId, userId);

    if (!existingSubscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    const result = await subscriptionService.cancelSubscription(
      subscriptionId,
      reason
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Subscription cancelled successfully"
    );
  } catch (error) {
    logger.error("Cancel subscription error:", error);

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
      "Failed to cancel subscription"
    );
  }
};

/**
 * Validate subscription before creation
 * POST /api/subscriptions/validate
 */
const validateSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;

    const validation = await subscriptionService.validateSubscription(
      userId,
      planId
    );

    const statusCode = validation.isValid
      ? StatusCodes.OK
      : StatusCodes.BAD_REQUEST;

    sendResponse(
      res,
      statusCode,
      { validation },
      validation.isValid
        ? "Subscription validation passed"
        : "Subscription validation failed"
    );
  } catch (error) {
    logger.error("Validate subscription error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to validate subscription"
    );
  }
};

/**
 * Helper function to get appropriate status code for validation errors
 */
function getValidationStatusCode(errorCode) {
  switch (errorCode) {
    case "USER_NOT_FOUND":
      return StatusCodes.NOT_FOUND;
    case "PLAN_NOT_AVAILABLE":
      return StatusCodes.NOT_FOUND;
    case "DUPLICATE_SUBSCRIPTION":
      return StatusCodes.CONFLICT;
    case "INSUFFICIENT_CREDIT":
      return StatusCodes.BAD_REQUEST;
    case "QUOTA_EXCEEDED":
      return StatusCodes.SERVICE_UNAVAILABLE;
    default:
      return StatusCodes.BAD_REQUEST;
  }
}

export default {
  getUserSubscriptions,
  getSubscriptionDetails,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  validateSubscription,
};
