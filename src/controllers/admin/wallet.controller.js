import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";
import creditService from "../../services/credit.service.js";

/**
 * Get wallet overview for all users
 * GET /api/admin/wallets/overview
 */
export const getWalletOverview = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "totalSpent",
      sortOrder = "desc",
      minBalance,
      maxBalance,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minBalance !== undefined || maxBalance !== undefined) {
      where.creditBalance = {};
      if (minBalance !== undefined) {
        where.creditBalance.gte = parseInt(minBalance);
      }
      if (maxBalance !== undefined) {
        where.creditBalance.lte = parseInt(maxBalance);
      }
    }

    // Get users with wallet information
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          creditBalance: true,
          totalTopUp: true,
          totalSpent: true,
          createdAt: true,
          _count: {
            select: {
              subscriptions: {
                where: {
                  status: "ACTIVE",
                },
              },
              transactions: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / take);

    // Calculate summary statistics
    const summaryStats = await prisma.user.aggregate({
      _sum: {
        creditBalance: true,
        totalTopUp: true,
        totalSpent: true,
      },
      _avg: {
        creditBalance: true,
        totalTopUp: true,
        totalSpent: true,
      },
    });

    const walletOverview = {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        creditBalance: user.creditBalance,
        totalTopUp: user.totalTopUp,
        totalSpent: user.totalSpent,
        activeSubscriptions: user._count.subscriptions,
        totalTransactions: user._count.transactions,
        memberSince: user.createdAt,
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
      summary: {
        totalBalance: summaryStats._sum.creditBalance || 0,
        totalTopUps: summaryStats._sum.totalTopUp || 0,
        totalSpent: summaryStats._sum.totalSpent || 0,
        averageBalance: Math.round(summaryStats._avg.creditBalance || 0),
        averageTopUp: Math.round(summaryStats._avg.totalTopUp || 0),
        averageSpent: Math.round(summaryStats._avg.totalSpent || 0),
      },
    };

    logger.info(`Admin retrieved wallet overview`, {
      adminId: req.user.id,
      filters: { search, minBalance, maxBalance },
      pagination: { page, limit },
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { walletOverview },
      "Wallet overview retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving wallet overview:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve wallet overview"
    );
  }
};

/**
 * Get detailed wallet information for a specific user
 * GET /api/admin/wallets/users/:userId
 */
export const getUserWalletDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
        totalTopUp: true,
        totalSpent: true,
        createdAt: true,
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          include: {
            subscription: {
              select: {
                id: true,
                service: {
                  select: {
                    name: true,
                  },
                },
                plan: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        subscriptions: {
          where: {
            status: "ACTIVE",
          },
          include: {
            service: {
              select: {
                name: true,
              },
            },
            plan: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    const walletDetails = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        memberSince: user.createdAt,
      },
      balance: {
        current: user.creditBalance,
        totalTopUp: user.totalTopUp,
        totalSpent: user.totalSpent,
        netBalance: user.totalTopUp - user.totalSpent,
      },
      recentTransactions: user.transactions.map((tx) => ({
        id: tx.id,
        customId: tx.customId,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        status: tx.status,
        createdAt: tx.createdAt,
        subscription: tx.subscription
          ? {
              id: tx.subscription.id,
              serviceName: tx.subscription.service.name,
              planName: tx.subscription.plan.name,
            }
          : null,
      })),
      activeSubscriptions: user.subscriptions.map((sub) => ({
        id: sub.id,
        serviceName: sub.service.name,
        planName: sub.plan.name,
        monthlyPrice: sub.plan.price,
        nextBilling: sub.nextBilling,
      })),
    };

    logger.info(`Admin retrieved user wallet details`, {
      adminId: req.user.id,
      userId,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { walletDetails },
      "User wallet details retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving user wallet details:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve user wallet details"
    );
  }
};

/**
 * Add credit to user's wallet (Admin adjustment)
 * POST /api/admin/wallets/users/:userId/add-credit
 */
export const addCreditToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason, description } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
      },
    });

    if (!user) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    // Add credit using the credit service
    const transaction = await creditService.addCredit(
      userId,
      amount,
      `Admin Credit Addition: ${reason || "Manual adjustment"}`,
      {
        type: "ADMIN_ADJUSTMENT",
        adminId: req.user.id,
        adminEmail: req.user.email,
        reason,
        description,
      }
    );

    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        totalTopUp: true,
      },
    });

    logger.info(`Admin added credit to user wallet`, {
      adminId: req.user.id,
      userId,
      amount,
      reason,
      transactionId: transaction.id,
      newBalance: updatedUser.creditBalance,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        transaction: {
          id: transaction.id,
          customId: transaction.customId,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          previousBalance: user.creditBalance,
          newBalance: updatedUser.creditBalance,
          totalTopUp: updatedUser.totalTopUp,
        },
      },
      "Credit added to user wallet successfully"
    );
  } catch (error) {
    logger.error("Error adding credit to user wallet:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to add credit to user wallet"
    );
  }
};

