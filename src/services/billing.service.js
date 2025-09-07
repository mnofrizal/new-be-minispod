import prisma from "../utils/prisma.js";
import creditService from "./credit.service.js";
import quotaService from "./quota.service.js";
import logger from "../utils/logger.js";

// Environment configuration for grace period and billing
const GRACE_PERIOD_ENABLED = process.env.GRACE_PERIOD_ENABLED !== "false"; // Default true
const GRACE_PERIOD_DAYS = parseInt(process.env.GRACE_PERIOD_DAYS) || 7;
const GRACE_PERIOD_MIN_DAYS = parseInt(process.env.GRACE_PERIOD_MIN_DAYS) || 1;
const GRACE_PERIOD_MAX_DAYS = parseInt(process.env.GRACE_PERIOD_MAX_DAYS) || 30;
const LOW_CREDIT_WARNING_DAYS =
  parseInt(process.env.LOW_CREDIT_WARNING_DAYS) || 3;
const LOW_CREDIT_WARNING_ENABLED =
  process.env.LOW_CREDIT_WARNING_ENABLED !== "false"; // Default true
const AUTO_RENEWAL_ENABLED = process.env.AUTO_RENEWAL_ENABLED !== "false"; // Default true
const BILLING_RETRY_ATTEMPTS =
  parseInt(process.env.BILLING_RETRY_ATTEMPTS) || 3;
const BILLING_RETRY_DELAY_MINUTES =
  parseInt(process.env.BILLING_RETRY_DELAY_MINUTES) || 30;

/**
 * Process auto-renewal for subscriptions due for renewal
 * @returns {Promise<Object>} Renewal processing results
 */
const processAutoRenewals = async () => {
  const now = new Date();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    insufficientCredit: 0,
    quotaExceeded: 0,
    errors: [],
  };

  try {
    // Find subscriptions due for renewal
    const subscriptionsDue = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        nextBilling: {
          lte: now,
        },
      },
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

    logger.info(
      `Found ${subscriptionsDue.length} subscriptions due for renewal`
    );

    for (const subscription of subscriptionsDue) {
      results.processed++;

      try {
        await processSubscriptionRenewal(subscription);
        results.successful++;
        logger.info(
          `Successfully renewed subscription ${subscription.id} for user ${subscription.user.email}`
        );
      } catch (error) {
        results.failed++;

        if (error.message.includes("Insufficient credit")) {
          results.insufficientCredit++;

          if (GRACE_PERIOD_ENABLED) {
            // Set grace period for insufficient credit using env config
            await setGracePeriod(subscription.id, GRACE_PERIOD_DAYS);
            logger.info(
              `Grace period of ${GRACE_PERIOD_DAYS} days set for subscription ${subscription.id}`
            );
          } else {
            // Grace period disabled - expire immediately
            await expireSubscription(subscription.id);
            logger.info(
              `Subscription ${subscription.id} expired immediately (grace period disabled)`
            );
          }
        } else if (error.message.includes("full capacity")) {
          results.quotaExceeded++;
        }

        results.errors.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          userEmail: subscription.user.email,
          error: error.message,
        });

        logger.error(`Failed to renew subscription ${subscription.id}:`, error);
      }
    }

    logger.info(
      `Auto-renewal processing completed: ${results.successful}/${results.processed} successful`
    );
    return results;
  } catch (error) {
    logger.error("Auto-renewal processing failed:", error);
    throw error;
  }
};

/**
 * Process renewal for a single subscription
 * @param {Object} subscription - Subscription with user, service, and plan data
 * @returns {Promise<Object>} Renewal result
 */
const processSubscriptionRenewal = async (subscription) => {
  return await prisma.$transaction(async (tx) => {
    // Check if user has sufficient credit
    if (subscription.user.creditBalance < subscription.plan.monthlyPrice) {
      throw new Error(
        `Insufficient credit. Balance: ${subscription.user.creditBalance}, Required: ${subscription.plan.monthlyPrice}`
      );
    }

    // Check quota availability
    const quotaCheck = await quotaService.checkQuotaAvailability(
      subscription.planId
    );
    if (!quotaCheck.isAvailable) {
      throw new Error("Service plan is at full capacity");
    }

    // Deduct credit for renewal
    await creditService.deductCredit(
      subscription.userId,
      subscription.plan.monthlyPrice,
      `Auto-renewal: ${subscription.service.name} - ${subscription.plan.name} plan`,
      {
        type: "SUBSCRIPTION",
        subscriptionId: subscription.id,
        serviceName: subscription.service.name,
        planName: subscription.plan.name,
        isAutoRenewal: true,
      }
    );

    // Calculate new billing dates
    const currentEndDate = new Date(subscription.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    const newNextBilling = new Date(newEndDate);

    // Update subscription
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        endDate: newEndDate,
        nextBilling: newNextBilling,
        lastBilled: new Date(),
        lastChargeAmount: subscription.plan.monthlyPrice,
        failedCharges: 0, // Reset failed charges on successful renewal
        gracePeriodEnd: null, // Clear grace period
      },
    });

    return {
      subscription: updatedSubscription,
      chargedAmount: subscription.plan.monthlyPrice,
      newEndDate,
      newNextBilling,
    };
  });
};

