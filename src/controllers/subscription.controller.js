import { StatusCodes } from "http-status-codes";
import sendResponse from "../utils/response.js";
import subscriptionService from "../services/subscription.service.js";
import couponService from "../services/coupon.service.js";
import prisma from "../utils/prisma.js";
import {
  getK8sClient,
  getMetricsApi,
  isK8sAvailable,
} from "../config/kubernetes.js";
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
    const { planId, couponCode } = req.body;

    // Get plan details for coupon validation
    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId },
      include: { service: true },
    });

    if (!plan) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Invalid service plan"
      );
    }

    let subscriptionOptions = {};

    // Handle coupon if provided
    if (couponCode) {
      // Validate coupon
      const validation = await couponService.validateCoupon(
        couponCode,
        userId,
        {
          serviceId: plan.serviceId,
          subscriptionAmount: plan.monthlyPrice,
        }
      );

      if (!validation.valid) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          validation.error
        );
      }

      const coupon = validation.coupon;

      // Handle different coupon types
      if (coupon.type === "SUBSCRIPTION_DISCOUNT") {
        // Calculate discount
        const discount = await couponService.calculateSubscriptionDiscount(
          couponCode,
          userId,
          plan.monthlyPrice,
          plan.serviceId
        );

        subscriptionOptions.couponDiscount = {
          couponCode,
          originalAmount: discount.originalAmount,
          discountAmount: discount.discountAmount,
          finalAmount: discount.finalAmount,
        };
      } else if (coupon.type === "FREE_SERVICE") {
        // Redeem free service coupon
        const freeServiceResult = await couponService.redeemFreeServiceCoupon(
          userId,
          couponCode,
          plan.serviceId,
          planId
        );

        subscriptionOptions.freeService = {
          couponCode,
          redemptionId: freeServiceResult.redemptionId,
          freeServiceValue: freeServiceResult.freeServiceValue,
        };
      } else {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "This coupon cannot be used during subscription checkout"
        );
      }
    }

    // Validate subscription before creating
    const validation = await subscriptionService.validateSubscription(
      userId,
      planId
    );

    if (!validation.isValid) {
      const statusCode = getValidationStatusCode(validation.code);
      return sendResponse(res, statusCode, null, validation.error);
    }

    // Create subscription with coupon options
    const result = await subscriptionService.createSubscription(
      userId,
      planId,
      subscriptionOptions
    );

    // Apply coupon discount if applicable
    if (subscriptionOptions.couponDiscount) {
      await couponService.applySubscriptionDiscount(
        couponCode,
        userId,
        result.subscription.id,
        subscriptionOptions.couponDiscount.originalAmount,
        subscriptionOptions.couponDiscount.discountAmount
      );
    }

    // Link free service coupon to subscription
    if (subscriptionOptions.freeService) {
      await couponService.linkRedemptionToSubscription(
        subscriptionOptions.freeService.redemptionId,
        result.subscription.id
      );
    }

    sendResponse(
      res,
      StatusCodes.CREATED,
      {
        ...result,
        couponApplied: !!couponCode,
        ...(subscriptionOptions.couponDiscount && {
          discount: subscriptionOptions.couponDiscount,
        }),
        ...(subscriptionOptions.freeService && {
          freeService: subscriptionOptions.freeService,
        }),
      },
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

    if (
      error.message.includes("Invalid coupon") ||
      error.message.includes("coupon")
    ) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
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
 * Get subscription instance metrics
 * GET /api/subscriptions/:subscriptionId/metrics
 */
const getSubscriptionMetrics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    // Verify subscription belongs to user and get instance details
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    // Check if subscription has an active service instance
    if (!subscription.instances || subscription.instances.length === 0) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "No service instance found for this subscription"
      );
    }

    const instance = subscription.instances.find(
      (inst) => inst.status === "RUNNING"
    );

    if (!instance) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "No running service instance found"
      );
    }

    if (!instance.podName || !instance.namespace) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Instance missing pod name or namespace information"
      );
    }

    // Check if Kubernetes is available
    if (!isK8sAvailable()) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Kubernetes cluster not available"
      );
    }

    // Get pod metrics
    const metrics = await getPodMetrics(instance.podName, instance.namespace);

    if (!metrics) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Metrics not available for this instance"
      );
    }

    // Get resource limits from subscription plan for comparison
    const resourceLimits = {
      cpu: `${subscription.plan.cpuMilli}m`,
      memory: `${subscription.plan.memoryMb}Mi`,
      storage: `${subscription.plan.storageGb}Gi`,
    };

    // Simplify the response for frontend consumption
    const container = metrics.containers[0]; // Get first container (usually the main one)

    const response = {
      instanceId: instance.id,
      status: instance.status,
      cpu: {
        usage: container.usage.cpu.millicores,
        limit: parseInt(subscription.plan.cpuMilli),
        percentage: Math.round(
          (container.usage.cpu.millicores / subscription.plan.cpuMilli) * 100
        ),
      },
      memory: {
        usage: container.usage.memory.megabytes,
        limit: subscription.plan.memoryMb,
        percentage: Math.round(
          (container.usage.memory.megabytes / subscription.plan.memoryMb) * 100
        ),
      },
      timestamp: metrics.timestamp,
    };

    sendResponse(
      res,
      StatusCodes.OK,
      response,
      "Subscription metrics retrieved successfully"
    );
  } catch (error) {
    logger.error("Get subscription metrics error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscription metrics"
    );
  }
};

