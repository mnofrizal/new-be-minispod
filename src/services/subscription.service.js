import prisma from "../utils/prisma.js";
import creditService from "./credit.service.js";
import quotaService from "./quota.service.js";
import provisioningService from "./k8s/provisioning.service.js";
import logger from "../utils/logger.js";

/**
 * Create a new subscription for a user
 * @param {string} userId - User ID
 * @param {string} planId - Service plan ID
 * @param {Object} options - Additional options
 * @param {boolean} options.skipCreditCheck - Skip credit validation and deduction (for admin bonus subscriptions)
 * @param {string} options.customDescription - Custom description for transaction (for admin bonus subscriptions)
 * @returns {Promise<Object>} Created subscription
 */
const createSubscription = async (userId, planId, options = {}) => {
  const { skipCreditCheck = false, customDescription = null } = options;
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

    // Check credit balance (unless skipped by admin)
    if (!skipCreditCheck && user.creditBalance < plan.monthlyPrice) {
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

    // Always create transaction record, but with different amounts and descriptions
    let chargeAmount = skipCreditCheck ? 0 : plan.monthlyPrice;
    const transactionDescription =
      customDescription ||
      `Subscription to ${plan.service.name} - ${plan.name} plan`;

    if (!skipCreditCheck) {
      // Regular subscription - deduct credit normally
      await creditService.deductCredit(
        userId,
        plan.monthlyPrice,
        transactionDescription,
        {
          type: "SUBSCRIPTION",
          planId,
          serviceName: plan.service.name,
          planName: plan.name,
        }
      );
    } else {
      // Bonus subscription - create IDR 0 transaction record for audit trail
      await creditService.addCredit(
        userId,
        0, // IDR 0 amount
        transactionDescription,
        {
          type: "SUBSCRIPTION",
          status: "COMPLETED",
          planId,
          serviceName: plan.service.name,
          planName: plan.name,
          isBonusSubscription: true,
        }
      );
    }

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
        lastChargeAmount: chargeAmount,
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

    // Trigger service provisioning asynchronously
    setImmediate(() => {
      provisioningService
        .provisionServiceInstance(subscription.id)
        .then((result) => {
          logger.info(
            `Provisioning started for subscription ${subscription.id}:`,
            result
          );
        })
        .catch((error) => {
          logger.error(
            `Failed to start provisioning for subscription ${subscription.id}:`,
            error
          );
        });
    });

    return {
      subscription,
      message: skipCreditCheck
        ? "Bonus subscription created successfully (no charge)"
        : "Subscription created successfully",
      chargeAmount,
      isBonusSubscription: skipCreditCheck,
      nextSteps: [
        "Service provisioning will begin shortly",
        "You will receive notifications about the deployment status",
        ...(skipCreditCheck
          ? ["This is a bonus subscription - no credit was deducted"]
          : []),
      ],
    };
  });
};

/**
 * Upgrade an existing subscription to a higher plan
 * @param {string} subscriptionId - Subscription ID
 * @param {string} newPlanId - New plan ID
 * @param {Object} options - Additional options
 * @param {boolean} options.skipCreditCheck - Skip credit validation and deduction (for admin bonus upgrades)
 * @param {string} options.customDescription - Custom description for transaction (for admin bonus upgrades)
 * @returns {Promise<Object>} Upgraded subscription
 */
