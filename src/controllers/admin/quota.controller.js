import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";

/**
 * Get quota overview for all service plans
 * GET /api/admin/quota/overview
 */
export const getQuotaOverview = async (req, res) => {
  try {
    const servicePlans = await prisma.servicePlan.findMany({
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            subscriptions: {
              where: {
                status: {
                  in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                },
              },
            },
          },
        },
      },
      orderBy: [{ service: { name: "asc" } }, { name: "asc" }],
    });

    const quotaOverview = servicePlans.map((plan) => {
      const activeSubscriptions = plan._count.subscriptions;
      const usedQuota = activeSubscriptions;
      const availableQuota = plan.totalQuota - usedQuota;
      const utilizationPercentage =
        plan.totalQuota > 0
          ? Math.round((usedQuota / plan.totalQuota) * 100)
          : 0;

      return {
        planId: plan.id,
        planName: plan.name,
        service: plan.service,
        totalQuota: plan.totalQuota,
        usedQuota,
        availableQuota,
        utilizationPercentage,
        status:
          utilizationPercentage >= 90
            ? "critical"
            : utilizationPercentage >= 75
            ? "warning"
            : "healthy",
      };
    });

    logger.info(`Admin retrieved quota overview`, {
      adminId: req.user.id,
      totalPlans: quotaOverview.length,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { quotaOverview },
      "Quota overview retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving quota overview:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve quota overview"
    );
  }
};

/**
 * Get detailed quota information for a specific service plan
 * GET /api/admin/quota/plans/:planId
 */
export const getPlanQuotaDetails = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId },
      include: {
        service: true,
        subscriptions: {
          where: {
            status: {
              in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!plan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    const usedQuota = plan.subscriptions.length;
    const availableQuota = plan.totalQuota - usedQuota;
    const utilizationPercentage =
      plan.totalQuota > 0 ? Math.round((usedQuota / plan.totalQuota) * 100) : 0;

    const quotaDetails = {
      plan: {
        id: plan.id,
        name: plan.name,
        service: plan.service,
      },
      quota: {
        total: plan.totalQuota,
        used: usedQuota,
        available: availableQuota,
        utilizationPercentage,
      },
      activeSubscriptions: plan.subscriptions.map((sub) => ({
        id: sub.id,
        user: sub.user,
        status: sub.status,
        createdAt: sub.createdAt,
        nextBilling: sub.nextBilling,
      })),
    };

    logger.info(`Admin retrieved plan quota details`, {
      adminId: req.user.id,
      planId,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { quotaDetails },
      "Plan quota details retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving plan quota details:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve plan quota details"
    );
  }
};

/**
 * Update quota for a service plan
 * PUT /api/admin/quota/plans/:planId
 */
export const updatePlanQuota = async (req, res) => {
  try {
    const { planId } = req.params;
    const { totalQuota, reason } = req.body;

    // Check if plan exists
    const existingPlan = await prisma.servicePlan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: {
                  in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                },
              },
            },
          },
        },
      },
    });

    if (!existingPlan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    const currentUsedQuota = existingPlan._count.subscriptions;

    // Validate that new quota is not less than currently used quota
    if (totalQuota < currentUsedQuota) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        `Cannot set quota to ${totalQuota}. Currently ${currentUsedQuota} subscriptions are active.`
      );
    }

    const updatedPlan = await prisma.servicePlan.update({
      where: { id: planId },
      data: {
        totalQuota,
      },
      include: {
        service: true,
      },
    });

    logger.info(`Admin updated plan quota`, {
      adminId: req.user.id,
      planId,
      oldQuota: existingPlan.totalQuota,
      newQuota: totalQuota,
      reason,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { plan: updatedPlan },
      "Plan quota updated successfully"
    );
  } catch (error) {
    logger.error("Error updating plan quota:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update plan quota"
    );
  }
};

/**
 * Get quota utilization statistics
 * GET /api/admin/quota/statistics
 */
