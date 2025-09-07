import prisma from "../utils/prisma.js";
import creditService from "./credit.service.js";
import quotaService from "./quota.service.js";
import provisioningService from "./k8s/provisioning.service.js";
import { isK8sAvailable } from "../config/kubernetes.js";
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
  const {
    skipCreditCheck = false,
    customDescription = null,
    couponDiscount = null,
    freeService = null,
  } = options;
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

    // Check for existing subscription for the same service
    const existingSubscription = await tx.subscription.findFirst({
      where: {
        userId,
        serviceId: plan.serviceId,
      },
      orderBy: {
        createdAt: "desc", // Get the most recent subscription
      },
    });

    if (existingSubscription) {
      // If there's an active subscription, prevent duplicate
      if (
        ["ACTIVE", "PENDING_UPGRADE", "PENDING_PAYMENT"].includes(
          existingSubscription.status
        )
      ) {
        throw new Error(
          "User already has an active subscription for this service. Use upgrade instead."
        );
      }

      // If there's an expired subscription, reactivate it instead of creating new one
      if (existingSubscription.status === "EXPIRED") {
        logger.info(
          `Reactivating expired subscription ${existingSubscription.id} for user ${userId}`
        );

        // Calculate new billing dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        const nextBilling = new Date(endDate);

        // Allocate quota for reactivation
        await quotaService.allocateQuota(planId);

        // Process payment (unless skipped by admin)
        let chargeAmount = skipCreditCheck ? 0 : plan.monthlyPrice;
        const transactionDescription =
          customDescription ||
          `Reactivated subscription: ${plan.service.name} - ${plan.name} plan`;

        if (!skipCreditCheck) {
          // Regular reactivation - deduct credit normally
          await creditService.deductCredit(
            userId,
            plan.monthlyPrice,
            transactionDescription,
            {
              type: "SUBSCRIPTION",
              planId,
              serviceName: plan.service.name,
              planName: plan.name,
              isReactivation: true,
            }
          );
        } else {
          // Bonus reactivation - create IDR 0 transaction record for audit trail
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
              isReactivation: true,
            }
          );
        }

        // Update the existing subscription to reactivate it
        const reactivatedSubscription = await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            planId, // Update to new plan if different
            status: "ACTIVE",
            startDate,
            endDate,
            nextBilling,
            monthlyPrice: plan.monthlyPrice,
            lastChargeAmount: chargeAmount,
            autoRenew: true,
            gracePeriodEnd: null, // Clear any grace period
            failedCharges: 0, // Reset failed charges
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
            .provisionServiceInstance(reactivatedSubscription.id)
            .then((result) => {
              logger.info(
                `Provisioning started for reactivated subscription ${reactivatedSubscription.id}:`,
                result
              );
            })
            .catch((error) => {
              logger.error(
                `Failed to start provisioning for reactivated subscription ${reactivatedSubscription.id}:`,
                error
              );
            });
        });

        return {
          subscription: reactivatedSubscription,
          message: skipCreditCheck
            ? "Expired subscription reactivated successfully (no charge)"
            : "Expired subscription reactivated successfully",
          chargeAmount,
          isBonusSubscription: skipCreditCheck,
          isReactivation: true,
          nextSteps: [
            "Your previous subscription has been reactivated",
            "Service provisioning will begin shortly",
            "You will receive notifications about the deployment status",
            ...(skipCreditCheck
              ? ["This is a bonus reactivation - no credit was deducted"]
              : []),
          ],
        };
      }

      // For CANCELLED subscriptions, allow creating a new subscription (user chose to cancel)
      // For SUSPENDED subscriptions, also allow creating new subscription
      // Continue with normal subscription creation flow below
    }

    // Calculate final amount after coupon discount
    let finalAmount = plan.monthlyPrice;
    let discountApplied = 0;

    if (couponDiscount) {
      discountApplied = couponDiscount.discountAmount;
      finalAmount = couponDiscount.finalAmount;
    }

    if (freeService) {
      finalAmount = 0; // Free service coupon makes it completely free
      skipCreditCheck = true; // Override credit check for free service
    }

    // Check credit balance (unless skipped by admin or free service)
    if (!skipCreditCheck && user.creditBalance < finalAmount) {
      throw new Error(
        `Insufficient credit. Balance: ${user.creditBalance}, Required: ${finalAmount}`
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
    let chargeAmount = skipCreditCheck ? 0 : finalAmount;
    let transactionDescription = customDescription;

    if (!transactionDescription) {
      if (freeService) {
        transactionDescription = `Free service: ${plan.service.name} - ${plan.name} plan (Coupon: ${freeService.couponCode})`;
      } else if (couponDiscount) {
        transactionDescription = `Subscription to ${plan.service.name} - ${plan.name} plan (Discount: ${discountApplied} IDR, Coupon: ${couponDiscount.couponCode})`;
      } else {
        transactionDescription = `Subscription to ${plan.service.name} - ${plan.name} plan`;
      }
    }

    if (!skipCreditCheck && finalAmount > 0) {
      // Regular subscription - deduct credit (with potential discount)
      await creditService.deductCredit(
        userId,
        finalAmount,
        transactionDescription,
        {
          type: "SUBSCRIPTION",
          planId,
          serviceName: plan.service.name,
          planName: plan.name,
          originalAmount: plan.monthlyPrice,
          discountAmount: discountApplied,
          finalAmount: finalAmount,
          ...(couponDiscount && { couponCode: couponDiscount.couponCode }),
          ...(freeService && {
            couponCode: freeService.couponCode,
            isFreeService: true,
          }),
        }
      );
    } else {
      // Bonus subscription or free service - create transaction record for audit trail
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
          originalAmount: plan.monthlyPrice,
          discountAmount: discountApplied,
          finalAmount: 0,
          isBonusSubscription: skipCreditCheck && !freeService,
          ...(couponDiscount && { couponCode: couponDiscount.couponCode }),
          ...(freeService && {
            couponCode: freeService.couponCode,
            isFreeService: true,
          }),
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
      message: freeService
        ? "Free service subscription created successfully"
        : couponDiscount
        ? `Subscription created successfully with ${discountApplied} IDR discount`
        : skipCreditCheck
        ? "Bonus subscription created successfully (no charge)"
        : "Subscription created successfully",
      chargeAmount,
      originalAmount: plan.monthlyPrice,
      discountAmount: discountApplied,
      finalAmount: finalAmount,
      isBonusSubscription: skipCreditCheck && !freeService,
      isFreeService: !!freeService,
      couponApplied: !!(couponDiscount || freeService),
      nextSteps: [
        "Service provisioning will begin shortly",
        "You will receive notifications about the deployment status",
        ...(freeService
          ? ["This is a free service - no credit was deducted"]
          : couponDiscount
          ? [`You saved ${discountApplied} IDR with your coupon`]
          : skipCreditCheck
          ? ["This is a bonus subscription - no credit was deducted"]
          : []),
      ],
    };
  });
};

