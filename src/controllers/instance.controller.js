import provisioningService from "../services/k8s/provisioning.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create a new service instance from subscription
 * POST /api/instances
 */
const createInstance = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.userId;

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
    const userId = req.user.userId;
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
    const userId = req.user.userId;

    const result = await provisioningService.getInstanceStatus(id, userId);

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
    const userId = req.user.userId;

    const result = await provisioningService.terminateServiceInstance(
      id,
      userId
    );

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
    const userId = req.user.userId;

    const result = await provisioningService.updateServiceInstance(
      id,
      planId,
      userId
    );

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
    const userId = req.user.userId;
    const { lines = 100, follow = false } = req.query;

    // For now, return a placeholder response
    // In a full implementation, this would fetch logs from Kubernetes
    // Authorization will be handled in service layer
    const result = await provisioningService.getInstanceLogs(id, userId, {
      lines,
      follow,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      result,
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
    const userId = req.user.userId;

    const result = await provisioningService.restartServiceInstance(id, userId);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance restart initiated successfully"
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
      "Failed to restart service instance"
    );
  }
};

/**
 * Stop service instance temporarily
 * PUT /api/instances/:id/stop
 */
const stopInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await provisioningService.stopServiceInstance(id, userId);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance stop initiated successfully"
    );
  } catch (error) {
    logger.error("Stop instance error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
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
      "Failed to stop service instance"
    );
  }
};

/**
 * Start service instance from stopped state
 * PUT /api/instances/:id/start
 */
const startInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await provisioningService.startServiceInstance(id, userId);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Service instance start initiated successfully"
    );
  } catch (error) {
    logger.error("Start instance error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
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
      "Failed to start service instance"
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
  stopInstance,
  startInstance,
};
