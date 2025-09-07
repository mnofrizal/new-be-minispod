import healthService from "../../services/k8s/health.service.js";
import sendResponse from "../../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";

/**
 * Get health summary for all service instances
 * GET /api/admin/health/summary
 */
const getHealthSummary = async (req, res) => {
  try {
    const summary = await healthService.getHealthSummary();

    sendResponse(
      res,
      StatusCodes.OK,
      summary,
      "Health summary retrieved successfully"
    );
  } catch (error) {
    logger.error("Get health summary error:", error);

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve health summary"
    );
  }
};

/**
 * Run health check for all service instances
 * POST /api/admin/health/check
 */
const runHealthCheck = async (req, res) => {
  try {
    const result = await healthService.checkAllInstancesHealth();

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Health check completed successfully"
    );
  } catch (error) {
    logger.error("Run health check error:", error);

    if (error.message.includes("Kubernetes cluster not available")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Kubernetes cluster not available for health checks"
      );
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to run health check"
    );
  }
};

/**
 * Get detailed health status for a specific instance
 * GET /api/admin/health/instances/:id
 */
const getInstanceHealth = async (req, res) => {
  try {
    const { id } = req.params;

    const healthResult = await healthService.getInstanceHealthById(id);

    sendResponse(
      res,
      StatusCodes.OK,
      healthResult,
      "Instance health status retrieved successfully"
    );
  } catch (error) {
    logger.error("Get instance health error:", error);

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
      "Failed to retrieve instance health status"
    );
  }
};

/**
 * Get health monitoring statistics
 * GET /api/admin/health/stats
 */
const getHealthStats = async (req, res) => {
  try {
    const { timeRange = "24h" } = req.query;

    const stats = await healthService.getHealthStatistics(timeRange);

    sendResponse(
      res,
      StatusCodes.OK,
      stats,
      "Health statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Get health stats error:", error);

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve health statistics"
    );
  }
};

export default {
  getHealthSummary,
  runHealthCheck,
  getInstanceHealth,
  getHealthStats,
};