const upgradeSubscription = async (subscriptionId, newPlanId, options = {}) => {
  const { skipCreditCheck = false, customDescription = null } = options;
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
    const upgradeCost = (newMonthlyPrice - currentMonthlyPrice) * proratedRatio;

    // Check if user has sufficient credit for upgrade (unless skipped by admin)
    if (
      !skipCreditCheck &&
      upgradeCost > 0 &&
      subscription.user.creditBalance < upgradeCost
    ) {
      throw new Error(
        `Insufficient credit for upgrade. Balance: ${subscription.user.creditBalance}, Required: ${upgradeCost}`
      );
    }

    // Release quota from old plan and allocate to new plan
    await quotaService.releaseQuota(subscription.planId);
    await quotaService.allocateQuota(newPlanId);

    // Handle upgrade cost - always create transaction record
    let actualCharge = skipCreditCheck ? 0 : upgradeCost;
    const upgradeDescription =
      customDescription ||
      `Upgrade ${subscription.service.name} from ${subscription.plan.name} to ${newPlan.name}`;

    if (upgradeCost > 0) {
      if (!skipCreditCheck) {
        // Regular upgrade - deduct credit normally
        await creditService.deductCredit(
          subscription.userId,
          upgradeCost,
          upgradeDescription,
          {
            type: "UPGRADE",
            subscriptionId,
            oldPlanId: subscription.planId,
            newPlanId,
            proratedAmount: upgradeCost,
            daysRemaining,
          }
        );
      } else {
        // Bonus upgrade - create IDR 0 transaction record for audit trail
        await creditService.addCredit(
          subscription.userId,
          0, // IDR 0 amount
          upgradeDescription,
          {
            type: "UPGRADE",
            status: "COMPLETED",
            subscriptionId,
            oldPlanId: subscription.planId,
            newPlanId,
            proratedAmount: upgradeCost,
            daysRemaining,
            isBonusUpgrade: true,
          }
        );
      }
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
      actualCharge: actualCharge,
      proratedDays: daysRemaining,
      isBonusUpgrade: skipCreditCheck,
      message: skipCreditCheck
        ? "Bonus upgrade completed successfully (no charge)"
        : "Subscription upgraded successfully",
      nextSteps: [
        "Service resources will be updated",
        "No downtime expected during the upgrade",
        ...(skipCreditCheck
          ? ["This is a bonus upgrade - no credit was deducted"]
          : []),
      ],
    };
  });
};

/**
 * Cancel a subscription (disable auto-renew, keep active until end date)
 * @param {string} subscriptionId - Subscription ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Cancellation result
 */
const cancelSubscription = async (
  subscriptionId,
  reason = "User requested cancellation"
) => {
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

    // Calculate days remaining until end date
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24))
    );

    // Update subscription to disable auto-renew but keep active
    const cancelledSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELLED",
        autoRenew: false,
        cancellationReason: reason,
        cancelledAt: now,
      },
    });

    // Release the quota
    await quotaService.releaseQuota(subscription.planId);

    // Terminate the associated Kubernetes instance
    let instancesTerminated = 0;
    if (subscription.instances && subscription.instances.length > 0) {
      const instance = subscription.instances[0]; // Assuming one instance per subscription
      try {
        logger.info(
          `Cancelling subscription, terminating instance: ${instance.id}`
        );
        await provisioningService.terminateServiceInstance(instance.id);
        instancesTerminated = 1;
      } catch (error) {
        logger.error(
          `Failed to terminate instance ${instance.id} during subscription cancellation:`,
          error
        );
        // Do not throw error, just log it. The subscription cancellation should still succeed.
      }
    }

    return {
      subscription: cancelledSubscription,
      refundAmount: 0, // No automatic refund
      refundProcessed: false,
      instancesTerminated,
      daysRemaining: 0, // Service is terminated immediately
      endDate: subscription.endDate,
      message:
        "Subscription cancelled and service instance termination initiated",
      nextSteps: [
        "Your subscription is now cancelled.",
        "The associated service instance is being terminated and all data will be deleted.",
        "No further charges will occur for this subscription.",
      ],
    };
  });
};

/**
 * Get user subscriptions
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} User subscriptions
 */
const getUserSubscriptions = async (userId, options = {}) => {
  const { status = null, includeInstances = true } = options;

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
      },
      _count: {
        select: {
          instances: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Get subscription details
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Subscription details
 */
const getSubscriptionDetails = async (subscriptionId, userId) => {
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
};

/**
 * Validate subscription creation
 * @param {string} userId - User ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Validation result
 */
const validateSubscription = async (userId, planId) => {
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
};

export default {
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  getUserSubscriptions,
  getSubscriptionDetails,
  validateSubscription,
};
