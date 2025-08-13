import prisma from "../utils/prisma.js";

class CreditService {
  /**
   * Check if user has sufficient credit for a transaction
   * @param {string} userId - User ID
   * @param {number} amount - Amount to check (in IDR)
   * @returns {Promise<Object>} Credit check result
   */
  async checkSufficientCredit(userId, amount) {
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
      throw new Error("User not found");
    }

    const hasSufficientCredit = user.creditBalance >= amount;

    return {
      userId: user.id,
      userName: user.name,
      currentBalance: user.creditBalance,
      requiredAmount: amount,
      hasSufficientCredit,
      shortfall: hasSufficientCredit ? 0 : amount - user.creditBalance,
    };
  }

  /**
   * Deduct credit from user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deduct (in IDR)
   * @param {string} description - Transaction description
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Transaction result
   */
  async deductCredit(userId, amount, description, metadata = {}) {
    return await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          creditBalance: true,
          totalSpent: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.creditBalance < amount) {
        throw new Error(
          `Insufficient credit. Balance: ${user.creditBalance}, Required: ${amount}`
        );
      }

      const balanceBefore = user.creditBalance;
      const balanceAfter = balanceBefore - amount;

      // Update user balance and total spent
      await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
          totalSpent: { increment: amount },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: metadata.type || "SUBSCRIPTION",
          status: "COMPLETED",
          amount,
          balanceBefore,
          balanceAfter,
          description,
          metadata,
          subscriptionId: metadata.subscriptionId || null,
          completedAt: new Date(),
        },
      });

      return {
        transactionId: transaction.id,
        userId: user.id,
        userName: user.name,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        success: true,
      };
    });
  }

  /**
   * Add credit to user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add (in IDR)
   * @param {string} description - Transaction description
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Transaction result
   */
  async addCredit(userId, amount, description, metadata = {}) {
    return await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          creditBalance: true,
          totalTopUp: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const balanceBefore = user.creditBalance;
      const balanceAfter = balanceBefore + amount;

      // Update user balance and total top-up
      await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
          totalTopUp: { increment: amount },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: metadata.type || "TOP_UP",
          status: metadata.status || "COMPLETED",
          amount,
          balanceBefore,
          balanceAfter,
          paymentMethod: metadata.paymentMethod || null,
          paymentReference: metadata.paymentReference || null,
          description,
          metadata,
          completedAt: metadata.status === "COMPLETED" ? new Date() : null,
        },
      });

      return {
        transactionId: transaction.id,
        userId: user.id,
        userName: user.name,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        success: true,
      };
    });
  }

  /**
   * Get user credit balance and statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User credit information
   */
  async getUserCreditInfo(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        totalTopUp: true,
        totalSpent: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Get monthly spending (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlySpending = await prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ["SUBSCRIPTION", "UPGRADE"] },
        status: "COMPLETED",
        completedAt: { gte: currentMonth },
      },
      _sum: { amount: true },
    });

    return {
      userId: user.id,
      userName: user.name,
      email: user.email,
      creditBalance: user.creditBalance,
      totalTopUp: user.totalTopUp,
      totalSpent: user.totalSpent,
      monthlySpending: monthlySpending._sum.amount || 0,
      netBalance: user.totalTopUp - user.totalSpent,
      memberSince: user.createdAt,
      recentTransactions,
    };
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction history with pagination
   */
  async getTransactionHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      type = null,
      status = null,
      startDate = null,
      endDate = null,
    } = options;

    const offset = (page - 1) * limit;

    const whereClause = {
      userId,
      ...(type && { type }),
      ...(status && { status }),
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
        orderBy: { createdAt: "desc" },
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
      },
    };
  }

  /**
   * Refund credit to user (for cancellations, failures, etc.)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to refund (in IDR)
   * @param {string} description - Refund description
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Refund result
   */
  async refundCredit(userId, amount, description, metadata = {}) {
    return await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          creditBalance: true,
          totalSpent: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const balanceBefore = user.creditBalance;
      const balanceAfter = balanceBefore + amount;

      // Update user balance and reduce total spent
      await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
          totalSpent: { decrement: Math.min(amount, user.totalSpent) },
        },
      });

      // Create refund transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "REFUND",
          status: "COMPLETED",
          amount,
          balanceBefore,
          balanceAfter,
          description,
          metadata: {
            ...metadata,
            refundReason: metadata.reason || "Service cancellation",
            originalTransactionId: metadata.originalTransactionId || null,
          },
          subscriptionId: metadata.subscriptionId || null,
          completedAt: new Date(),
        },
      });

      return {
        transactionId: transaction.id,
        userId: user.id,
        userName: user.name,
        refundAmount: amount,
        balanceBefore,
        balanceAfter,
        description,
        success: true,
      };
    });
  }

  /**
   * Admin credit adjustment (manual credit addition/deduction)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to adjust (positive for addition, negative for deduction)
   * @param {string} reason - Reason for adjustment
   * @param {string} adminId - Admin user ID performing the adjustment
   * @returns {Promise<Object>} Adjustment result
   */
  async adminCreditAdjustment(userId, amount, reason, adminId) {
    return await prisma.$transaction(async (tx) => {
      // Get current user balance
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          creditBalance: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Verify admin exists
      const admin = await tx.user.findUnique({
        where: { id: adminId, role: "ADMINISTRATOR" },
        select: { id: true, name: true },
      });

      if (!admin) {
        throw new Error("Admin user not found or insufficient permissions");
      }

      const balanceBefore = user.creditBalance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new Error("Adjustment would result in negative balance");
      }

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          creditBalance: balanceAfter,
          ...(amount > 0 && { totalTopUp: { increment: amount } }),
          ...(amount < 0 && { totalSpent: { increment: Math.abs(amount) } }),
        },
      });

      // Create adjustment transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: "ADMIN_ADJUSTMENT",
          status: "COMPLETED",
          amount: Math.abs(amount),
          balanceBefore,
          balanceAfter,
          description: `Admin adjustment: ${reason}`,
          metadata: {
            adjustmentType: amount > 0 ? "credit" : "debit",
            adminId,
            adminName: admin.name,
            reason,
          },
          processedBy: adminId,
          adminNotes: reason,
          completedAt: new Date(),
        },
      });

      return {
        transactionId: transaction.id,
        userId: user.id,
        userName: user.name,
        adjustmentAmount: amount,
        balanceBefore,
        balanceAfter,
        reason,
        processedBy: admin.name,
        success: true,
      };
    });
  }
}

export default new CreditService();
