import prisma from "../utils/prisma.js";
import creditService from "./credit.service.js";
import transactionIdUtil from "../utils/transactionId.js";
import logger from "../utils/logger.js";

/**
 * Validate coupon without redeeming
 * @param {string} couponCode - Coupon code to validate
 * @param {string} userId - User ID
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
const validateCoupon = async (couponCode, userId, options = {}) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase() },
    include: {
      service: {
        select: { id: true, name: true, slug: true },
      },
      redemptions: {
        where: { userId },
        select: { id: true, redeemedAt: true },
      },
    },
  });

  if (!coupon) {
    return {
      valid: false,
      error: "Invalid coupon code",
    };
  }

  // Check all validation conditions
  const now = new Date();
  const validationErrors = [];

  if (coupon.status !== "ACTIVE") {
    validationErrors.push("Coupon is not active");
  }

  if (coupon.validUntil && coupon.validUntil < now) {
    validationErrors.push("Coupon has expired");
  }

  if (coupon.validFrom > now) {
    validationErrors.push("Coupon is not yet valid");
  }

  if (coupon.usedCount >= coupon.maxUses) {
    validationErrors.push("Coupon usage limit exceeded");
  }

  if (coupon.redemptions.length >= coupon.maxUsesPerUser) {
    validationErrors.push("You have already redeemed this coupon");
  }

  if (
    coupon.serviceId &&
    options.serviceId &&
    coupon.serviceId !== options.serviceId
  ) {
    validationErrors.push(`Coupon is only valid for ${coupon.service.name}`);
  }

  // Calculate potential value based on coupon type
  let potentialValue = 0;
  let valueDescription = "";

  if (validationErrors.length === 0) {
    switch (coupon.type) {
      case "CREDIT_TOPUP":
      case "WELCOME_BONUS":
        potentialValue = coupon.creditAmount;
        valueDescription = `${potentialValue.toLocaleString()} IDR credit`;
        break;
      case "SUBSCRIPTION_DISCOUNT":
        if (coupon.discountType === "FIXED_AMOUNT") {
          potentialValue = coupon.creditAmount;
          valueDescription = `${potentialValue.toLocaleString()} IDR discount`;
        } else if (
          coupon.discountType === "PERCENTAGE" &&
          options.subscriptionAmount
        ) {
          potentialValue = Math.floor(
            (options.subscriptionAmount * coupon.discountPercent) / 100
          );
          valueDescription = `${
            coupon.discountPercent
          }% discount (${potentialValue.toLocaleString()} IDR)`;
        } else if (coupon.discountType === "PERCENTAGE") {
          valueDescription = `${coupon.discountPercent}% discount`;
        }
        break;
      case "FREE_SERVICE":
        valueDescription = `Free ${
          coupon.service ? coupon.service.name : "service"
        }`;
        break;
    }
  }

  return {
    valid: validationErrors.length === 0,
    error: validationErrors[0] || null,
    coupon:
      validationErrors.length === 0
        ? {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            type: coupon.type,
            discountType: coupon.discountType,
            potentialValue,
            valueDescription,
            service: coupon.service,
            validUntil: coupon.validUntil,
            usageInfo: {
              used: coupon.usedCount,
              maxUses: coupon.maxUses,
              userUsed: coupon.redemptions.length,
              maxPerUser: coupon.maxUsesPerUser,
            },
          }
        : null,
  };
};

/**
 * Redeem CREDIT_TOPUP coupon (for billing page)
 * @param {string} userId - User ID
 * @param {string} couponCode - Coupon code to redeem
 * @returns {Promise<Object>} Redemption result
 */