/**
 * Upgrade or downgrade an existing subscription to a different plan
 * @param {string} subscriptionId - Subscription ID
 * @param {string} newPlanId - New plan ID
 * @param {Object} options - Additional options
 * @param {boolean} options.skipCreditCheck - Skip credit validation and deduction (for admin bonus changes)
 * @param {string} options.customDescription - Custom description for transaction (for admin bonus changes)
 * @param {boolean} options.allowDowngrade - Allow downgrading to lower tier plans (admin only)
 * @returns {Promise<Object>} Updated subscription
 */
const upgradeSubscription = async (subscriptionId, newPlanId, options = {}) => {
  const {
    skipCreditCheck = false,
    customDescription = null,
    allowDowngrade = false,
  } = options;

  // Enhanced validation and rollback tracking
  let rollbackData = {
    originalSubscription: null,
    quotaAllocated: false,
    creditDeducted: false,
    instanceUpdated: false,
    transactionId: null,
  };

  return await prisma.$transaction(async (tx) => {
    // Get current subscription with enhanced data for rollback
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
            totalQuota: true,
            usedQuota: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        instances: {
          where: { status: { in: ["RUNNING", "PENDING", "PROVISIONING"] } },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    // Store original subscription data for rollback
    rollbackData.originalSubscription = {
      planId: subscription.planId,
      monthlyPrice: subscription.monthlyPrice,
      creditBalance: subscription.user.creditBalance,
    };

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

    if (newTier <= currentTier && !allowDowngrade) {
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
    const isDowngrade = newMonthlyPrice < currentMonthlyPrice;

    // Check if user has sufficient credit for upgrade (unless skipped by admin or it's a downgrade)
    if (
      !skipCreditCheck &&
      upgradeCost > 0 &&
      subscription.user.creditBalance < upgradeCost
    ) {
      throw new Error(
        `Insufficient credit for upgrade. Balance: ${subscription.user.creditBalance}, Required: ${upgradeCost}`
      );
    }

    // Enhanced quota management with rollback tracking
    try {
      await quotaService.releaseQuota(subscription.planId);
      await quotaService.allocateQuota(newPlanId);
      rollbackData.quotaAllocated = true;
    } catch (quotaError) {
      logger.error("Quota allocation failed during upgrade:", quotaError);
      throw new Error(`Quota allocation failed: ${quotaError.message}`);
    }

    // Handle upgrade/downgrade cost - always create transaction record
    let actualCharge = skipCreditCheck ? 0 : upgradeCost;
    const changeType = isDowngrade ? "downgrade" : "upgrade";
    const changeDescription =
      customDescription ||
      `${changeType.charAt(0).toUpperCase() + changeType.slice(1)} ${
        subscription.service.name
      } from ${subscription.plan.name} to ${newPlan.name}`;

    // Enhanced credit handling with rollback tracking
    if (upgradeCost !== 0) {
      try {
        if (!skipCreditCheck) {
          if (upgradeCost > 0) {
            // Regular upgrade - deduct credit
            const creditResult = await creditService.deductCredit(
              subscription.userId,
              upgradeCost,
              changeDescription,
              {
                type: "UPGRADE",
                subscriptionId,
                oldPlanId: subscription.planId,
                newPlanId,
                proratedAmount: upgradeCost,
                daysRemaining,
              }
            );
            rollbackData.transactionId = creditResult.transactionId;
            rollbackData.creditDeducted = true;
          } else {
            // Downgrade - add credit (refund difference)
            const creditResult = await creditService.addCredit(
              subscription.userId,
              Math.abs(upgradeCost), // Make positive for credit addition
              changeDescription,
              {
                type: "REFUND",
                status: "COMPLETED",
                subscriptionId,
                oldPlanId: subscription.planId,
                newPlanId,
                proratedAmount: Math.abs(upgradeCost),
                daysRemaining,
                isDowngradeRefund: true,
              }
            );
            rollbackData.transactionId = creditResult.transactionId;
            rollbackData.creditDeducted = true;
          }
        } else {
          // Admin bonus upgrade/downgrade - create IDR 0 transaction record for audit trail
          const creditResult = await creditService.addCredit(
            subscription.userId,
            0, // IDR 0 amount
            changeDescription,
            {
              type: upgradeCost > 0 ? "UPGRADE" : "REFUND",
              status: "COMPLETED",
              subscriptionId,
              oldPlanId: subscription.planId,
              newPlanId,
              proratedAmount: Math.abs(upgradeCost),
              daysRemaining,
              isBonusChange: true,
            }
          );
          rollbackData.transactionId = creditResult.transactionId;
        }
      } catch (creditError) {
        logger.error("Credit processing failed during upgrade:", creditError);
        // Rollback quota allocation
        if (rollbackData.quotaAllocated) {
          try {
            await quotaService.releaseQuota(newPlanId);
            await quotaService.allocateQuota(subscription.planId);
          } catch (rollbackError) {
            logger.error("Failed to rollback quota allocation:", rollbackError);
          }
        }
        throw new Error(`Credit processing failed: ${creditError.message}`);
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
        instances: {
          where: { status: { in: ["RUNNING", "PENDING", "PROVISIONING"] } },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    // Enhanced Kubernetes instance update with rollback capability
    let instanceUpdateResult = null;
    if (
      updatedSubscription.instances &&
      updatedSubscription.instances.length > 0
    ) {
      const instance = updatedSubscription.instances[0]; // Assuming one instance per subscription
      try {
        logger.info(
          `Upgrading Kubernetes instance ${instance.id} with new plan resources`
        );
        instanceUpdateResult = await provisioningService.updateServiceInstance(
          instance.id,
          {
            id: newPlan.id,
            name: newPlan.name,
            planType: newPlan.planType,
            cpuMilli: updatedSubscription.plan.cpuMilli,
            memoryMb: updatedSubscription.plan.memoryMb,
            storageGb: updatedSubscription.plan.storageGb,
          },
          null // Pass null for userId to allow admin access
        );
        rollbackData.instanceUpdated = true;
        logger.info(
          `Successfully updated Kubernetes instance ${instance.id} resources`
        );
      } catch (error) {
        logger.error(
          `Failed to update Kubernetes instance ${instance.id} during subscription upgrade:`,
          error
        );

        // Enhanced rollback procedure for failed instance update
        logger.warn(
          "Initiating rollback due to Kubernetes instance update failure"
        );

        try {
          // Rollback subscription changes
          await tx.subscription.update({
            where: { id: subscriptionId },
            data: {
              planId: rollbackData.originalSubscription.planId,
              monthlyPrice: rollbackData.originalSubscription.monthlyPrice,
              previousPlanId: null,
              upgradeDate: null,
              lastChargeAmount: 0,
            },
          });

          // Rollback quota allocation
          if (rollbackData.quotaAllocated) {
            await quotaService.releaseQuota(newPlanId);
            await quotaService.allocateQuota(subscription.planId);
          }

          // Rollback credit transaction (if applicable)
          if (rollbackData.creditDeducted && rollbackData.transactionId) {
            // Create a reversal transaction
            if (upgradeCost > 0) {
              await creditService.addCredit(
                subscription.userId,
                upgradeCost,
                `Rollback: Failed upgrade from ${subscription.plan.name} to ${newPlan.name}`,
                {
                  type: "REFUND",
                  status: "COMPLETED",
                  subscriptionId,
                  originalTransactionId: rollbackData.transactionId,
                  isRollback: true,
                }
              );
            } else if (upgradeCost < 0) {
              await creditService.deductCredit(
                subscription.userId,
                Math.abs(upgradeCost),
                `Rollback: Failed downgrade from ${subscription.plan.name} to ${newPlan.name}`,
                {
                  type: "UPGRADE",
                  subscriptionId,
                  originalTransactionId: rollbackData.transactionId,
                  isRollback: true,
                }
              );
            }
          }

          logger.info("Rollback completed successfully");
          throw new Error(
            `Kubernetes instance update failed: ${error.message}. All changes have been rolled back.`
          );
        } catch (rollbackError) {
          logger.error("Rollback failed:", rollbackError);
          throw new Error(
            `Kubernetes instance update failed and rollback also failed: ${error.message}. Manual intervention required.`
          );
        }
      }
    }

    return {
      subscription: updatedSubscription,
      upgradeCost,
      actualCharge: actualCharge,
      proratedDays: daysRemaining,
      isBonusUpgrade: skipCreditCheck,
      instanceUpdateResult,
      message: skipCreditCheck
        ? `Bonus ${changeType} completed successfully (no charge)`
        : `Subscription ${changeType}d successfully`,
      nextSteps: [
        instanceUpdateResult && !instanceUpdateResult.error
          ? "Service resources have been updated in Kubernetes"
          : "Service resources will be updated shortly",
        `No downtime expected during the ${changeType}`,
        ...(skipCreditCheck
          ? [
              `This is a bonus ${changeType} - no credit was ${
                isDowngrade ? "added" : "deducted"
              }`,
            ]
          : isDowngrade
          ? [
              `Prorated refund of ${Math.abs(
                upgradeCost
              )} IDR has been added to your credit balance`,
            ]
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
          podName: true,
          namespace: true,
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

/**
 * Retry provisioning for a subscription with failed instances
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Retry result
 */
const retryProvisioning = async (subscriptionId, userId) => {
  return await prisma.$transaction(async (tx) => {
    // Get subscription with instances
    const subscription = await tx.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId, // Ensure user can only retry their own subscriptions
      },
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
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            features: true,
          },
        },
        instances: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.status !== "ACTIVE") {
      throw new Error("Cannot retry provisioning for inactive subscriptions");
    }

    // Check if there are any instances
    if (!subscription.instances || subscription.instances.length === 0) {
      throw new Error("No instances found for this subscription");
    }

    // Get the latest instance
    const latestInstance = subscription.instances[0];

    // Check if retry is allowed based on instance status
    if (latestInstance.status === "RUNNING") {
      throw new Error("Service is already running - no retry needed");
    }

    if (latestInstance.status === "PROVISIONING") {
      throw new Error(
        "Service is currently being provisioned - please wait. Check back in a few minutes."
      );
    }

    if (!["ERROR", "TERMINATED"].includes(latestInstance.status)) {
      throw new Error(
        `Cannot retry provisioning for instance with status: ${latestInstance.status}`
      );
    }

    // Check if Kubernetes is available
    if (!isK8sAvailable()) {
      throw new Error("Kubernetes cluster not available");
    }

    logger.info(
      `Retrying provisioning for subscription ${subscriptionId}, instance ${latestInstance.id}`
    );

    // Update instance status to PENDING to indicate retry is starting
    await tx.serviceInstance.update({
      where: { id: latestInstance.id },
      data: {
        status: "PENDING",
        healthStatus: "Retry provisioning initiated",
        lastHealthCheck: new Date(),
      },
    });

    // Start asynchronous provisioning process
    setImmediate(() => {
      provisioningService
        .provisionServiceInstance(subscription.id)
        .then((result) => {
          logger.info(
            `Retry provisioning started for subscription ${subscription.id}:`,
            result
          );
        })
        .catch((error) => {
          logger.error(
            `Retry provisioning failed for subscription ${subscription.id}:`,
            error
          );
          // Update instance status to ERROR
          prisma.serviceInstance
            .update({
              where: { id: latestInstance.id },
              data: {
                status: "ERROR",
                healthStatus: `Retry provisioning failed: ${error.message}`,
              },
            })
            .catch((updateError) => {
              logger.error(`Failed to update instance status:`, updateError);
            });
        });
    });

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        service: subscription.service,
        plan: subscription.plan,
      },
      instance: {
        id: latestInstance.id,
        name: latestInstance.name,
        status: "PENDING",
        previousStatus: latestInstance.status,
      },
      message: "Provisioning retry initiated successfully",
      estimatedTime: "2-5 minutes",
      nextSteps: [
        "Previous failed resources will be cleaned up",
        "New Kubernetes resources are being created",
        "You will be notified when the service is ready",
        "Check instance status for updates",
      ],
    };
  });
};

/**
 * Get subscription billing info with available upgrade plans
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Billing info with available upgrade plans
 */
const getAvailableUpgrades = async (subscriptionId, userId) => {
  // Get current subscription with all necessary details
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId, // Ensure user can only access their own subscriptions
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
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
          cpuMilli: true,
          memoryMb: true,
          storageGb: true,
          features: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (subscription.status !== "ACTIVE") {
    throw new Error("Can only get upgrade options for active subscriptions");
  }

  // Get all plans for the same service
  const allPlans = await prisma.servicePlan.findMany({
    where: {
      serviceId: subscription.serviceId,
      isActive: true,
    },
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
      totalQuota: true,
      usedQuota: true,
      maxInstancesPerUser: true,
      maxDomains: true,
      isPopular: true,
    },
    orderBy: {
      monthlyPrice: "asc",
    },
  });

  // Define plan hierarchy for upgrade validation
  const planTypeOrder = {
    FREE: 0,
    BASIC: 1,
    PRO: 2,
    PREMIUM: 3,
    ENTERPRISE: 4,
  };

  const currentTier = planTypeOrder[subscription.plan.planType];

  // Filter plans that are higher tier than current plan
  const higherTierPlans = allPlans.filter((plan) => {
    const planTier = planTypeOrder[plan.planType];
    return planTier > currentTier;
  });

  // Calculate billing information
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
  const proratedRatio = Math.max(0, daysRemaining) / daysInMonth;

  // Process each upgrade option
  const availableUpgrades = await Promise.all(
    higherTierPlans.map(async (plan) => {
      // Calculate upgrade cost
      const upgradeCost = Math.round(
        (plan.monthlyPrice - subscription.plan.monthlyPrice) * proratedRatio
      );

      // Check quota availability
      const quotaCheck = await quotaService.checkQuotaAvailability(plan.id);

      // Determine if user can upgrade
      const hasEnoughCredit = subscription.user.creditBalance >= upgradeCost;
      const canUpgrade = quotaCheck.isAvailable && hasEnoughCredit;

      // Determine reason if can't upgrade
      let reason = null;
      if (!quotaCheck.isAvailable) {
        reason = "Plan at full capacity";
      } else if (!hasEnoughCredit) {
        reason = `Insufficient credit. Need ${
          upgradeCost - subscription.user.creditBalance
        } IDR more`;
      }

      return {
        id: plan.id,
        name: plan.name,
        planType: plan.planType,
        monthlyPrice: plan.monthlyPrice,
        upgradeCost,
        proratedDays: daysRemaining,
        resources: {
          cpuMilli: plan.cpuMilli,
          memoryMb: plan.memoryMb,
          storageGb: plan.storageGb,
        },
        quotaAvailable: quotaCheck.isAvailable,
        canUpgrade,
        ...(reason && { reason }), // Add reason field when canUpgrade is false
      };
    })
  );

  return {
    currentPlan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      planType: subscription.plan.planType,
      monthlyPrice: subscription.plan.monthlyPrice,
      resources: {
        cpuMilli: subscription.plan.cpuMilli,
        memoryMb: subscription.plan.memoryMb,
        storageGb: subscription.plan.storageGb,
      },
      features: subscription.plan.features,
    },
    availableUpgrades,
    userInfo: {
      creditBalance: subscription.user.creditBalance,
      hasUpgradeOptions: availableUpgrades.length > 0,
      canUpgradeAny: availableUpgrades.some((plan) => plan.canUpgrade),
    },
    billingInfo: {
      daysRemaining,
      nextBillingDate: subscription.nextBilling,
      proratedRatio: Math.round(proratedRatio * 100) / 100, // Round to 2 decimal places
      autoRenew: subscription.autoRenew,
      monthlyPrice: subscription.monthlyPrice,
      lastChargeAmount: subscription.lastChargeAmount,
      nextChargeAmount: subscription.autoRenew ? subscription.monthlyPrice : 0,
    },
    service: {
      id: subscription.service.id,
      name: subscription.service.name,
      slug: subscription.service.slug,
    },
  };
};

/**
 * Admin: Create subscription for a user with validation
 * @param {string} userId - User ID
 * @param {string} planId - Plan ID
 * @param {Object} options - Admin options
 * @returns {Promise<Object>} Creation result with validation
 */
const adminCreateSubscriptionForUser = async (userId, planId, options = {}) => {
  const { skipCreditCheck = false, reason, adminId } = options;

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
    throw new Error("User not found");
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
    throw new Error("Service plan not found");
  }

  // Check for existing subscription for the same service
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      serviceId: plan.serviceId,
    },
    orderBy: {
      createdAt: "desc", // Get the most recent subscription
    },
  });

  if (existingSubscription) {
    // If there's an active subscription, prevent duplicate
    if (
      ["ACTIVE", "PENDING_UPGRADE", "PENDING_PAYMENT"].includes(
        existingSubscription.status
      )
    ) {
      throw new Error(
        "User already has an active subscription for this service"
      );
    }

    // If there's an expired subscription, suggest reactivation instead
    if (existingSubscription.status === "EXPIRED") {
      throw new Error(
        `User has an expired subscription for this service (ID: ${existingSubscription.id}). Use regular subscription creation endpoint to reactivate it, or update the expired subscription directly.`
      );
    }

    // For CANCELLED subscriptions, allow creating a new subscription (user chose to cancel)
    // Continue with normal subscription creation flow below
  }

  // Check credit balance (unless skipped by admin)
  if (!skipCreditCheck && user.creditBalance < plan.monthlyPrice) {
    const error = new Error(
      `User has insufficient credit. Balance: ${user.creditBalance}, Required: ${plan.monthlyPrice}`
    );
    error.details = {
      currentBalance: user.creditBalance,
      requiredAmount: plan.monthlyPrice,
      shortfall: plan.monthlyPrice - user.creditBalance,
    };
    throw error;
  }

  // Create subscription using existing service
  const result = await createSubscription(userId, planId, {
    skipCreditCheck,
    customDescription:
      reason ||
      `Admin created subscription: ${plan.service.name} - ${plan.name} plan`,
  });

  // Log admin action
  logger.info("Admin created subscription", {
    adminId,
    userId,
    planId,
    subscriptionId: result.subscription.id,
    skipCreditCheck,
    reason,
  });

  return {
    ...result,
    user,
    plan,
    adminAction: {
      createdBy: adminId,
      reason: reason || "Admin created subscription",
      skipCreditCheck,
    },
  };
};

