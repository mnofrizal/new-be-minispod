import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";

/**
 * Get revenue analytics
 * GET /api/admin/analytics/revenue
 */
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = "30d", startDate, endDate } = req.query;

    let dateFilter = {};
    const now = new Date();

    // Set date filter based on period
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    } else {
      switch (period) {
        case "7d":
          dateFilter.createdAt = {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          };
          break;
        case "30d":
          dateFilter.createdAt = {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          };
          break;
        case "90d":
          dateFilter.createdAt = {
            gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          };
          break;
        case "1y":
          dateFilter.createdAt = {
            gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          };
          break;
        default:
          dateFilter.createdAt = {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          };
      }
    }

    // Get revenue data
    const [
      totalRevenue,
      subscriptionRevenue,
      topUpRevenue,
      refundAmount,
      revenueByService,
      dailyRevenue,
    ] = await Promise.all([
      // Total revenue from all completed transactions
      prisma.transaction.aggregate({
        where: {
          ...dateFilter,
          status: "COMPLETED",
          type: {
            in: ["SUBSCRIPTION", "UPGRADE", "TOP_UP"],
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue from subscriptions and upgrades
      prisma.transaction.aggregate({
        where: {
          ...dateFilter,
          status: "COMPLETED",
          type: {
            in: ["SUBSCRIPTION", "UPGRADE"],
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue from top-ups
      prisma.transaction.aggregate({
        where: {
          ...dateFilter,
          status: "COMPLETED",
          type: "TOP_UP",
        },
        _sum: {
          amount: true,
        },
      }),

      // Total refunds
      prisma.transaction.aggregate({
        where: {
          ...dateFilter,
          status: "COMPLETED",
          type: "REFUND",
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue by service
      prisma.transaction.findMany({
        where: {
          ...dateFilter,
          status: "COMPLETED",
          type: {
            in: ["SUBSCRIPTION", "UPGRADE"],
          },
          subscription: {
            isNot: null,
          },
        },
        include: {
          subscription: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      // Daily revenue breakdown
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          SUM(CASE WHEN type IN ('SUBSCRIPTION', 'UPGRADE', 'TOP_UP') THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'REFUND' THEN amount ELSE 0 END) as refunds,
          COUNT(*) as transaction_count
        FROM "transactions"
        WHERE "createdAt" >= ${
          dateFilter.createdAt?.gte ||
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }
          AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
        LIMIT 30
      `,
    ]);

    // Process revenue by service
    const serviceRevenueMap = new Map();
    revenueByService.forEach((tx) => {
      if (tx.subscription?.service) {
        const serviceId = tx.subscription.service.id;
        const serviceName = tx.subscription.service.name;

        if (!serviceRevenueMap.has(serviceId)) {
          serviceRevenueMap.set(serviceId, {
            serviceId,
            serviceName,
            revenue: 0,
            transactionCount: 0,
          });
        }

        const serviceData = serviceRevenueMap.get(serviceId);
        serviceData.revenue += tx.amount;
        serviceData.transactionCount += 1;
      }
    });

    const revenueAnalytics = {
      summary: {
        totalRevenue: totalRevenue._sum.amount || 0,
        subscriptionRevenue: subscriptionRevenue._sum.amount || 0,
        topUpRevenue: topUpRevenue._sum.amount || 0,
        refundAmount: refundAmount._sum.amount || 0,
        netRevenue:
          (totalRevenue._sum.amount || 0) - (refundAmount._sum.amount || 0),
      },
      byService: Array.from(serviceRevenueMap.values()).sort(
        (a, b) => b.revenue - a.revenue
      ),
      dailyBreakdown: dailyRevenue.map((day) => ({
        date: day.date,
        revenue: parseInt(day.revenue) || 0,
        refunds: parseInt(day.refunds) || 0,
        netRevenue: (parseInt(day.revenue) || 0) - (parseInt(day.refunds) || 0),
        transactionCount: parseInt(day.transaction_count) || 0,
      })),
    };

    logger.info(`Admin retrieved revenue analytics`, {
      adminId: req.user.id,
      period,
      totalRevenue: revenueAnalytics.summary.totalRevenue,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { revenueAnalytics },
      "Revenue analytics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving revenue analytics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve revenue analytics"
    );
  }
};

/**
 * Get subscription analytics
 * GET /api/admin/analytics/subscriptions
 */
export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    const now = new Date();
    let dateFilter = {};

    switch (period) {
      case "7d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };
        break;
      case "30d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
        break;
      case "90d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        };
        break;
      default:
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
    }

    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      newSubscriptions,
      subscriptionsByService,
      subscriptionsByPlan,
      churnRate,
    ] = await Promise.all([
      // Total subscriptions
      prisma.subscription.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: { status: "ACTIVE" },
      }),

      // Expired subscriptions
      prisma.subscription.count({
        where: { status: "EXPIRED" },
      }),

      // Cancelled subscriptions
      prisma.subscription.count({
        where: { status: "CANCELLED" },
      }),

      // New subscriptions in period
      prisma.subscription.count({
        where: dateFilter,
      }),

      // Subscriptions by service
      prisma.subscription.groupBy({
        by: ["serviceId"],
        _count: {
          id: true,
        },
        where: {
          status: "ACTIVE",
        },
      }),

      // Subscriptions by plan
      prisma.subscription.groupBy({
        by: ["planId"],
        _count: {
          id: true,
        },
        where: {
          status: "ACTIVE",
        },
      }),

      // Churn rate (cancelled in period vs total active at start of period)
      prisma.subscription.count({
        where: {
          status: "CANCELLED",
          updatedAt: dateFilter.createdAt,
        },
      }),
    ]);

    // Get service names for subscription breakdown
    const serviceIds = subscriptionsByService.map((s) => s.serviceId);
    const services = await prisma.service.findMany({
      where: {
        id: {
          in: serviceIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Get plan names for plan breakdown
    const planIds = subscriptionsByPlan.map((p) => p.planId);
    const plans = await prisma.servicePlan.findMany({
      where: {
        id: {
          in: planIds,
        },
      },
      include: {
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    const subscriptionAnalytics = {
      summary: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        cancelled: cancelledSubscriptions,
        newInPeriod: newSubscriptions,
        churnRate:
          activeSubscriptions > 0
            ? Math.round((churnRate / activeSubscriptions) * 100)
            : 0,
      },
      byService: subscriptionsByService
        .map((sub) => {
          const service = services.find((s) => s.id === sub.serviceId);
          return {
            serviceId: sub.serviceId,
            serviceName: service?.name || "Unknown",
            subscriptionCount: sub._count.id,
          };
        })
        .sort((a, b) => b.subscriptionCount - a.subscriptionCount),
      byPlan: subscriptionsByPlan
        .map((sub) => {
          const plan = plans.find((p) => p.id === sub.planId);
          return {
            planId: sub.planId,
            planName: plan?.name || "Unknown",
            serviceName: plan?.service?.name || "Unknown",
            subscriptionCount: sub._count.id,
          };
        })
        .sort((a, b) => b.subscriptionCount - a.subscriptionCount),
    };

    logger.info(`Admin retrieved subscription analytics`, {
      adminId: req.user.id,
      period,
      activeSubscriptions,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { subscriptionAnalytics },
      "Subscription analytics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving subscription analytics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve subscription analytics"
    );
  }
};

/**
 * Get user analytics
 * GET /api/admin/analytics/users
 */
export const getUserAnalytics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    const now = new Date();
    let dateFilter = {};

    switch (period) {
      case "7d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };
        break;
      case "30d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
        break;
      case "90d":
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        };
        break;
      default:
        dateFilter.createdAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
    }

    const [
      totalUsers,
      newUsers,
      activeUsers,
      usersWithSubscriptions,
      usersWithBalance,
      topSpenders,
      userGrowth,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // New users in period
      prisma.user.count({
        where: dateFilter,
      }),

      // Active users (users with active subscriptions)
      prisma.user.count({
        where: {
          subscriptions: {
            some: {
              status: "ACTIVE",
            },
          },
        },
      }),

      // Users with any subscriptions
      prisma.user.count({
        where: {
          subscriptions: {
            some: {},
          },
        },
      }),

      // Users with positive balance
      prisma.user.count({
        where: {
          creditBalance: {
            gt: 0,
          },
        },
      }),

      // Top spenders
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          totalSpent: true,
          creditBalance: true,
          _count: {
            select: {
              subscriptions: {
                where: {
                  status: "ACTIVE",
                },
              },
            },
          },
        },
        orderBy: {
          totalSpent: "desc",
        },
        take: 10,
      }),

      // Daily user registration growth
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as new_users
        FROM "users"
        WHERE "createdAt" >= ${
          dateFilter.createdAt?.gte ||
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
        LIMIT 30
      `,
    ]);

    const userAnalytics = {
      summary: {
        total: totalUsers,
        newInPeriod: newUsers,
        active: activeUsers,
        withSubscriptions: usersWithSubscriptions,
        withBalance: usersWithBalance,
        conversionRate:
          totalUsers > 0
            ? Math.round((usersWithSubscriptions / totalUsers) * 100)
            : 0,
      },
      topSpenders: topSpenders.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        totalSpent: user.totalSpent,
        creditBalance: user.creditBalance,
        activeSubscriptions: user._count.subscriptions,
      })),
      growth: userGrowth.map((day) => ({
        date: day.date,
        newUsers: parseInt(day.new_users) || 0,
      })),
    };

    logger.info(`Admin retrieved user analytics`, {
      adminId: req.user.id,
      period,
      totalUsers,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { userAnalytics },
      "User analytics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving user analytics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve user analytics"
    );
  }
};

/**
 * Get service control usage metrics
 * GET /api/admin/analytics/service-control
 */
export const getServiceControlMetrics = async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    const now = new Date();
    let dateFilter = {};

    switch (period) {
      case "7d":
        dateFilter.updatedAt = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        };
        break;
      case "30d":
        dateFilter.updatedAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
        break;
      case "90d":
        dateFilter.updatedAt = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        };
        break;
      default:
        dateFilter.updatedAt = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        };
    }

    const [
      totalInstances,
      instancesByStatus,
      recentStatusChanges,
      serviceUsage,
    ] = await Promise.all([
      // Total service instances
      prisma.serviceInstance.count(),

      // Instances by status
      prisma.serviceInstance.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
      }),

      // Recent status changes (approximated by updated instances)
      prisma.serviceInstance.count({
        where: dateFilter,
      }),

      // Service usage breakdown - get instances with subscription and service info
      prisma.serviceInstance.findMany({
        select: {
          id: true,
          subscription: {
            select: {
              serviceId: true,
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Process service usage breakdown
    const serviceUsageMap = new Map();
    serviceUsage.forEach((instance) => {
      if (instance.subscription?.service) {
        const serviceId = instance.subscription.service.id;
        const serviceName = instance.subscription.service.name;

        if (!serviceUsageMap.has(serviceId)) {
          serviceUsageMap.set(serviceId, {
            serviceId,
            serviceName,
            instanceCount: 0,
          });
        }

        serviceUsageMap.get(serviceId).instanceCount += 1;
      }
    });

    const serviceControlMetrics = {
      summary: {
        totalInstances,
        recentStatusChanges,
      },
      byStatus: instancesByStatus.map((status) => ({
        status: status.status,
        count: status._count.id,
      })),
      byService: Array.from(serviceUsageMap.values()).sort(
        (a, b) => b.instanceCount - a.instanceCount
      ),
    };

    logger.info(`Admin retrieved service control metrics`, {
      adminId: req.user.id,
      period,
      totalInstances,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { serviceControlMetrics },
      "Service control metrics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving service control metrics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service control metrics"
    );
  }
};

/**
 * Get comprehensive dashboard analytics
 * GET /api/admin/analytics/dashboard
 */
export const getDashboardAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalRevenue,
      totalUsers,
      activeSubscriptions,
      totalInstances,
      recentTransactions,
      lowBalanceUsers,
      criticalQuotaPlans,
    ] = await Promise.all([
      // Total revenue (last 30 days)
      prisma.transaction.aggregate({
        where: {
          createdAt: {
            gte: last30Days,
          },
          status: "COMPLETED",
          type: {
            in: ["SUBSCRIPTION", "UPGRADE", "TOP_UP"],
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Total users
      prisma.user.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
        },
      }),

      // Total service instances
      prisma.serviceInstance.count(),

      // Recent transactions (last 10)
      prisma.transaction.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      }),

      // Users with low balance (less than 50,000 IDR)
      prisma.user.count({
        where: {
          creditBalance: {
            lt: 50000,
            gt: 0,
          },
          subscriptions: {
            some: {
              status: "ACTIVE",
            },
          },
        },
      }),

      // Service plans with high quota utilization (>90%)
      prisma.servicePlan.findMany({
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
      }),
    ]);

    // Filter critical quota plans
    const criticalPlans = criticalQuotaPlans.filter((plan) => {
      const utilization =
        plan.totalQuota > 0
          ? (plan._count.subscriptions / plan.totalQuota) * 100
          : 0;
      return utilization >= 90;
    });

    const dashboardAnalytics = {
      summary: {
        revenue30d: totalRevenue._sum.amount || 0,
        totalUsers,
        activeSubscriptions,
        totalInstances,
      },
      alerts: {
        lowBalanceUsers,
        criticalQuotaPlans: criticalPlans.length,
      },
      recentActivity: {
        transactions: recentTransactions.map((tx) => ({
          id: tx.id,
          customId: tx.customId,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          user: tx.user,
          createdAt: tx.createdAt,
        })),
      },
    };

    logger.info(`Admin retrieved dashboard analytics`, {
      adminId: req.user.id,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { dashboardAnalytics },
      "Dashboard analytics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving dashboard analytics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve dashboard analytics"
    );
  }
};