const redeemCreditTopupCoupon = async (userId, couponCode) => {
  return await prisma.$transaction(async (tx) => {
    // Find and validate coupon within transaction
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
      include: {
        service: true,
        redemptions: {
          where: { userId },
        },
      },
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    if (coupon.type !== "CREDIT_TOPUP" && coupon.type !== "WELCOME_BONUS") {
      throw new Error("This coupon cannot be used for credit top-up");
    }

    // Check if user has already redeemed this coupon
    if (coupon.redemptions.length >= coupon.maxUsesPerUser) {
      throw new Error("You have already redeemed this coupon");
    }

    // Validate coupon status and limits within transaction
    const now = new Date();

    if (coupon.status !== "ACTIVE") {
      throw new Error("Coupon is not active");
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      throw new Error("Coupon has expired");
    }

    if (coupon.validFrom > now) {
      throw new Error("Coupon is not yet valid");
    }

    if (coupon.usedCount >= coupon.maxUses) {
      throw new Error("Coupon usage limit exceeded");
    }

    const creditAmount = coupon.creditAmount;
    const description =
      coupon.type === "WELCOME_BONUS"
        ? `Welcome bonus:  ${creditAmount.toLocaleString()} IDR credit`
        : `Coupon redemption: ${
            coupon.name
          } - ${creditAmount.toLocaleString()} IDR credit`;

    // Add credit to user account
    const creditResult = await creditService.addCredit(
      userId,
      creditAmount,
      description,
      {
        type: "COUPON_REDEMPTION",
        status: "COMPLETED",
        couponId: coupon.id,
        couponCode: coupon.code,
        couponType: coupon.type,
      }
    );

    // Create redemption record with error handling for race conditions
    let redemption;
    try {
      redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          redemptionType: coupon.type,
          creditAmount,
          transactionId: creditResult.transactionId,
          metadata: {
            originalCouponValue: coupon.creditAmount,
            redemptionContext:
              coupon.type === "WELCOME_BONUS"
                ? "welcome_bonus"
                : "billing_page",
          },
        },
      });
    } catch (createError) {
      // Handle unique constraint violation from race conditions
      if (createError.code === "P2002") {
        throw new Error("You have already redeemed this coupon");
      }
      throw createError;
    }

    // Update coupon usage count
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: { increment: 1 },
        // Auto-disable if usage limit reached
        ...(coupon.usedCount + 1 >= coupon.maxUses && {
          status: "USED_UP",
        }),
      },
    });

    logger.info(
      `${
        coupon.type === "WELCOME_BONUS" ? "Welcome bonus" : "Credit topup"
      } coupon redeemed: ${
        coupon.code
      } by user ${userId} for ${creditAmount} IDR`
    );

    return {
      success: true,
      redemptionId: redemption.id,
      couponCode: coupon.code,
      couponName: coupon.name,
      creditAmount,
      description,
      transactionId: creditResult.transactionId,
      newBalance: creditResult.balanceAfter,
    };
  });
};

/**
 * Calculate subscription discount from coupon
 * @param {string} couponCode - Coupon code
 * @param {string} userId - User ID
 * @param {number} subscriptionAmount - Original subscription amount
 * @param {string} serviceId - Service ID (optional)
 * @returns {Promise<Object>} Discount calculation result
 */
const calculateSubscriptionDiscount = async (
  couponCode,
  userId,
  subscriptionAmount,
  serviceId = null
) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase() },
    include: {
      service: true,
      redemptions: {
        where: { userId },
      },
    },
  });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  if (coupon.type !== "SUBSCRIPTION_DISCOUNT") {
    throw new Error("This coupon cannot be used for subscription discount");
  }

  // Validate coupon
  const validation = await validateCoupon(couponCode, userId, {
    serviceId,
    subscriptionAmount,
  });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let discountAmount = 0;
  let finalAmount = subscriptionAmount;

  if (coupon.discountType === "FIXED_AMOUNT") {
    discountAmount = Math.min(coupon.creditAmount, subscriptionAmount);
  } else if (coupon.discountType === "PERCENTAGE") {
    discountAmount = Math.floor(
      (subscriptionAmount * coupon.discountPercent) / 100
    );
  }

  finalAmount = Math.max(0, subscriptionAmount - discountAmount);

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    couponName: coupon.name,
    discountType: coupon.discountType,
    discountPercent: coupon.discountPercent,
    originalAmount: subscriptionAmount,
    discountAmount,
    finalAmount,
    savings: discountAmount,
  };
};

/**
 * Apply subscription discount coupon during checkout
 * @param {string} couponCode - Coupon code
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Subscription ID
 * @param {number} originalAmount - Original subscription amount
 * @param {number} discountAmount - Calculated discount amount
 * @returns {Promise<Object>} Application result
 */
const applySubscriptionDiscount = async (
  couponCode,
  userId,
  subscriptionId,
  originalAmount,
  discountAmount
) => {
  return await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
      include: {
        redemptions: {
          where: { userId },
        },
      },
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    // Check if user has already redeemed this coupon
    if (coupon.redemptions.length >= coupon.maxUsesPerUser) {
      throw new Error("You have already redeemed this coupon");
    }

    // Create redemption record with error handling for race conditions
    let redemption;
    try {
      redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          redemptionType: coupon.type,
          discountAmount,
          subscriptionId,
          metadata: {
            originalAmount,
            discountAmount,
            finalAmount: originalAmount - discountAmount,
            discountType: coupon.discountType,
            discountPercent: coupon.discountPercent,
            redemptionContext: "checkout_page",
          },
        },
      });
    } catch (createError) {
      // Handle unique constraint violation from race conditions
      if (createError.code === "P2002") {
        throw new Error("You have already redeemed this coupon");
      }
      throw createError;
    }

    // Update coupon usage count
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: { increment: 1 },
        ...(coupon.usedCount + 1 >= coupon.maxUses && {
          status: "USED_UP",
        }),
      },
    });

    logger.info(
      `Subscription discount coupon applied: ${coupon.code} by user ${userId} for ${discountAmount} IDR discount`
    );

    return {
      success: true,
      redemptionId: redemption.id,
      couponCode: coupon.code,
      couponName: coupon.name,
      discountAmount,
      originalAmount,
      finalAmount: originalAmount - discountAmount,
    };
  });
};