/**
 * Get pod metrics helper function
 * @param {string} podName - Pod name
 * @param {string} namespace - Namespace
 * @returns {Promise<Object|null>} Pod metrics
 */
const getPodMetrics = async (podName, namespace) => {
  try {
    const metricsApi = getMetricsApi();
    if (!metricsApi) {
      return null;
    }

    const response = await metricsApi.getPodMetrics({ namespace });

    // Handle different response structures
    const metricsData = response.metrics || response.body || response;
    const items = metricsData.items || [];

    const podMetric = items.find((item) => item.metadata.name === podName);

    if (!podMetric) {
      logger.warn(
        `No metrics found for pod ${podName} in namespace ${namespace}. Available pods: ${items
          .map((item) => item.metadata.name)
          .join(", ")}`
      );
      return null;
    }

    const containers = podMetric.containers.map((container) => {
      const cpuRaw = container.usage.cpu;
      const memoryRaw = container.usage.memory;

      const cpuNanocores = parseInt(cpuRaw.replace("n", ""));
      const cpuMillicores = Math.round(cpuNanocores / 1000000);
      const cpuCores = parseFloat((cpuNanocores / 1000000000).toFixed(2));

      const memoryKiloBytes = parseInt(memoryRaw.replace("Ki", ""));
      const memoryBytes = memoryKiloBytes * 1024;
      const memoryMegabytes = parseFloat(
        (memoryBytes / 1024 / 1024).toFixed(2)
      );
      const memoryGigabytes = parseFloat(
        (memoryBytes / 1024 / 1024 / 1024).toFixed(2)
      );

      return {
        name: container.name,
        usage: {
          cpu: {
            raw: cpuRaw,
            millicores: cpuMillicores,
            cores: cpuCores,
          },
          memory: {
            raw: memoryRaw,
            bytes: memoryBytes,
            megabytes: memoryMegabytes,
            gigabytes: memoryGigabytes,
          },
        },
      };
    });

    return {
      timestamp: podMetric.timestamp,
      window: podMetric.window,
      containers,
    };
  } catch (error) {
    logger.warn(
      `Failed to get metrics for pod ${namespace}/${podName}:`,
      error.message
    );
    return null;
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

/**
 * Retry provisioning for subscription
 * POST /api/subscriptions/:subscriptionId/retry-provisioning
 */
const retryProvisioning = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    const result = await subscriptionService.retryProvisioning(
      subscriptionId,
      userId
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Provisioning retry initiated successfully"
    );
  } catch (error) {
    logger.error("Retry provisioning error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Cannot retry")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    if (error.message.includes("already running")) {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.message.includes("currently being provisioned")) {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.message.includes("Kubernetes cluster not available")) {
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
      "Failed to retry provisioning"
    );
  }
};

/**
 * Restart subscription service instance
 * POST /api/subscriptions/:subscriptionId/restart
 */
const restartSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    // Get subscription details to verify ownership and get instance
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    // Check if subscription has an active service instance
    if (!subscription.instances || subscription.instances.length === 0) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "No service instance found for this subscription"
      );
    }

    // Find the running instance
    const runningInstance = subscription.instances.find(
      (inst) => inst.status === "RUNNING"
    );

    if (!runningInstance) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "No running service instance found to restart"
      );
    }

    // Import provisioning service to restart the instance
    const provisioningService = (
      await import("../services/k8s/provisioning.service.js")
    ).default;

    // Restart the service instance
    const result = await provisioningService.restartServiceInstance(
      runningInstance.id
    );

    // Enhance response with subscription context
    const enhancedResult = {
      ...result,
      subscription: {
        id: subscription.id,
        service: subscription.service,
        plan: subscription.plan,
        status: subscription.status,
      },
    };

    sendResponse(
      res,
      StatusCodes.OK,
      enhancedResult,
      "Subscription service restarted successfully"
    );
  } catch (error) {
    logger.error("Restart subscription error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only restart running")) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only restart running service instances"
      );
    }

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Service restart temporarily unavailable"
      );
    }

    if (error.message.includes("Rolling restart failed")) {
      return sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Rolling restart failed to complete"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to restart subscription service"
    );
  }
};