/**
 * Set grace period for subscription with insufficient credit
 * @param {string} subscriptionId - Subscription ID
 * @param {number} graceDays - Number of grace period days
 * @returns {Promise<Object>} Updated subscription
 */
const setGracePeriod = async (
  subscriptionId,
  graceDays = GRACE_PERIOD_DAYS
) => {
  // Validate grace period days against environment limits
  if (graceDays < GRACE_PERIOD_MIN_DAYS || graceDays > GRACE_PERIOD_MAX_DAYS) {
    throw new Error(
      `Grace period must be between ${GRACE_PERIOD_MIN_DAYS} and ${GRACE_PERIOD_MAX_DAYS} days`
    );
  }
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

  return await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      gracePeriodEnd,
      failedCharges: {
        increment: 1,
      },
    },
  });
};

/**
 * Process subscriptions in grace period
 * @returns {Promise<Object>} Grace period processing results
 */
const processGracePeriodSubscriptions = async () => {
  const now = new Date();
  const results = {
    processed: 0,
    expired: 0,
    renewed: 0,
    errors: [],
  };

  try {
    // Find subscriptions with expired grace period
    const expiredGraceSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        gracePeriodEnd: {
          lte: now,
        },
      },
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
            name: true,
          },
        },
        plan: {
          select: {
            name: true,
            monthlyPrice: true,
          },
        },
      },
    });

    logger.info(
      `Found ${expiredGraceSubscriptions.length} subscriptions with expired grace period`
    );

    for (const subscription of expiredGraceSubscriptions) {
      results.processed++;

      try {
        // Try to renew if user now has sufficient credit
        if (subscription.user.creditBalance >= subscription.plan.monthlyPrice) {
          await processSubscriptionRenewal(subscription);
          results.renewed++;
          logger.info(
            `Grace period subscription ${subscription.id} successfully renewed`
          );
        } else {
          // Expire subscription
          await expireSubscription(subscription.id);
          results.expired++;
          logger.info(
            `Expired subscription ${subscription.id} due to insufficient credit after grace period`
          );
        }
      } catch (error) {
        results.errors.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          error: error.message,
        });
        logger.error(
          `Failed to process grace period subscription ${subscription.id}:`,
          error
        );
      }
    }

    return results;
  } catch (error) {
    logger.error("Grace period processing failed:", error);
    throw error;
  }
};

/**
 * Expire subscription due to payment failure
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Expired subscription
 */
const expireSubscription = async (subscriptionId) => {
  return await prisma.$transaction(async (tx) => {
    // Get subscription details
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
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

    // Update subscription status
    const expiredSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "EXPIRED",
        autoRenew: false,
        gracePeriodEnd: null,
      },
    });

    // Terminate associated instances
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

    return expiredSubscription;
  });
};

/**
 * Get subscriptions requiring low credit notifications
 * @returns {Promise<Array>} Subscriptions with low credit users
 */
const getLowCreditSubscriptions = async () => {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  return await prisma.subscription
    .findMany({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        nextBilling: {
          lte: threeDaysFromNow,
        },
      },
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
            name: true,
          },
        },
        plan: {
          select: {
            name: true,
            monthlyPrice: true,
          },
        },
      },
    })
    .then((subscriptions) =>
      subscriptions.filter(
        (sub) => sub.user.creditBalance < sub.plan.monthlyPrice
      )
    );
};

/**
 * Get billing statistics
 * @returns {Promise<Object>} Billing statistics
 */
const getBillingStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [
    totalActiveSubscriptions,
    subscriptionsDueForRenewal,
    subscriptionsInGracePeriod,
    monthlyRevenue,
    failedRenewals,
  ] = await Promise.all([
    prisma.subscription.count({
      where: { status: "ACTIVE", autoRenew: true },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        nextBilling: {
          lte: now,
        },
      },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        gracePeriodEnd: { not: null },
      },
    }),
    prisma.transaction.aggregate({
      where: {
        type: "SUBSCRIPTION",
        status: "COMPLETED",
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        failedCharges: { gt: 0 },
      },
    }),
  ]);

  return {
    totalActiveSubscriptions,
    subscriptionsDueForRenewal,
    subscriptionsInGracePeriod,
    monthlyRevenue: monthlyRevenue._sum.amount || 0,
    failedRenewals,
    lastUpdated: now,
  };
};

export default {
  processAutoRenewals,
  processSubscriptionRenewal,
  setGracePeriod,
  processGracePeriodSubscriptions,
  expireSubscription,
  getLowCreditSubscriptions,
  getBillingStats,
};