/**
 * Admin: Get all subscriptions with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Subscriptions with pagination
 */
const adminGetAllSubscriptions = async (options = {}) => {
  const { page = 1, limit = 20, status, serviceId, userId, search } = options;

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
      take: parseInt(limit),
      skip: offset,
    }),
    prisma.subscription.count({ where: whereClause }),
  ]);

  return {
    subscriptions,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasMore: offset + parseInt(limit) < totalCount,
    },
  };
};

/**
 * Admin: Force cancel subscription with optional refund
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Cancellation options
 * @returns {Promise<Object>} Cancellation result
 */
const adminForceCancelSubscription = async (subscriptionId, options = {}) => {
  const {
    reason,
    processRefund = false,
    terminateInstances = true,
    adminId,
  } = options;

  return await prisma.$transaction(async (tx) => {
    // Get subscription
    const subscription = await tx.subscription.findUnique({
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

    if (subscription.status === "CANCELLED") {
      throw new Error("Subscription is already cancelled");
    }

    const now = new Date();
    let refundAmount = 0;
    let refundTransaction = null;

    // Calculate prorated refund if requested
    if (processRefund && subscription.status === "ACTIVE") {
      const startDate = new Date(subscription.startDate);
      const originalEndDate = new Date(subscription.endDate);

      // Calculate total days in subscription period
      const totalDays = Math.ceil(
        (originalEndDate - startDate) / (1000 * 60 * 60 * 24)
      );

      // Calculate days used (from start to now)
      const daysUsed = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

      // Calculate remaining days
      const remainingDays = Math.max(0, totalDays - daysUsed);

      if (remainingDays > 0) {
        // Calculate prorated refund amount
        const dailyRate = subscription.plan.monthlyPrice / totalDays;
        refundAmount = Math.round(dailyRate * remainingDays);

        if (refundAmount > 0) {
          // Process refund using credit service
          const refundResult = await creditService.refundCredit(
            subscription.userId,
            refundAmount,
            `Admin force cancel refund: ${subscription.service.name} - ${reason}`,
            {
              subscriptionId,
              refundType: "PRORATED",
              reason,
              adminId,
              originalAmount: subscription.plan.monthlyPrice,
              totalDays,
              daysUsed,
              remainingDays,
              dailyRate: Math.round(dailyRate),
            }
          );
          refundTransaction = { id: refundResult.transactionId };
        }
      }
    }

    // Release quota
    await quotaService.releaseQuota(subscription.planId);

    // Update subscription status to CANCELLED with immediate end date
    const cancelledSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELLED",
        endDate: now, // Set end date to current time (immediate termination)
        autoRenew: false,
        gracePeriodEnd: null,
      },
    });

    // Always terminate instances (terminateInstances parameter kept for compatibility)
    let instancesTerminated = 0;
    if (subscription.instances.length > 0) {
      for (const instance of subscription.instances) {
        try {
          logger.info(
            `Admin force-cancelling subscription, terminating instance: ${instance.id}`
          );
          await provisioningService.terminateServiceInstance(instance.id);
          instancesTerminated++;
        } catch (error) {
          logger.error(
            `Failed to terminate instance ${instance.id} during admin force-cancellation:`,
            error
          );
          // Do not throw, continue to cancel the subscription
        }
      }
    }

    return {
      subscription: cancelledSubscription,
      instancesTerminated,
      originalSubscription: subscription,
      refundAmount,
      refundTransaction,
    };
  });
};