/**
 * Deduct credit from user's wallet (Admin adjustment)
 * POST /api/admin/wallets/users/:userId/deduct-credit
 */
export const deductCreditFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason, description, allowNegative = false } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
      },
    });

    if (!user) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    // Check if user has sufficient balance (unless allowNegative is true)
    if (!allowNegative && user.creditBalance < amount) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        `Insufficient balance. User has ${user.creditBalance} credits, but ${amount} credits requested for deduction.`
      );
    }

    // Deduct credit using the credit service
    const transaction = await creditService.deductCredit(
      userId,
      amount,
      `Admin Credit Deduction: ${reason || "Manual adjustment"}`,
      {
        type: "ADMIN_ADJUSTMENT",
        adminId: req.user.id,
        adminEmail: req.user.email,
        reason,
        description,
        allowNegative,
      }
    );

    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        totalSpent: true,
      },
    });

    logger.info(`Admin deducted credit from user wallet`, {
      adminId: req.user.id,
      userId,
      amount,
      reason,
      allowNegative,
      transactionId: transaction.id,
      newBalance: updatedUser.creditBalance,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        transaction: {
          id: transaction.id,
          customId: transaction.customId,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          previousBalance: user.creditBalance,
          newBalance: updatedUser.creditBalance,
          totalSpent: updatedUser.totalSpent,
        },
      },
      "Credit deducted from user wallet successfully"
    );
  } catch (error) {
    logger.error("Error deducting credit from user wallet:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to deduct credit from user wallet"
    );
  }
};

/**
 * Get wallet statistics
 * GET /api/admin/wallets/statistics
 */
