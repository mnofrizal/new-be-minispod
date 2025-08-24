import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import subscriptionService from "../../services/subscription.service.js";
import creditService from "../../services/credit.service.js";
import quotaService from "../../services/quota.service.js";
import prisma from "../../utils/prisma.js";
import logger from "../../utils/logger.js";

class AdminSubscriptionController {
  /**
   * Create subscription for a user (admin only)
   * POST /api/admin/subscriptions
   */
  async createSubscriptionForUser(req, res) {
    try {
      const { userId, planId, skipCreditCheck = false, reason } = req.body;
      const adminId = req.user.userId;

      // Get user information
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
        },
      });

      if (!user) {
        return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
      }

      // Get plan information
      const plan = await prisma.servicePlan.findUnique({
        where: { id: planId, isActive: true },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
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

      // Check for existing active subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          serviceId: plan.serviceId,
          status: { in: ["ACTIVE", "PENDING_UPGRADE", "PENDING_PAYMENT"] },
        },
      });

      if (existingSubscription) {
        return sendResponse(
          res,
          StatusCodes.CONFLICT,
          null,
          "User already has an active subscription for this service"
        );
      }

      // Check credit balance (unless skipped by admin)
      if (!skipCreditCheck && user.creditBalance < plan.monthlyPrice) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          {
            currentBalance: user.creditBalance,
            requiredAmount: plan.monthlyPrice,
            shortfall: plan.monthlyPrice - user.creditBalance,
          },
          `User has insufficient credit. Balance: ${user.creditBalance}, Required: ${plan.monthlyPrice}`
        );
      }

      // Create subscription using the existing service with skipCreditCheck option and custom description
      const result = await subscriptionService.createSubscription(
        userId,
        planId,
        {
          skipCreditCheck,
          customDescription:
            reason ||
            `Admin created subscription: ${plan.service.name} - ${plan.name} plan`,
        }
      );

      // Log admin action
      logger.info("Admin created subscription", {
        adminId,
        userId,
        planId,
        subscriptionId: result.subscription.id,
        skipCreditCheck,
        reason,
      });

      sendResponse(
        res,
        StatusCodes.CREATED,
        {
          subscription: result.subscription,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          plan: {
            id: plan.id,
            name: plan.name,
            serviceName: plan.service.name,
            monthlyPrice: plan.monthlyPrice,
          },
          billing: {
            chargeAmount: result.chargeAmount,
            isBonusSubscription: result.isBonusSubscription,
            originalPrice: plan.monthlyPrice,
          },
          adminAction: {
            createdBy: adminId,
            reason: reason || "Admin created subscription",
            skipCreditCheck,
          },
        },
        result.message || "Subscription created successfully by admin"
      );
    } catch (error) {
      logger.error("Admin create subscription error:", error);

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
  }

  /**
   * Get all subscriptions (admin view)
   * GET /api/admin/subscriptions
   */
  async getAllSubscriptions(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        serviceId,
        userId,
        search,
      } = req.query;

      const offset = (page - 1) * limit;

      const whereClause = {
        ...(status && { status }),
        ...(serviceId && { serviceId }),
        ...(userId && { userId }),
        ...(search && {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { service: { name: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const [subscriptions, totalCount] = await Promise.all([
        prisma.subscription.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
            plan: {
              select: {
                id: true,
                name: true,
                planType: true,
                monthlyPrice: true,
              },
            },
            _count: {
              select: {
                instances: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: parseInt(limit),
          skip: offset,
        }),
        prisma.subscription.count({ where: whereClause }),
      ]);

      sendResponse(
        res,
        StatusCodes.OK,
        {
          subscriptions,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasMore: offset + parseInt(limit) < totalCount,
          },
        },
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
  }

  /**
   * Force cancel subscription (admin only)
   * DELETE /api/admin/subscriptions/:subscriptionId/force-cancel
   */
  async forceCancelSubscription(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { reason, terminateInstances = true } = req.body;
      const adminId = req.user.userId;

      const result = await prisma.$transaction(async (tx) => {
        // Get subscription
        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            service: { select: { name: true, slug: true } },
            plan: { select: { name: true, monthlyPrice: true } },
            instances: {
              where: { status: { in: ["RUNNING", "PENDING", "PROVISIONING"] } },
            },
          },
        });

        if (!subscription) {
          throw new Error("Subscription not found");
        }

        // Release quota
        await quotaService.releaseQuota(subscription.planId);

        // Update subscription status to CANCELLED
        const cancelledSubscription = await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: "CANCELLED",
            autoRenew: false,
            gracePeriodEnd: null,
          },
        });

        // Terminate instances if requested
        let instancesTerminated = 0;
        if (terminateInstances && subscription.instances.length > 0) {
          await tx.serviceInstance.updateMany({
            where: {
              subscriptionId,
              status: { in: ["RUNNING", "PENDING", "PROVISIONING"] },
            },
            data: {
              status: "TERMINATED",
            },
          });
          instancesTerminated = subscription.instances.length;
        }

        return {
          subscription: cancelledSubscription,
          instancesTerminated,
          originalSubscription: subscription,
        };
      });

      sendResponse(
        res,
        StatusCodes.OK,
        {
          subscription: result.subscription,
          instancesTerminated: result.instancesTerminated,
          message: "Subscription force-cancelled successfully",
          nextSteps: [
            "Subscription has been immediately cancelled",
            result.instancesTerminated > 0
              ? `${result.instancesTerminated} instances have been terminated`
              : "Service instances remain running",
            "Use refund endpoint if refund is needed",
          ],
        },
        "Subscription force-cancelled successfully"
      );
    } catch (error) {
      logger.error("Admin force cancel subscription error:", error);

      if (error.message.includes("not found")) {
        return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
      }

      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to force cancel subscription"
      );
    }
  }

  /**
   * Process manual refund for subscription (admin only)
   * POST /api/admin/subscriptions/:subscriptionId/refund
   */
  async processRefund(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { amount, reason, refundType = "PARTIAL" } = req.body;
      const adminId = req.user.userId;

      // Get subscription details
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          service: { select: { name: true } },
          plan: { select: { name: true, monthlyPrice: true } },
        },
      });

      if (!subscription) {
        return sendResponse(
          res,
          StatusCodes.NOT_FOUND,
          null,
          "Subscription not found"
        );
      }

      // Validate refund amount
      if (amount <= 0) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Refund amount must be greater than 0"
        );
      }

      if (refundType === "PARTIAL" && amount > subscription.plan.monthlyPrice) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Partial refund amount cannot exceed monthly price"
        );
      }

      // Process refund
      const refundResult = await creditService.refundCredit(
        subscription.userId,
        amount,
        `Admin refund for subscription: ${subscription.service.name} - ${reason}`,
        {
          subscriptionId,
          refundType,
          reason,
          adminId,
          originalAmount: subscription.plan.monthlyPrice,
        }
      );

      sendResponse(
        res,
        StatusCodes.OK,
        {
          refund: refundResult,
          subscription: {
            id: subscription.id,
            serviceName: subscription.service.name,
            planName: subscription.plan.name,
            monthlyPrice: subscription.plan.monthlyPrice,
          },
          user: {
            id: subscription.user.id,
            name: subscription.user.name,
            email: subscription.user.email,
          },
          refundDetails: {
            amount,
            refundType,
            reason,
            processedBy: adminId,
          },
        },
        "Refund processed successfully"
      );
    } catch (error) {
      logger.error("Admin process refund error:", error);

      if (error.message.includes("not found")) {
        return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
      }

      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to process refund"
      );
    }
  }

  /**
   * Get subscription statistics (admin dashboard)
   * GET /api/admin/subscriptions/stats
   */
  async getSubscriptionStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      const [
        totalSubscriptions,
        activeSubscriptions,
        cancelledSubscriptions,
        statusBreakdown,
        serviceBreakdown,
        planBreakdown,
        revenueStats,
      ] = await Promise.all([
        prisma.subscription.count({ where: dateFilter }),
        prisma.subscription.count({
          where: { ...dateFilter, status: "ACTIVE" },
        }),
        prisma.subscription.count({
          where: { ...dateFilter, status: "CANCELLED" },
        }),
        prisma.subscription.groupBy({
          by: ["status"],
          where: dateFilter,
          _count: { id: true },
        }),
        prisma.subscription.groupBy({
          by: ["serviceId"],
          where: dateFilter,
          _count: { id: true },
          include: {
            service: {
              select: { name: true, slug: true },
            },
          },
        }),
        prisma.subscription.groupBy({
          by: ["planId"],
          where: dateFilter,
          _count: { id: true },
          _sum: { monthlyPrice: true },
        }),
        prisma.subscription.aggregate({
          where: { ...dateFilter, status: "ACTIVE" },
          _sum: { monthlyPrice: true },
          _avg: { monthlyPrice: true },
        }),
      ]);

      sendResponse(
        res,
        StatusCodes.OK,
        {
          overview: {
            totalSubscriptions,
            activeSubscriptions,
            cancelledSubscriptions,
            cancellationRate:
              totalSubscriptions > 0
                ? Math.round(
                    (cancelledSubscriptions / totalSubscriptions) * 100
                  )
                : 0,
          },
          revenue: {
            monthlyRecurringRevenue: revenueStats._sum.monthlyPrice || 0,
            averageRevenuePerUser: revenueStats._avg.monthlyPrice || 0,
          },
          breakdown: {
            byStatus: statusBreakdown.reduce((acc, item) => {
              acc[item.status] = item._count.id;
              return acc;
            }, {}),
            byService: serviceBreakdown,
            byPlan: planBreakdown,
          },
        },
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
  }

  /**
   * Extend subscription end date (admin only)
   * PUT /api/admin/subscriptions/:subscriptionId/extend
   */
  async extendSubscription(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { extensionDays, reason } = req.body;
      const adminId = req.user.userId;

      if (!extensionDays || extensionDays <= 0) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Extension days must be greater than 0"
        );
      }

      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          service: { select: { name: true } },
          plan: { select: { name: true } },
        },
      });

      if (!subscription) {
        return sendResponse(
          res,
          StatusCodes.NOT_FOUND,
          null,
          "Subscription not found"
        );
      }

      // Calculate new end date
      const currentEndDate = new Date(subscription.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + extensionDays);

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          endDate: newEndDate,
          nextBilling: subscription.autoRenew ? newEndDate : null,
        },
      });

      sendResponse(
        res,
        StatusCodes.OK,
        {
          subscription: updatedSubscription,
          extension: {
            days: extensionDays,
            previousEndDate: currentEndDate,
            newEndDate,
            reason,
            processedBy: adminId,
          },
        },
        "Subscription extended successfully"
      );
    } catch (error) {
      logger.error("Admin extend subscription error:", error);
      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to extend subscription"
      );
    }
  }

  /**
   * Upgrade subscription for a user (admin only)
   * PUT /api/admin/subscriptions/:subscriptionId/upgrade
   */
  async upgradeSubscriptionForUser(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { newPlanId, skipCreditCheck = false, reason } = req.body;
      const adminId = req.user.userId;

      // Get subscription details
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              creditBalance: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              planType: true,
              monthlyPrice: true,
            },
          },
        },
      });

      if (!subscription) {
        return sendResponse(
          res,
          StatusCodes.NOT_FOUND,
          null,
          "Subscription not found"
        );
      }

      if (subscription.status !== "ACTIVE") {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Can only upgrade active subscriptions"
        );
      }

      // Get new plan information
      const newPlan = await prisma.servicePlan.findUnique({
        where: { id: newPlanId, isActive: true },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!newPlan) {
        return sendResponse(
          res,
          StatusCodes.NOT_FOUND,
          null,
          "New service plan not found"
        );
      }

      // Validate upgrade path (must be same service and higher tier)
      if (newPlan.serviceId !== subscription.serviceId) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Cannot upgrade to a different service"
        );
      }

      const planTypeOrder = {
        FREE: 0,
        BASIC: 1,
        PRO: 2,
        PREMIUM: 3,
        ENTERPRISE: 4,
      };
      const currentTier = planTypeOrder[subscription.plan.planType];
      const newTier = planTypeOrder[newPlan.planType];

      if (newTier <= currentTier) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Can only upgrade to a higher tier plan"
        );
      }

      // Calculate prorated cost for validation
      const now = new Date();
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      const daysRemaining = Math.ceil(
        (subscription.endDate - now) / (1000 * 60 * 60 * 24)
      );
      const proratedRatio = Math.max(0, daysRemaining) / daysInMonth;
      const upgradeCost =
        (newPlan.monthlyPrice - subscription.plan.monthlyPrice) * proratedRatio;

      // Check credit balance (unless skipped by admin)
      if (
        !skipCreditCheck &&
        upgradeCost > 0 &&
        subscription.user.creditBalance < upgradeCost
      ) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          {
            currentBalance: subscription.user.creditBalance,
            requiredAmount: upgradeCost,
            shortfall: upgradeCost - subscription.user.creditBalance,
          },
          `User has insufficient credit for upgrade. Balance: ${subscription.user.creditBalance}, Required: ${upgradeCost}`
        );
      }

      // Upgrade subscription using the existing service with skipCreditCheck option and custom description
      const result = await subscriptionService.upgradeSubscription(
        subscriptionId,
        newPlanId,
        {
          skipCreditCheck,
          customDescription:
            reason ||
            `Admin upgrade: ${subscription.service.name} from ${subscription.plan.name} to ${newPlan.name}`,
        }
      );

      // Log admin action
      logger.info("Admin upgraded subscription", {
        adminId,
        subscriptionId,
        userId: subscription.userId,
        oldPlanId: subscription.planId,
        newPlanId,
        upgradeCost: result.upgradeCost,
        actualCharge: result.actualCharge,
        skipCreditCheck,
        reason,
      });

      sendResponse(
        res,
        StatusCodes.OK,
        {
          subscription: result.subscription,
          user: {
            id: subscription.user.id,
            name: subscription.user.name,
            email: subscription.user.email,
          },
          upgrade: {
            fromPlan: {
              id: subscription.plan.id,
              name: subscription.plan.name,
              planType: subscription.plan.planType,
              monthlyPrice: subscription.plan.monthlyPrice,
            },
            toPlan: {
              id: newPlan.id,
              name: newPlan.name,
              planType: newPlan.planType,
              monthlyPrice: newPlan.monthlyPrice,
            },
            upgradeCost: result.upgradeCost,
            actualCharge: result.actualCharge,
            proratedDays: result.proratedDays,
            isBonusUpgrade: result.isBonusUpgrade,
          },
          adminAction: {
            upgradedBy: adminId,
            reason: reason || "Admin upgrade",
            skipCreditCheck,
          },
        },
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
  }
}

export default new AdminSubscriptionController();