export const getQuotaStatistics = async (req, res) => {
  try {
    const [
      totalPlans,
      totalQuota,
      totalUsedQuota,
      criticalPlans,
      warningPlans,
    ] = await Promise.all([
      prisma.servicePlan.count(),
      prisma.servicePlan.aggregate({
        _sum: {
          totalQuota: true,
        },
      }),
      prisma.subscription.count({
        where: {
          status: {
            in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
          },
        },
      }),
      prisma.servicePlan.count({
        where: {
          AND: [
            { totalQuota: { gt: 0 } },
            {
              subscriptions: {
                some: {
                  status: {
                    in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                  },
                },
              },
            },
          ],
        },
      }),
      prisma.servicePlan.count({
        where: {
          AND: [
            { totalQuota: { gt: 0 } },
            {
              subscriptions: {
                some: {
                  status: {
                    in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                  },
                },
              },
            },
          ],
        },
      }),
    ]);

    const totalQuotaSum = totalQuota._sum.totalQuota || 0;
    const overallUtilization =
      totalQuotaSum > 0
        ? Math.round((totalUsedQuota / totalQuotaSum) * 100)
        : 0;

    // Get plans with high utilization
    const plansWithUtilization = await prisma.servicePlan.findMany({
      include: {
        service: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            subscriptions: {
              where: {
                status: {
                  in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                },
              },
            },
          },
        },
      },
    });

    const criticalPlansList = plansWithUtilization.filter((plan) => {
      const utilization =
        plan.totalQuota > 0
          ? (plan._count.subscriptions / plan.totalQuota) * 100
          : 0;
      return utilization >= 90;
    });

    const warningPlansList = plansWithUtilization.filter((plan) => {
      const utilization =
        plan.totalQuota > 0
          ? (plan._count.subscriptions / plan.totalQuota) * 100
          : 0;
      return utilization >= 75 && utilization < 90;
    });

    const statistics = {
      overview: {
        totalPlans,
        totalQuota: totalQuotaSum,
        totalUsedQuota,
        totalAvailableQuota: totalQuotaSum - totalUsedQuota,
        overallUtilization,
      },
      alerts: {
        criticalPlans: criticalPlansList.length,
        warningPlans: warningPlansList.length,
        criticalPlansList: criticalPlansList.map((plan) => ({
          id: plan.id,
          name: plan.name,
          serviceName: plan.service.name,
          utilization:
            plan.totalQuota > 0
              ? Math.round((plan._count.subscriptions / plan.totalQuota) * 100)
              : 0,
        })),
        warningPlansList: warningPlansList.map((plan) => ({
          id: plan.id,
          name: plan.name,
          serviceName: plan.service.name,
          utilization:
            plan.totalQuota > 0
              ? Math.round((plan._count.subscriptions / plan.totalQuota) * 100)
              : 0,
        })),
      },
    };

    logger.info(`Admin retrieved quota statistics`, {
      adminId: req.user.id,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { statistics },
      "Quota statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving quota statistics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve quota statistics"
    );
  }
};

/**
 * Bulk update quotas for multiple plans
 * PUT /api/admin/quota/bulk-update
 */
export const bulkUpdateQuotas = async (req, res) => {
  try {
    const { updates, reason } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Updates array is required and cannot be empty"
      );
    }

    // Validate all plan IDs exist and new quotas are valid
    const planIds = updates.map((update) => update.planId);
    const existingPlans = await prisma.servicePlan.findMany({
      where: {
        id: {
          in: planIds,
        },
      },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: {
                status: {
                  in: ["ACTIVE", "PENDING_PAYMENT", "PENDING_UPGRADE"],
                },
              },
            },
          },
        },
      },
    });

    if (existingPlans.length !== planIds.length) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "One or more service plans not found"
      );
    }

    // Validate quotas
    const validationErrors = [];
    for (const update of updates) {
      const plan = existingPlans.find((p) => p.id === update.planId);
      if (update.totalQuota < plan._count.subscriptions) {
        validationErrors.push({
          planId: update.planId,
          error: `Cannot set quota to ${update.totalQuota}. Currently ${plan._count.subscriptions} subscriptions are active.`,
        });
      }
    }

    if (validationErrors.length > 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        { validationErrors },
        "Validation errors"
      );
    }

    // Perform bulk update
    const updatePromises = updates.map((update) =>
      prisma.servicePlan.update({
        where: { id: update.planId },
        data: { totalQuota: update.totalQuota },
      })
    );

    const updatedPlans = await Promise.all(updatePromises);

    logger.info(`Admin performed bulk quota update`, {
      adminId: req.user.id,
      updatedPlans: updates.length,
      reason,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { updatedPlans },
      "Bulk quota update completed successfully"
    );
  } catch (error) {
    logger.error("Error performing bulk quota update:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to perform bulk quota update"
    );
  }
};