export const getWalletStatistics = async (req, res) => {
  try {
    const [
      totalUsers,
      usersWithBalance,
      usersWithNegativeBalance,
      totalTransactions,
      recentTransactions,
      balanceStats,
      topUpStats,
      spentStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          creditBalance: {
            gt: 0,
          },
        },
      }),
      prisma.user.count({
        where: {
          creditBalance: {
            lt: 0,
          },
        },
      }),
      prisma.transaction.count(),
      prisma.transaction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      prisma.user.aggregate({
        _sum: {
          creditBalance: true,
        },
        _avg: {
          creditBalance: true,
        },
        _min: {
          creditBalance: true,
        },
        _max: {
          creditBalance: true,
        },
      }),
      prisma.user.aggregate({
        _sum: {
          totalTopUp: true,
        },
        _avg: {
          totalTopUp: true,
        },
      }),
      prisma.user.aggregate({
        _sum: {
          totalSpent: true,
        },
        _avg: {
          totalSpent: true,
        },
      }),
    ]);

    // Get transaction type breakdown
    const transactionTypeBreakdown = await prisma.transaction.groupBy({
      by: ["type"],
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    const statistics = {
      users: {
        total: totalUsers,
        withBalance: usersWithBalance,
        withNegativeBalance: usersWithNegativeBalance,
        withZeroBalance:
          totalUsers - usersWithBalance - usersWithNegativeBalance,
      },
      transactions: {
        total: totalTransactions,
        recent24h: recentTransactions,
        byType: transactionTypeBreakdown.map((item) => ({
          type: item.type,
          count: item._count.id,
          totalAmount: item._sum.amount || 0,
        })),
      },
      balances: {
        totalBalance: balanceStats._sum.creditBalance || 0,
        averageBalance: Math.round(balanceStats._avg.creditBalance || 0),
        minBalance: balanceStats._min.creditBalance || 0,
        maxBalance: balanceStats._max.creditBalance || 0,
      },
      topUps: {
        totalTopUps: topUpStats._sum.totalTopUp || 0,
        averageTopUp: Math.round(topUpStats._avg.totalTopUp || 0),
      },
      spending: {
        totalSpent: spentStats._sum.totalSpent || 0,
        averageSpent: Math.round(spentStats._avg.totalSpent || 0),
      },
    };

    logger.info(`Admin retrieved wallet statistics`, {
      adminId: req.user.id,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { statistics },
      "Wallet statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving wallet statistics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve wallet statistics"
    );
  }
};

/**
 * Bulk credit adjustment for multiple users
 * POST /api/admin/wallets/bulk-adjustment
 */
export const bulkCreditAdjustment = async (req, res) => {
  try {
    const { adjustments, reason, description } = req.body;

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Adjustments array is required and cannot be empty"
      );
    }

    // Validate all user IDs exist
    const userIds = adjustments.map((adj) => adj.userId);
    const existingUsers = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
        creditBalance: true,
      },
    });

    if (existingUsers.length !== userIds.length) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "One or more users not found"
      );
    }

    // Validate adjustments
    const validationErrors = [];
    for (const adjustment of adjustments) {
      const user = existingUsers.find((u) => u.id === adjustment.userId);
      if (
        adjustment.type === "DEDUCT" &&
        !adjustment.allowNegative &&
        user.creditBalance < adjustment.amount
      ) {
        validationErrors.push({
          userId: adjustment.userId,
          userEmail: user.email,
          error: `Insufficient balance. User has ${user.creditBalance} credits, but ${adjustment.amount} credits requested for deduction.`,
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

    // Perform bulk adjustments
    const results = [];
    for (const adjustment of adjustments) {
      try {
        let transaction;
        if (adjustment.type === "ADD") {
          transaction = await creditService.addCredit(
            adjustment.userId,
            adjustment.amount,
            `Bulk Admin Credit Addition: ${reason || "Bulk adjustment"}`,
            {
              type: "ADMIN_ADJUSTMENT",
              adminId: req.user.id,
              adminEmail: req.user.email,
              reason,
              description,
              bulkOperation: true,
            }
          );
        } else {
          transaction = await creditService.deductCredit(
            adjustment.userId,
            adjustment.amount,
            `Bulk Admin Credit Deduction: ${reason || "Bulk adjustment"}`,
            {
              type: "ADMIN_ADJUSTMENT",
              adminId: req.user.id,
              adminEmail: req.user.email,
              reason,
              description,
              allowNegative: adjustment.allowNegative || false,
              bulkOperation: true,
            }
          );
        }

        results.push({
          userId: adjustment.userId,
          success: true,
          transactionId: transaction.id,
          customId: transaction.customId,
        });
      } catch (error) {
        results.push({
          userId: adjustment.userId,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info(`Admin performed bulk credit adjustment`, {
      adminId: req.user.id,
      totalAdjustments: adjustments.length,
      successCount,
      failureCount,
      reason,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        results,
        summary: {
          total: adjustments.length,
          successful: successCount,
          failed: failureCount,
        },
      },
      "Bulk credit adjustment completed"
    );
  } catch (error) {
    logger.error("Error performing bulk credit adjustment:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to perform bulk credit adjustment"
    );
  }
};
