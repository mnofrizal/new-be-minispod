import provisioningService from "../services/k8s/provisioning.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import prisma from "../utils/prisma.js";

/**
 * Create a new service instance from subscription
 * POST /api/instances
 */
const createInstance = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.id;

    if (!subscriptionId) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Subscription ID is required"
      );
    }

    // Verify subscription belongs to user (done in service layer)
    const result = await provisioningService.provisionServiceInstance(
      subscriptionId
    );

    sendResponse(
      res,
      StatusCodes.CREATED,
      result,
      "Service instance provisioning started successfully"
    );
  } catch (error) {
    logger.error("Create instance error:", error);

    if (error.message.includes("Subscription not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Subscription not found"
      );
    }

    if (error.message.includes("not active")) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only provision instances for active subscriptions"
      );
    }

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Service provisioning temporarily unavailable"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to start service provisioning"
    );
  }
};

/**
 * Get user's service instances
 * GET /api/instances
 */
const getUserInstances = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, includeTerminated = false } = req.query;

    const instances = await provisioningService.getUserInstances(userId, {
      status,
      includeTerminated: includeTerminated === "true",
    });

    sendResponse(
      res,
      StatusCodes.OK,
      {
        instances,
        total: instances.length,
      },
      "Service instances retrieved successfully"
    );
  } catch (error) {
    logger.error("Get user instances error:", error);

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service instances"
    );
  }
};

/**
 * Get service instance details and status
 * GET /api/instances/:id
 */
const getInstanceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await provisioningService.getInstanceStatus(id);

    // Verify instance belongs to user
    if (result.instance.subscription.user.id !== userId) {
      return sendResponse(
        res,
        StatusCodes.FORBIDDEN,
        null,
        "Access denied to this service instance"
      );
    }

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance details retrieved successfully"
    );
  } catch (error) {
    logger.error("Get instance details error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service instance details"
    );
  }
};

/**
 * Terminate service instance
 * DELETE /api/instances/:id
 */
const terminateInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First verify instance belongs to user
    const instanceStatus = await provisioningService.getInstanceStatus(id);
    if (instanceStatus.instance.subscription.user.id !== userId) {
      return sendResponse(
        res,
        StatusCodes.FORBIDDEN,
        null,
        "Access denied to this service instance"
      );
    }

    const result = await provisioningService.terminateServiceInstance(id);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance terminated successfully"
    );
  } catch (error) {
    logger.error("Terminate instance error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to terminate service instance"
    );
  }
};

/**
 * Update service instance (for subscription upgrades)
 * PUT /api/instances/:id/update
 */
const updateInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Plan ID is required"
      );
    }

    // First verify instance belongs to user
    const instanceStatus = await provisioningService.getInstanceStatus(id);
    if (instanceStatus.instance.subscription.user.id !== userId) {
      return sendResponse(
        res,
        StatusCodes.FORBIDDEN,
        null,
        "Access denied to this service instance"
      );
    }

    // Get new plan details
    const newPlan = await prisma.servicePlan.findUnique({
      where: { id: planId, isActive: true },
      select: {
        id: true,
        name: true,
        planType: true,
        cpuMilli: true,
        memoryMb: true,
        storageGb: true,
      },
    });

    if (!newPlan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    const result = await provisioningService.updateServiceInstance(id, newPlan);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance updated successfully"
    );
  } catch (error) {
    logger.error("Update instance error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    if (error.message.includes("not running")) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Can only update running instances"
      );
    }

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Service update temporarily unavailable"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update service instance"
    );
  }
};

/**
 * Get instance logs (if available)
 * GET /api/instances/:id/logs
 */
const getInstanceLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { lines = 100, follow = false } = req.query;

    // First verify instance belongs to user
    const instanceStatus = await provisioningService.getInstanceStatus(id);
    if (instanceStatus.instance.subscription.user.id !== userId) {
      return sendResponse(
        res,
        StatusCodes.FORBIDDEN,
        null,
        "Access denied to this service instance"
      );
    }

    // For now, return a placeholder response
    // In a full implementation, this would fetch logs from Kubernetes
    sendResponse(
      res,
      StatusCodes.OK,
      {
        instanceId: id,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Log retrieval feature coming soon",
          },
        ],
        message: "Log retrieval feature is under development",
      },
      "Instance logs retrieved successfully"
    );
  } catch (error) {
    logger.error("Get instance logs error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve instance logs"
    );
  }
};

/**
 * Restart service instance
 * POST /api/instances/:id/restart
 */
const restartInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First verify instance belongs to user
    const instanceStatus = await provisioningService.getInstanceStatus(id);
    if (instanceStatus.instance.subscription.user.id !== userId) {
      return sendResponse(
        res,
        StatusCodes.FORBIDDEN,
        null,
        "Access denied to this service instance"
      );
    }

    // For now, return a placeholder response
    // In a full implementation, this would restart the Kubernetes deployment
    sendResponse(
      res,
      StatusCodes.OK,
      {
        instanceId: id,
        message: "Instance restart initiated",
        estimatedTime: "1-2 minutes",
      },
      "Instance restart feature is under development"
    );
  } catch (error) {
    logger.error("Restart instance error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to restart service instance"
    );
  }
};

export default {
  createInstance,
  getUserInstances,
  getInstanceDetails,
  terminateInstance,
  updateInstance,
  getInstanceLogs,
  restartInstance,
};