/**
 * Stop subscription service temporarily
 * PUT /api/subscriptions/:subscriptionId/stop
 */
const stopSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    // Get subscription details to verify ownership and get instance
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    // Check if subscription has an active service instance
    if (!subscription.instances || subscription.instances.length === 0) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "No service instance found for this subscription"
      );
    }

    // Find the running instance
    const runningInstance = subscription.instances.find(
      (inst) => inst.status === "RUNNING"
    );

    if (!runningInstance) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "No running service instance found to stop"
      );
    }

    // Import provisioning service to stop the instance
    const provisioningService = (
      await import("../services/k8s/provisioning.service.js")
    ).default;

    // Stop the service instance
    const result = await provisioningService.stopServiceInstance(
      runningInstance.id
    );

    // Enhance response with subscription context
    const enhancedResult = {
      ...result,
      subscription: {
        id: subscription.id,
        service: subscription.service,
        plan: subscription.plan,
        status: subscription.status,
      },
    };

    sendResponse(
      res,
      StatusCodes.OK,
      enhancedResult,
      "Subscription service stopped successfully"
    );
  } catch (error) {
    logger.error("Stop subscription error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only stop running")) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only stop running service instances"
      );
    }

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Service stop temporarily unavailable"
      );
    }

    if (error.message.includes("Stop failed")) {
      return sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Service stop failed to complete"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to stop subscription service"
    );
  }
};

/**
 * Start subscription service from stopped state
 * PUT /api/subscriptions/:subscriptionId/start
 */
const startSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    // Get subscription details to verify ownership and get instance
    const subscription = await subscriptionService.getSubscriptionDetails(
      subscriptionId,
      userId
    );

    if (!subscription) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    // Check if subscription has an active service instance
    if (!subscription.instances || subscription.instances.length === 0) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "No service instance found for this subscription"
      );
    }

    // Find the stopped instance
    const stoppedInstance = subscription.instances.find(
      (inst) => inst.status === "STOPPED"
    );

    if (!stoppedInstance) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "No stopped service instance found to start"
      );
    }

    // Import provisioning service to start the instance
    const provisioningService = (
      await import("../services/k8s/provisioning.service.js")
    ).default;

    // Start the service instance
    const result = await provisioningService.startServiceInstance(
      stoppedInstance.id
    );

    // Enhance response with subscription context
    const enhancedResult = {
      ...result,
      subscription: {
        id: subscription.id,
        service: subscription.service,
        plan: subscription.plan,
        status: subscription.status,
      },
    };

    sendResponse(
      res,
      StatusCodes.OK,
      enhancedResult,
      "Subscription service started successfully"
    );
  } catch (error) {
    logger.error("Start subscription error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only start stopped")) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only start stopped service instances"
      );
    }

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Service start temporarily unavailable"
      );
    }

    if (error.message.includes("Start failed")) {
      return sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Service start failed to complete"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to start subscription service"
    );
  }
};

/**
 * Get subscription billing info with available upgrade plans
 * GET /api/subscriptions/:subscriptionId/billing-info
 */
const getAvailableUpgrades = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;

    const upgradeOptions = await subscriptionService.getAvailableUpgrades(
      subscriptionId,
      userId
    );

    sendResponse(
      res,
      StatusCodes.OK,
      upgradeOptions,
      "Available upgrade plans retrieved successfully"
    );
  } catch (error) {
    logger.error("Get available upgrades error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Can only get upgrade options")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve available upgrade plans"
    );
  }
};

/**
 * Toggle auto-renew setting for subscription
 * PUT /api/subscriptions/:subscriptionId/auto-renew
 */
const toggleAutoRenew = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscriptionId } = req.params;
    const { autoRenew } = req.body;

    const result = await subscriptionService.toggleAutoRenew(
      subscriptionId,
      userId,
      autoRenew
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      `Auto-renew ${autoRenew ? "enabled" : "disabled"} successfully`
    );
  } catch (error) {
    logger.error("Toggle auto-renew error:", error);

    if (error.message === "Subscription not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    if (error.message.includes("Cannot modify auto-renew")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to toggle auto-renew setting"
    );
  }
};

export default {
  getUserSubscriptions,
  getSubscriptionDetails,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  validateSubscription,
  getSubscriptionMetrics,
  retryProvisioning,
  restartSubscription,
  stopSubscription,
  startSubscription,
  getAvailableUpgrades,
  toggleAutoRenew,
};
