import prisma from "../utils/prisma.js";
import creditService from "./credit.service.js";
import quotaService from "./quota.service.js";

class SubscriptionService {
  /**
   * Create a new subscription for a user
   * @param {string} userId - User ID
   * @param {string} planId - Service plan ID
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(userId, planId) {
    return await prisma.$transaction(async (tx) => {
      // Get user information
      const user = await tx.user.findUnique({
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

      // Get plan information
      const plan = await tx.servicePlan.findUnique({
        where: { id: planId, isActive: true },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              dockerImage: true,
              defaultPort: true,
              envTemplate: true,
            },
          },
        },
      });

      if (!plan) {
        throw new Error("Service plan not found");
      }

      // Check for existing active subscription for the same service (upgrade-only policy)
      const existingSubscription = await tx.subscription.findFirst({
        where: {
          userId,
          serviceId: plan.serviceId,
          status: { in: ["ACTIVE", "PENDING_UPGRADE", "PENDING_PAYMENT"] },
        },
      });

      if (existingSubscription) {
        throw new Error(
          "User already has an active subscription for this service. Use upgrade instead."
        );
      }

      // Check credit balance
      if (user.creditBalance < plan.monthlyPrice) {
        throw new Error(
          `Insufficient credit. Balance: ${user.creditBalance}, Required: ${plan.monthlyPrice}`
        );
      }

      // Check quota availability
      const quotaCheck = await quotaService.checkQuotaAvailability(planId);
      if (!quotaCheck.isAvailable) {
        throw new Error(
          "Service plan is at full capacity. Please try again later."
        );
      }

      // Calculate billing dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      const nextBilling = new Date(endDate);

      // Allocate quota
      await quotaService.allocateQuota(planId);

      // Deduct credit from user balance
      await creditService.deductCredit(
        userId,
        plan.monthlyPrice,
        `Subscription to ${plan.service.name} - ${plan.name} plan`,
        {
          type: "SUBSCRIPTION",
          planId,
          serviceName: plan.service.name,
          planName: plan.name,
        }
      );

      // Create subscription
      const subscription = await tx.subscription.create({
        data: {
          userId,
          serviceId: plan.serviceId,
          planId,
          status: "ACTIVE",
          startDate,
          endDate,
          nextBilling,
          monthlyPrice: plan.monthlyPrice,
          lastChargeAmount: plan.monthlyPrice,
          autoRenew: true,
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              dockerImage: true,
              defaultPort: true,
              envTemplate: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              planType: true,
              monthlyPrice: true,
              cpuMilli: true,
              memoryMb: true,
              storageGb: true,
              features: true,
            },
          },
        },
      });

      return {
        subscription,
        message: "Subscription created successfully",
        nextSteps: [
          "Service provisioning will begin shortly",
          "You will receive notifications about the deployment status",
        ],
      };
    });
  }

  /**
   * Upgrade an existing subscription to a higher plan
   * @param {string} subscriptionId - Subscription ID
   * @param {string} newPlanId - New plan ID
   * @returns {Promise<Object>} Upgraded subscription
   */
  async upgradeSubscription(subscriptionId, newPlanId) {
    return await prisma.$transaction(async (tx) => {
      // Get current subscription
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              creditBalance: true,
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
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (subscription.status !== "ACTIVE") {
        throw new Error("Can only upgrade active subscriptions");
      }

      // Get new plan
      const newPlan = await tx.servicePlan.findUnique({
        where: { id: newPlanId, isActive: true },
        select: {
          id: true,
          name: true,
          planType: true,
          monthlyPrice: true,
          serviceId: true,
          totalQuota: true,
          usedQuota: true,
        },
      });

      if (!newPlan) {
        throw new Error("New service plan not found");
      }

      // Validate upgrade path (must be same service and higher tier)
      if (newPlan.serviceId !== subscription.serviceId) {
        throw new Error("Cannot upgrade to a different service");
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
        throw new Error("Can only upgrade to a higher tier plan");
      }

      // Check quota availability for new plan
      const quotaCheck = await quotaService.checkQuotaAvailability(newPlanId);
      if (!quotaCheck.isAvailable) {
        throw new Error(
          "New service plan is at full capacity. Please try again later."
        );
      }

      // Calculate prorated cost
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

      const currentMonthlyPrice = subscription.plan.monthlyPrice;
      const newMonthlyPrice = newPlan.monthlyPrice;
      const upgradeCost =
        (newMonthlyPrice - currentMonthlyPrice) * proratedRatio;

      // Check if user has sufficient credit for upgrade
      if (upgradeCost > 0 && subscription.user.creditBalance < upgradeCost) {
        throw new Error(
          `Insufficient credit for upgrade. Balance: ${subscription.user.creditBalance}, Required: ${upgradeCost}`
        );
      }

      // Release quota from old plan and allocate to new plan
      await quotaService.releaseQuota(subscription.planId);
      await quotaService.allocateQuota(newPlanId);

      // Deduct upgrade cost if applicable
      if (upgradeCost > 0) {
        await creditService.deductCredit(
          subscription.userId,
          upgradeCost,
          `Upgrade ${subscription.service.name} from ${subscription.plan.name} to ${newPlan.name}`,
          {
            type: "UPGRADE",
            subscriptionId,
            oldPlanId: subscription.planId,
            newPlanId,
            proratedAmount: upgradeCost,
            daysRemaining,
          }
        );
      }

      // Update subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId: newPlanId,
          monthlyPrice: newPlan.monthlyPrice,
          previousPlanId: subscription.planId,
          upgradeDate: now,
          lastChargeAmount: upgradeCost > 0 ? upgradeCost : 0,
        },
        include: {
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
              cpuMilli: true,
              memoryMb: true,
              storageGb: true,
              features: true,
            },
          },
        },
      });

      return {
        subscription: updatedSubscription,
        upgradeCost,
        proratedDays: daysRemaining,
        message: "Subscription upgraded successfully",
        nextSteps: [
          "Service resources will be updated",
          "No downtime expected during the upgrade",
        ],
      };
    });
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(
    subscriptionId,
    reason = "User requested cancellation"
  ) {
    return await prisma.$transaction(async (tx) => {
      // Get subscription
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          service: {
            select: {
              name: true,
              slug: true,
            },
          },
          plan: {
            select: {
              name: true,
              monthlyPrice: true,
            },
          },
          instances: {
            where: { status: { in: ["RUNNING", "PENDING", "PROVISIONING"] } },
          },
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (subscription.status === "CANCELLED") {
        throw new Error("Subscription is already cancelled");
      }

      // Release quota
      await quotaService.releaseQuota(subscription.planId);

      // Calculate refund if applicable (for mid-month cancellations)
      const now = new Date();
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      const daysRemaining = Math.max(
        0,
        Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24))
      );
      const refundRatio = daysRemaining / daysInMonth;
      const refundAmount = subscription.monthlyPrice * refundRatio;

      // Process refund if significant amount
      let refundProcessed = false;
      if (refundAmount > 1000) {
        // Only refund if > 1000 IDR
        await creditService.refundCredit(
          subscription.userId,
          refundAmount,
          `Refund for cancelled subscription: ${subscription.service.name}`,
          {
            subscriptionId,
            reason,
            daysRemaining,
            originalAmount: subscription.monthlyPrice,
          }
        );
        refundProcessed = true;
      }

      // Update subscription status
      const cancelledSubscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "CANCELLED",
          autoRenew: false,
          gracePeriodEnd: null,
        },
      });

      // Mark all instances for termination
      if (subscription.instances.length > 0) {
        await tx.serviceInstance.updateMany({
          where: {
            subscriptionId,
            status: { in: ["RUNNING", "PENDING", "PROVISIONING"] },
          },
          data: {
            status: "TERMINATED",
          },
        });
      }

      return {
        subscription: cancelledSubscription,
        refundAmount: refundProcessed ? refundAmount : 0,
        refundProcessed,
        instancesTerminated: subscription.instances.length,
        message: "Subscription cancelled successfully",
        nextSteps: [
          "All service instances will be terminated",
          refundProcessed
            ? `Refund of ${refundAmount} IDR has been credited to your account`
            : "No refund applicable",
        ],
      };
    });
  }

  /**
   * Get user subscriptions
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} User subscriptions
   */
  async getUserSubscriptions(userId, options = {}) {
    const { status = null, includeInstances = false } = options;

    const whereClause = {
      userId,
      ...(status && { status }),
    };

    return await prisma.subscription.findMany({
      where: whereClause,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            version: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            planType: true,
            monthlyPrice: true,
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            features: true,
          },
        },
        instances: includeInstances
          ? {
              select: {
                id: true,
                name: true,
                subdomain: true,
                status: true,
                publicUrl: true,
                createdAt: true,
              },
            }
          : false,
        _count: {
          select: {
            instances: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get subscription details
   * @param {string} subscriptionId - Subscription ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscriptionDetails(subscriptionId, userId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId, // Ensure user can only access their own subscriptions
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
            version: true,
            dockerImage: true,
            documentation: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            planType: true,
            description: true,
            monthlyPrice: true,
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            bandwidth: true,
            features: true,
            maxInstancesPerUser: true,
            maxDomains: true,
          },
        },
        instances: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
            healthStatus: true,
            publicUrl: true,
            adminUrl: true,
            customDomain: true,
            sslEnabled: true,
            cpuUsage: true,
            memoryUsage: true,
            storageUsage: true,
            createdAt: true,
            lastStarted: true,
            lastHealthCheck: true,
          },
          orderBy: { createdAt: "desc" },
        },
        transactions: {
          where: {
            type: { in: ["SUBSCRIPTION", "UPGRADE"] },
          },
          select: {
            id: true,
            type: true,
            amount: true,
            description: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate next billing info
    const now = new Date();
    const daysUntilBilling = subscription.nextBilling
      ? Math.ceil((subscription.nextBilling - now) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...subscription,
      billingInfo: {
        nextBillingDate: subscription.nextBilling,
        daysUntilBilling,
        monthlyPrice: subscription.monthlyPrice,
        autoRenew: subscription.autoRenew,
        gracePeriodEnd: subscription.gracePeriodEnd,
      },
    };
  }

  /**
   * Validate subscription creation
   * @param {string} userId - User ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Validation result
   */
  async validateSubscription(userId, planId) {
    // Check user exists and get credit balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        creditBalance: true,
      },
    });

    if (!user) {
      return {
        isValid: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      };
    }

    // Check plan exists and is active
    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId, isActive: true },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            isActive: true,
            isPublic: true,
          },
        },
      },
    });

    if (!plan || !plan.service.isActive || !plan.service.isPublic) {
      return {
        isValid: false,
        error: "Service plan not found or not available",
        code: "PLAN_NOT_AVAILABLE",
      };
    }

    // Check for existing subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        serviceId: plan.serviceId,
        status: { in: ["ACTIVE", "PENDING_UPGRADE", "PENDING_PAYMENT"] },
      },
    });

    if (existingSubscription) {
      return {
        isValid: false,
        error: "User already has an active subscription for this service",
        code: "DUPLICATE_SUBSCRIPTION",
        existingSubscriptionId: existingSubscription.id,
      };
    }

    // Check credit balance
    if (user.creditBalance < plan.monthlyPrice) {
      return {
        isValid: false,
        error: "Insufficient credit balance",
        code: "INSUFFICIENT_CREDIT",
        currentBalance: user.creditBalance,
        requiredAmount: plan.monthlyPrice,
        shortfall: plan.monthlyPrice - user.creditBalance,
      };
    }

    // Check quota availability
    const quotaCheck = await quotaService.checkQuotaAvailability(planId);
    if (!quotaCheck.isAvailable) {
      return {
        isValid: false,
        error: "Service plan is at full capacity",
        code: "QUOTA_EXCEEDED",
        quotaInfo: quotaCheck,
      };
    }

    return {
      isValid: true,
      user: {
        id: user.id,
        name: user.name,
        creditBalance: user.creditBalance,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        serviceName: plan.service.name,
      },
      quotaInfo: quotaCheck,
    };
  }
}

export default new SubscriptionService();