/**
 * Admin: Process manual refund for subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Refund options
 * @returns {Promise<Object>} Refund result
 */
const adminProcessRefund = async (subscriptionId, options = {}) => {
  const { amount, reason, refundType = "PARTIAL", adminId } = options;

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
    throw new Error("Subscription not found");
  }

  // Validate refund amount
  if (amount <= 0) {
    throw new Error("Refund amount must be greater than 0");
  }

  if (refundType === "PARTIAL" && amount > subscription.plan.monthlyPrice) {
    throw new Error("Partial refund amount cannot exceed monthly price");
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

  return {
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
  };
};

/**
 * Admin: Get subscription statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Statistics
 */
const adminGetSubscriptionStats = async (options = {}) => {
  const { startDate, endDate } = options;

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

  return {
    overview: {
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      cancellationRate:
        totalSubscriptions > 0
          ? Math.round((cancelledSubscriptions / totalSubscriptions) * 100)
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
  };
};

/**
 * Admin: Extend subscription end date
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Extension options
 * @returns {Promise<Object>} Extension result
 */
const adminExtendSubscription = async (subscriptionId, options = {}) => {
  const { extensionDays, reason, adminId } = options;

  if (!extensionDays || extensionDays <= 0) {
    throw new Error("Extension days must be greater than 0");
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
    throw new Error("Subscription not found");
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

  return {
    subscription: updatedSubscription,
    extension: {
      days: extensionDays,
      previousEndDate: currentEndDate,
      newEndDate,
      reason,
      processedBy: adminId,
    },
  };
};

/**
 * Admin: Upgrade subscription for user
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Upgrade options
 * @returns {Promise<Object>} Upgrade result
 */
const adminUpgradeSubscription = async (subscriptionId, options = {}) => {
  const { newPlanId, skipCreditCheck = false, reason, adminId } = options;

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
    throw new Error("Subscription not found");
  }

  if (subscription.status !== "ACTIVE") {
    throw new Error("Can only upgrade active subscriptions");
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
    throw new Error("New service plan not found");
  }

  // Validate upgrade path (must be same service)
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
    const error = new Error(
      `User has insufficient credit for upgrade. Balance: ${subscription.user.creditBalance}, Required: ${upgradeCost}`
    );
    error.details = {
      currentBalance: subscription.user.creditBalance,
      requiredAmount: upgradeCost,
      shortfall: upgradeCost - subscription.user.creditBalance,
    };
    throw error;
  }

  // Upgrade/downgrade subscription using the existing service with skipCreditCheck option and custom description
  const result = await upgradeSubscription(subscriptionId, newPlanId, {
    skipCreditCheck,
    allowDowngrade: true, // Allow admins to downgrade subscriptions
    customDescription:
      reason ||
      `Admin ${newTier > currentTier ? "upgrade" : "downgrade"}: ${
        subscription.service.name
      } from ${subscription.plan.name} to ${newPlan.name}`,
  });

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

  return {
    ...result,
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
  };
};

