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

    // Get instance from database
    const instance = await prisma.serviceInstance.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            service: { select: { name: true, slug: true } },
            plan: { select: { name: true, planType: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!instance) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service instance not found"
      );
    }

    // Run health check for this specific instance
    const healthResult = await healthService.checkInstanceHealth(instance);

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

    // Calculate time range
    let startTime;
    switch (timeRange) {
      case "1h":
        startTime = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case "6h":
        startTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
        break;
      case "24h":
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Get instances with recent health checks
    const instances = await prisma.serviceInstance.findMany({
      where: {
        status: { not: "TERMINATED" },
        lastHealthCheck: {
          gte: startTime,
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        healthStatus: true,
        lastHealthCheck: true,
        cpuUsage: true,
        memoryUsage: true,
        subscription: {
          select: {
            service: { select: { name: true, slug: true } },
            plan: { select: { name: true, planType: true } },
          },
        },
      },
      orderBy: { lastHealthCheck: "desc" },
    });

    // Calculate statistics
    const totalInstances = instances.length;
    const healthyInstances = instances.filter(
      (i) => i.healthStatus === "Healthy"
    ).length;
    const unhealthyInstances = totalInstances - healthyInstances;

    // Group by service type
    const serviceStats = instances.reduce((acc, instance) => {
      const serviceName = instance.subscription.service.name;
      if (!acc[serviceName]) {
        acc[serviceName] = {
          total: 0,
          healthy: 0,
          unhealthy: 0,
        };
      }
      acc[serviceName].total++;
      if (instance.healthStatus === "Healthy") {
        acc[serviceName].healthy++;
      } else {
        acc[serviceName].unhealthy++;
      }
      return acc;
    }, {});

    // Calculate resource usage statistics
    const resourceStats = {
      cpu: {
        average: 0,
        max: 0,
        min: 0,
      },
      memory: {
        average: 0,
        max: 0,
        min: 0,
      },
    };

    const instancesWithMetrics = instances.filter(
      (i) => i.cpuUsage !== null && i.memoryUsage !== null
    );
    if (instancesWithMetrics.length > 0) {
      const cpuValues = instancesWithMetrics.map((i) => i.cpuUsage);
      const memoryValues = instancesWithMetrics.map((i) => i.memoryUsage);

      resourceStats.cpu.average = parseFloat(
        (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(2)
      );
      resourceStats.cpu.max = Math.max(...cpuValues);
      resourceStats.cpu.min = Math.min(...cpuValues);

      resourceStats.memory.average = parseFloat(
        (memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length).toFixed(
          2
        )
      );
      resourceStats.memory.max = Math.max(...memoryValues);
      resourceStats.memory.min = Math.min(...memoryValues);
    }

    const stats = {
      timeRange,
      totalInstances,
      healthyInstances,
      unhealthyInstances,
      healthPercentage:
        totalInstances > 0
          ? parseFloat(((healthyInstances / totalInstances) * 100).toFixed(2))
          : 0,
      serviceStats,
      resourceStats,
      lastUpdated: new Date().toISOString(),
    };

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
