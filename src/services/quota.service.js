import prisma from "../utils/prisma.js";

class QuotaService {
  /**
   * Check if quota is available for a service plan
   * @param {string} planId - Service plan ID
   * @param {number} requestedQuota - Number of quota slots requested (default: 1)
   * @returns {Promise<Object>} Quota availability information
   */
  async checkQuotaAvailability(planId, requestedQuota = 1) {
    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId, isActive: true },
      select: {
        id: true,
        name: true,
        totalQuota: true,
        usedQuota: true,
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
      throw new Error("Service plan not found");
    }

    const availableQuota = plan.totalQuota - plan.usedQuota;
    const isAvailable = availableQuota >= requestedQuota;

    return {
      planId: plan.id,
      planName: plan.name,
      serviceName: plan.service.name,
      totalQuota: plan.totalQuota,
      usedQuota: plan.usedQuota,
      availableQuota,
      requestedQuota,
      isAvailable,
      canAllocate: isAvailable,
    };
  }

  /**
   * Allocate quota for a service plan (increment usedQuota)
   * @param {string} planId - Service plan ID
   * @param {number} quotaAmount - Number of quota slots to allocate (default: 1)
   * @returns {Promise<Object>} Updated quota information
   */
  async allocateQuota(planId, quotaAmount = 1) {
    // Use transaction to ensure consistency
    return await prisma.$transaction(async (tx) => {
      // First, check current quota availability
      const plan = await tx.servicePlan.findUnique({
        where: { id: planId, isActive: true },
        select: {
          id: true,
          name: true,
          totalQuota: true,
          usedQuota: true,
          service: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!plan) {
        throw new Error("Service plan not found");
      }

      const availableQuota = plan.totalQuota - plan.usedQuota;

      if (availableQuota < quotaAmount) {
        throw new Error(
          `Insufficient quota. Available: ${availableQuota}, Requested: ${quotaAmount}`
        );
      }

      // Allocate quota by incrementing usedQuota
      const updatedPlan = await tx.servicePlan.update({
        where: { id: planId },
        data: {
          usedQuota: { increment: quotaAmount },
        },
        select: {
          id: true,
          name: true,
          totalQuota: true,
          usedQuota: true,
        },
      });

      return {
        planId: updatedPlan.id,
        planName: updatedPlan.name,
        serviceName: plan.service.name,
        totalQuota: updatedPlan.totalQuota,
        usedQuota: updatedPlan.usedQuota,
        availableQuota: updatedPlan.totalQuota - updatedPlan.usedQuota,
        allocatedAmount: quotaAmount,
        success: true,
      };
    });
  }

  /**
   * Release quota for a service plan (decrement usedQuota)
   * @param {string} planId - Service plan ID
   * @param {number} quotaAmount - Number of quota slots to release (default: 1)
   * @returns {Promise<Object>} Updated quota information
   */
  async releaseQuota(planId, quotaAmount = 1) {
    // Use transaction to ensure consistency
    return await prisma.$transaction(async (tx) => {
      // First, get current plan information
      const plan = await tx.servicePlan.findUnique({
        where: { id: planId, isActive: true },
        select: {
          id: true,
          name: true,
          totalQuota: true,
          usedQuota: true,
          service: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!plan) {
        throw new Error("Service plan not found");
      }

      // Ensure we don't release more quota than is currently used
      const quotaToRelease = Math.min(quotaAmount, plan.usedQuota);

      if (quotaToRelease <= 0) {
        return {
          planId: plan.id,
          planName: plan.name,
          serviceName: plan.service.name,
          totalQuota: plan.totalQuota,
          usedQuota: plan.usedQuota,
          availableQuota: plan.totalQuota - plan.usedQuota,
          releasedAmount: 0,
          success: true,
          message: "No quota to release",
        };
      }

      // Release quota by decrementing usedQuota
      const updatedPlan = await tx.servicePlan.update({
        where: { id: planId },
        data: {
          usedQuota: { decrement: quotaToRelease },
        },
        select: {
          id: true,
          name: true,
          totalQuota: true,
          usedQuota: true,
        },
      });

      return {
        planId: updatedPlan.id,
        planName: updatedPlan.name,
        serviceName: plan.service.name,
        totalQuota: updatedPlan.totalQuota,
        usedQuota: updatedPlan.usedQuota,
        availableQuota: updatedPlan.totalQuota - updatedPlan.usedQuota,
        releasedAmount: quotaToRelease,
        success: true,
      };
    });
  }

  /**
   * Get quota overview for all service plans
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of quota information for all plans
   */
  async getQuotaOverview(options = {}) {
    const { serviceId, categoryId } = options;

    const whereClause = {
      isActive: true,
      ...(serviceId && { serviceId }),
      ...(categoryId && { service: { categoryId } }),
    };

    const plans = await prisma.servicePlan.findMany({
      where: whereClause,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
      orderBy: [
        { service: { category: { sortOrder: "asc" } } },
        { service: { sortOrder: "asc" } },
        { sortOrder: "asc" },
      ],
    });

    return plans.map((plan) => ({
      planId: plan.id,
      planName: plan.name,
      planType: plan.planType,
      serviceName: plan.service.name,
      serviceSlug: plan.service.slug,
      categoryName: plan.service.category.name,
      categorySlug: plan.service.category.slug,
      totalQuota: plan.totalQuota,
      usedQuota: plan.usedQuota,
      availableQuota: plan.totalQuota - plan.usedQuota,
      utilizationPercentage: Math.round(
        (plan.usedQuota / plan.totalQuota) * 100
      ),
      activeSubscriptions: plan._count.subscriptions,
      isNearCapacity: plan.usedQuota / plan.totalQuota >= 0.8, // 80% threshold
      isAtCapacity: plan.usedQuota >= plan.totalQuota,
    }));
  }

  /**
   * Get quota statistics summary
   * @returns {Promise<Object>} Overall quota statistics
   */
  async getQuotaStatistics() {
    const stats = await prisma.servicePlan.aggregate({
      where: { isActive: true },
      _sum: {
        totalQuota: true,
        usedQuota: true,
      },
      _count: {
        id: true,
      },
    });

    const totalQuota = stats._sum.totalQuota || 0;
    const usedQuota = stats._sum.usedQuota || 0;
    const availableQuota = totalQuota - usedQuota;
    const totalPlans = stats._count.id || 0;

    // Get all plans to calculate capacity manually
    const allPlans = await prisma.servicePlan.findMany({
      where: { isActive: true },
      select: {
        totalQuota: true,
        usedQuota: true,
      },
    });

    // Calculate plans near capacity (>= 80% utilization) and at capacity
    let plansNearCapacity = 0;
    let plansAtCapacity = 0;

    allPlans.forEach((plan) => {
      const utilizationRatio = plan.usedQuota / plan.totalQuota;
      if (utilizationRatio >= 1.0) {
        plansAtCapacity++;
      } else if (utilizationRatio >= 0.8) {
        plansNearCapacity++;
      }
    });

    return {
      totalQuota,
      usedQuota,
      availableQuota,
      utilizationPercentage:
        totalQuota > 0 ? Math.round((usedQuota / totalQuota) * 100) : 0,
      totalPlans,
      plansNearCapacity,
      plansAtCapacity,
      healthStatus:
        plansAtCapacity > 0
          ? "critical"
          : plansNearCapacity > 0
          ? "warning"
          : "healthy",
    };
  }

  /**
   * Validate quota operation before execution
   * @param {string} planId - Service plan ID
   * @param {string} operation - Operation type ('allocate' or 'release')
   * @param {number} amount - Quota amount
   * @returns {Promise<Object>} Validation result
   */
  async validateQuotaOperation(planId, operation, amount = 1) {
    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId, isActive: true },
      select: {
        id: true,
        name: true,
        totalQuota: true,
        usedQuota: true,
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!plan) {
      return {
        isValid: false,
        error: "Service plan not found",
        code: "PLAN_NOT_FOUND",
      };
    }

    const availableQuota = plan.totalQuota - plan.usedQuota;

    if (operation === "allocate") {
      if (availableQuota < amount) {
        return {
          isValid: false,
          error: `Insufficient quota. Available: ${availableQuota}, Requested: ${amount}`,
          code: "INSUFFICIENT_QUOTA",
          availableQuota,
          requestedAmount: amount,
        };
      }
    } else if (operation === "release") {
      if (plan.usedQuota < amount) {
        return {
          isValid: false,
          error: `Cannot release more quota than currently used. Used: ${plan.usedQuota}, Requested: ${amount}`,
          code: "INVALID_RELEASE_AMOUNT",
          usedQuota: plan.usedQuota,
          requestedAmount: amount,
        };
      }
    } else {
      return {
        isValid: false,
        error: 'Invalid operation. Must be "allocate" or "release"',
        code: "INVALID_OPERATION",
      };
    }

    return {
      isValid: true,
      planId: plan.id,
      planName: plan.name,
      serviceName: plan.service.name,
      operation,
      amount,
      currentUsed: plan.usedQuota,
      currentAvailable: availableQuota,
    };
  }
}

export default new QuotaService();