/**
 * Admin: Set subscription to expired status
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} options - Expiration options
 * @returns {Promise<Object>} Expiration result
 */
const adminExpireSubscription = async (subscriptionId, options = {}) => {
  const { reason, terminateInstances = true, adminId } = options;

  return await prisma.$transaction(async (tx) => {
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

    if (subscription.status === "EXPIRED") {
      throw new Error("Subscription is already expired");
    }

    // Release quota
    await quotaService.releaseQuota(subscription.planId);

    // Update subscription status to EXPIRED
    const expiredSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "EXPIRED",
        autoRenew: false,
        gracePeriodEnd: null,
        endDate: new Date(), // Set end date to now
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
      subscription: expiredSubscription,
      instancesTerminated,
      originalSubscription: subscription,
    };
  });
};

/**
 * Toggle auto-renew setting for a subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization)
 * @param {boolean} autoRenew - New auto-renew setting
 * @returns {Promise<Object>} Updated subscription info
 */
const toggleAutoRenew = async (subscriptionId, userId, autoRenew) => {
  return await prisma.$transaction(async (tx) => {
    // Get subscription with user verification
    const subscription = await tx.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId, // Ensure user can only modify their own subscriptions
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
          },
        },
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Check if subscription can have auto-renew modified
    if (subscription.status === "CANCELLED") {
      throw new Error("Cannot modify auto-renew for cancelled subscriptions");
    }

    if (subscription.status === "EXPIRED") {
      throw new Error("Cannot modify auto-renew for expired subscriptions");
    }

    // Update the auto-renew setting
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        autoRenew,
        // Update nextBilling based on auto-renew setting
        nextBilling: autoRenew ? subscription.endDate : null,
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
          },
        },
      },
    });

    // Calculate billing information
    const now = new Date();
    const daysUntilBilling = updatedSubscription.endDate
      ? Math.ceil((updatedSubscription.endDate - now) / (1000 * 60 * 60 * 24))
      : null;

    return {
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        autoRenew: updatedSubscription.autoRenew,
        endDate: updatedSubscription.endDate,
        nextBilling: updatedSubscription.nextBilling,
        monthlyPrice: updatedSubscription.monthlyPrice,
        service: updatedSubscription.service,
        plan: updatedSubscription.plan,
      },
      billingInfo: {
        autoRenew: updatedSubscription.autoRenew,
        nextBillingDate: updatedSubscription.nextBilling,
        daysUntilBilling,
        monthlyPrice: updatedSubscription.monthlyPrice,
        nextChargeAmount: updatedSubscription.autoRenew
          ? updatedSubscription.monthlyPrice
          : 0,
      },
      message: autoRenew
        ? "Auto-renew enabled. Your subscription will automatically renew at the end of the current period."
        : "Auto-renew disabled. Your subscription will end at the current period end date.",
      nextSteps: autoRenew
        ? [
            "Your subscription will automatically renew on the next billing date",
            "Ensure you have sufficient credit balance for automatic renewal",
            "You can disable auto-renew anytime before the next billing date",
          ]
        : [
            "Your subscription will end on the current period end date",
            "No automatic charges will occur",
            "You can re-enable auto-renew anytime before the end date",
            "You can also manually renew or upgrade before expiration",
          ],
    };
  });
};

