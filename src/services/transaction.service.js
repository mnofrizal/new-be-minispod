import prisma from "../utils/prisma.js";

class TransactionService {
  /**
   * Create a new transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    const {
      userId,
      type,
      amount,
      description,
      paymentMethod = null,
      paymentReference = null,
      subscriptionId = null,
      metadata = {},
      status = "PENDING",
    } = transactionData;

    // Get user's current balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const balanceBefore = user.creditBalance;
    let balanceAfter = balanceBefore;

    // Calculate balance after for different transaction types
    if (type === "TOP_UP" && status === "COMPLETED") {
      balanceAfter = balanceBefore + amount;
    } else if (
      ["SUBSCRIPTION", "UPGRADE"].includes(type) &&
      status === "COMPLETED"
    ) {
      balanceAfter = balanceBefore - amount;
    } else if (type === "REFUND" && status === "COMPLETED") {
      balanceAfter = balanceBefore + amount;
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type,
        status,
        amount,
        balanceBefore,
        balanceAfter,
        paymentMethod,
        paymentReference,
        subscriptionId,
        description,
        metadata,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subscription: subscriptionId
          ? {
              select: {
                id: true,
                service: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
                plan: {
                  select: {
                    name: true,
                    planType: true,
                  },
                },
              },
            }
          : false,
      },
    });

    return transaction;
  }

  /**
   * Update transaction status
   * @param {string} transactionId - Transaction ID
   * @param {string} status - New status
   * @param {Object} updateData - Additional data to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionStatus(transactionId, status, updateData = {}) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            creditBalance: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Calculate new balance if status is changing to COMPLETED
    let balanceAfter = transaction.balanceAfter;
    if (status === "COMPLETED" && transaction.status !== "COMPLETED") {
      const currentUser = await prisma.user.findUnique({
        where: { id: transaction.userId },
        select: { creditBalance: true },
      });

      if (transaction.type === "TOP_UP") {
        balanceAfter = currentUser.creditBalance + transaction.amount;
      } else if (["SUBSCRIPTION", "UPGRADE"].includes(transaction.type)) {
        balanceAfter = currentUser.creditBalance - transaction.amount;
      } else if (transaction.type === "REFUND") {
        balanceAfter = currentUser.creditBalance + transaction.amount;
      }
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        balanceAfter,
        completedAt:
          status === "COMPLETED" ? new Date() : transaction.completedAt,
        metadata: updateData.metadata
          ? { ...transaction.metadata, ...updateData.metadata }
          : transaction.metadata,
        paymentReference:
          updateData.paymentReference || transaction.paymentReference,
        paymentProof: updateData.paymentProof || transaction.paymentProof,
        adminNotes: updateData.adminNotes || transaction.adminNotes,
        processedBy: updateData.processedBy || transaction.processedBy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subscription: transaction.subscriptionId
          ? {
              select: {
                id: true,
                service: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
                plan: {
                  select: {
                    name: true,
                    planType: true,
                  },
                },
              },
            }
          : false,
      },
    });

    return updatedTransaction;
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionById(transactionId, userId = null) {
    const whereClause = {
      id: transactionId,
      ...(userId && { userId }), // If userId provided, ensure user can only access their own transactions
    };

    const transaction = await prisma.transaction.findFirst({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subscription: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
                slug: true,
              },
            },
            plan: {
              select: {
                name: true,
                planType: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return transaction;
  }

  /**
   * Get transactions with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Transactions with pagination info
   */
  async getTransactions(filters = {}, pagination = {}) {
    const {
      userId = null,
      type = null,
      status = null,
      paymentMethod = null,
      startDate = null,
      endDate = null,
      subscriptionId = null,
    } = filters;

    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = pagination;

    const offset = (page - 1) * limit;

    const whereClause = {
      ...(userId && { userId }),
      ...(type && { type }),
      ...(status && { status }),
      ...(paymentMethod && { paymentMethod }),
      ...(subscriptionId && { subscriptionId }),
      ...(startDate &&
        endDate && {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          subscription: {
            select: {
              id: true,
              service: {
                select: {
                  name: true,
                  slug: true,
                },
              },
              plan: {
                select: {
                  name: true,
                  planType: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where: whereClause }),
    ]);

    return {
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: offset + limit < totalCount,
        limit,
      },
    };
  }

  /**
   * Get transaction statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Transaction statistics
   */
  async getTransactionStatistics(filters = {}) {
    const {
      userId = null,
      startDate = null,
      endDate = null,
      period = "month", // 'day', 'week', 'month', 'year'
    } = filters;

    const whereClause = {
      ...(userId && { userId }),
      status: "COMPLETED",
      ...(startDate &&
        endDate && {
          completedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    // Get overall statistics
    const [totalStats, typeStats] = await Promise.all([
      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await prisma.transaction.findMany({
      where: {
        ...whereClause,
        completedAt: { gte: thirtyDaysAgo },
      },
      select: {
        type: true,
        amount: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
      take: 100,
    });

    // Calculate period-based statistics
    const periodStats = this._calculatePeriodStats(recentActivity, period);

    return {
      overview: {
        totalAmount: totalStats._sum.amount || 0,
        totalTransactions: totalStats._count.id || 0,
        averageAmount: totalStats._avg.amount || 0,
      },
      byType: typeStats.reduce((acc, stat) => {
        acc[stat.type] = {
          totalAmount: stat._sum.amount || 0,
          count: stat._count.id || 0,
        };
        return acc;
      }, {}),
      periodStats,
      recentActivity: recentActivity.slice(0, 10), // Last 10 transactions
    };
  }

  /**
   * Get pending transactions that need processing
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pending transactions
   */
  async getPendingTransactions(options = {}) {
    const { type = null, olderThan = null, limit = 50 } = options;

    const whereClause = {
      status: "PENDING",
      ...(type && { type }),
      ...(olderThan && {
        createdAt: {
          lt: new Date(Date.now() - olderThan * 60 * 1000), // olderThan in minutes
        },
      }),
    };

    return await prisma.transaction.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subscription: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /**
   * Mark transaction as failed
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Failure reason
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated transaction
   */
  async markTransactionFailed(transactionId, reason, metadata = {}) {
    return await this.updateTransactionStatus(transactionId, "FAILED", {
      adminNotes: reason,
      metadata: {
        failureReason: reason,
        failedAt: new Date().toISOString(),
        ...metadata,
      },
    });
  }

  /**
   * Retry a failed transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Updated transaction
   */
  async retryTransaction(transactionId) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "FAILED") {
      throw new Error("Can only retry failed transactions");
    }

    return await this.updateTransactionStatus(transactionId, "PENDING", {
      metadata: {
        ...transaction.metadata,
        retryAttempt: (transaction.metadata?.retryAttempt || 0) + 1,
        retriedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Calculate period-based statistics
   * @private
   */
  _calculatePeriodStats(transactions, period) {
    const stats = {};
    const now = new Date();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.completedAt);
      let key;

      switch (period) {
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          break;
        case "year":
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString().split("T")[0];
      }

      if (!stats[key]) {
        stats[key] = {
          totalAmount: 0,
          count: 0,
          byType: {},
        };
      }

      stats[key].totalAmount += transaction.amount;
      stats[key].count += 1;

      if (!stats[key].byType[transaction.type]) {
        stats[key].byType[transaction.type] = {
          amount: 0,
          count: 0,
        };
      }

      stats[key].byType[transaction.type].amount += transaction.amount;
      stats[key].byType[transaction.type].count += 1;
    });

    return stats;
  }

  /**
   * Get revenue statistics for admin dashboard
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Revenue statistics
   */
  async getRevenueStatistics(options = {}) {
    const { startDate, endDate } = options;

    const whereClause = {
      status: "COMPLETED",
      type: { in: ["SUBSCRIPTION", "UPGRADE"] },
      ...(startDate &&
        endDate && {
          completedAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [revenueStats, monthlyRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where: whereClause,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Get top-up statistics
    const topUpStats = await prisma.transaction.aggregate({
      where: {
        status: "COMPLETED",
        type: "TOP_UP",
        ...(startDate &&
          endDate && {
            completedAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      totalRevenue: revenueStats._sum.amount || 0,
      totalRevenueTransactions: revenueStats._count.id || 0,
      totalTopUps: topUpStats._sum.amount || 0,
      totalTopUpTransactions: topUpStats._count.id || 0,
      revenueByType: monthlyRevenue.reduce((acc, stat) => {
        acc[stat.type] = {
          amount: stat._sum.amount || 0,
          count: stat._count.id || 0,
        };
        return acc;
      }, {}),
      netCashFlow:
        (topUpStats._sum.amount || 0) - (revenueStats._sum.amount || 0),
    };
  }
}

export default new TransactionService();