/**
 * Redeem FREE_SERVICE coupon
 * @param {string} userId - User ID
 * @param {string} couponCode - Coupon code
 * @param {string} serviceId - Service ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Redemption result
 */
const redeemFreeServiceCoupon = async (
  userId,
  couponCode,
  serviceId,
  planId
) => {
  return await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
      include: {
        service: true,
        redemptions: {
          where: { userId },
        },
      },
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    if (coupon.type !== "FREE_SERVICE") {
      throw new Error("This coupon cannot be used for free service");
    }

    // Check if user has already redeemed this coupon
    if (coupon.redemptions.length >= coupon.maxUsesPerUser) {
      throw new Error("You have already redeemed this coupon");
    }

    // Validate coupon status and limits within transaction
    const now = new Date();

    if (coupon.status !== "ACTIVE") {
      throw new Error("Coupon is not active");
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      throw new Error("Coupon has expired");
    }

    if (coupon.validFrom > now) {
      throw new Error("Coupon is not yet valid");
    }

    if (coupon.usedCount >= coupon.maxUses) {
      throw new Error("Coupon usage limit exceeded");
    }

    // Verify service matches coupon restriction
    if (coupon.serviceId && coupon.serviceId !== serviceId) {
      throw new Error(`This coupon is only valid for ${coupon.service.name}`);
    }

    // Get plan details for the free service
    const plan = await tx.servicePlan.findUnique({
      where: { id: planId },
      include: {
        service: true,
      },
    });

    if (!plan) {
      throw new Error("Invalid service plan");
    }

    if (plan.serviceId !== serviceId) {
      throw new Error("Plan does not match the specified service");
    }

    // Create redemption record with error handling for race conditions
    let redemption;
    try {
      redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          redemptionType: coupon.type,
          metadata: {
            serviceId,
            planId,
            serviceName: plan.service.name,
            planName: plan.name,
            freeServiceValue: plan.monthlyPrice,
            redemptionContext: "free_service",
          },
        },
      });
    } catch (createError) {
      // Handle unique constraint violation from race conditions
      if (createError.code === "P2002") {
        throw new Error("You have already redeemed this coupon");
      }
      throw createError;
    }

    // Update coupon usage count
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: { increment: 1 },
        ...(coupon.usedCount + 1 >= coupon.maxUses && {
          status: "USED_UP",
        }),
      },
    });

    logger.info(
      `Free service coupon redeemed: ${coupon.code} by user ${userId} for ${plan.service.name}`
    );

    return {
      success: true,
      redemptionId: redemption.id,
      couponCode: coupon.code,
      couponName: coupon.name,
      serviceName: plan.service.name,
      planName: plan.name,
      freeServiceValue: plan.monthlyPrice,
    };
  });
};

/**
 * Get user's coupon redemption history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Redemption history
 */
const getUserRedemptionHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20, type = null } = options;
  const offset = (page - 1) * limit;

  const whereClause = {
    userId,
    ...(type && { redemptionType: type }),
  };

  const [redemptions, totalCount] = await Promise.all([
    prisma.couponRedemption.findMany({
      where: whereClause,
      include: {
        coupon: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            discountType: true,
          },
        },
        transaction: {
          select: {
            id: true,
            customId: true,
            status: true,
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
      orderBy: { redeemedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.couponRedemption.count({ where: whereClause }),
  ]);

  return {
    redemptions,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasMore: offset + limit < totalCount,
    },
  };
};

/**
 * Link redemption to subscription (for FREE_SERVICE coupons)
 * @param {string} redemptionId - Redemption ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Update result
 */
const linkRedemptionToSubscription = async (redemptionId, subscriptionId) => {
  const redemption = await prisma.couponRedemption.update({
    where: { id: redemptionId },
    data: { subscriptionId },
    include: {
      coupon: {
        select: {
          code: true,
          name: true,
          type: true,
        },
      },
    },
  });

  logger.info(
    `Coupon redemption ${redemptionId} linked to subscription ${subscriptionId}`
  );

  return {
    success: true,
    redemptionId,
    subscriptionId,
    couponCode: redemption.coupon.code,
  };
};

export default {
  validateCoupon,
  redeemCreditTopupCoupon,
  calculateSubscriptionDiscount,
  applySubscriptionDiscount,
  redeemFreeServiceCoupon,
  getUserRedemptionHistory,
  linkRedemptionToSubscription,
};