/**
 * Admin: Update subscription details freely
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} updateData - Fields to update
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Update result
 */
const adminUpdateSubscription = async (subscriptionId, updateData, adminId) => {
  return await prisma.$transaction(async (tx) => {
    // Get current subscription
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
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
      throw new Error("Subscription not found");
    }

    // Validate admin exists
    const admin = await tx.user.findUnique({
      where: { id: adminId, role: "ADMINISTRATOR" },
      select: { id: true, name: true },
    });

    if (!admin) {
      throw new Error("Admin user not found or insufficient permissions");
    }

    // Prepare update data with validation
    const allowedFields = [
      "status",
      "startDate",
      "endDate",
      "nextBilling",
      "lastBilled",
      "monthlyPrice",
      "lastChargeAmount",
      "failedCharges",
      "autoRenew",
      "gracePeriodEnd",
    ];

    const updateFields = {};
    const changes = [];

    // Process each field in updateData
    for (const [field, value] of Object.entries(updateData)) {
      if (!allowedFields.includes(field)) {
        throw new Error(
          `Invalid field: ${field}. Allowed fields: ${allowedFields.join(", ")}`
        );
      }

      // Type validation and conversion
      switch (field) {
        case "status":
          const validStatuses = [
            "ACTIVE",
            "SUSPENDED",
            "CANCELLED",
            "EXPIRED",
            "PENDING_UPGRADE",
            "PENDING_PAYMENT",
          ];
          if (!validStatuses.includes(value)) {
            throw new Error(
              `Invalid status: ${value}. Valid statuses: ${validStatuses.join(
                ", "
              )}`
            );
          }
          updateFields[field] = value;
          changes.push(`${field}: ${subscription[field]} → ${value}`);
          break;

        case "startDate":
        case "endDate":
        case "nextBilling":
        case "lastBilled":
        case "gracePeriodEnd":
          if (value === null) {
            updateFields[field] = null;
            changes.push(`${field}: ${subscription[field]} → null`);
          } else {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date format for ${field}: ${value}`);
            }
            updateFields[field] = date;
            changes.push(
              `${field}: ${subscription[field]} → ${date.toISOString()}`
            );
          }
          break;

        case "monthlyPrice":
        case "lastChargeAmount":
        case "failedCharges":
          const numValue = parseInt(value);
          if (isNaN(numValue) || numValue < 0) {
            throw new Error(`Invalid number for ${field}: ${value}`);
          }
          updateFields[field] = numValue;
          changes.push(`${field}: ${subscription[field]} → ${numValue}`);
          break;

        case "autoRenew":
          if (typeof value !== "boolean") {
            throw new Error(`Invalid boolean for ${field}: ${value}`);
          }
          updateFields[field] = value;
          changes.push(`${field}: ${subscription[field]} → ${value}`);

          // Auto-update nextBilling based on autoRenew setting
          if (value === true && subscription.endDate) {
            updateFields.nextBilling = subscription.endDate;
            changes.push(
              `nextBilling: ${subscription.nextBilling} → ${subscription.endDate} (auto-updated)`
            );
          } else if (value === false) {
            updateFields.nextBilling = null;
            changes.push(
              `nextBilling: ${subscription.nextBilling} → null (auto-updated)`
            );
          }
          break;

        default:
          updateFields[field] = value;
          changes.push(`${field}: ${subscription[field]} → ${value}`);
      }
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No valid fields provided for update");
    }

    // Update subscription
    const updatedSubscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: updateFields,
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

    // Log admin action
    logger.info("Admin updated subscription", {
      adminId,
      adminName: admin.name,
      subscriptionId,
      userId: subscription.userId,
      userEmail: subscription.user.email,
      changes,
      fieldsUpdated: Object.keys(updateFields),
    });

    return {
      subscription: updatedSubscription,
      changes,
      fieldsUpdated: Object.keys(updateFields),
      adminAction: {
        updatedBy: adminId,
        adminName: admin.name,
        timestamp: new Date(),
        changes,
      },
      originalSubscription: {
        id: subscription.id,
        status: subscription.status,
        endDate: subscription.endDate,
        nextBilling: subscription.nextBilling,
        autoRenew: subscription.autoRenew,
        monthlyPrice: subscription.monthlyPrice,
      },
    };
  });
};

export default {
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  getUserSubscriptions,
  getSubscriptionDetails,
  validateSubscription,
  retryProvisioning,
  getAvailableUpgrades,
  toggleAutoRenew,
  adminCreateSubscriptionForUser,
  adminGetAllSubscriptions,
  adminForceCancelSubscription,
  adminProcessRefund,
  adminGetSubscriptionStats,
  adminExtendSubscription,
  adminUpgradeSubscription,
  adminExpireSubscription,
  adminUpdateSubscription,
};
