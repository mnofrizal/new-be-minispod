import prisma from "../utils/prisma.js";
import couponService from "./coupon.service.js";
import logger from "../utils/logger.js";

/**
 * Apply all eligible welcome bonus coupons to a new user
 * @param {string} userId - The ID of the newly registered user
 * @returns {Promise<Object>} Result with applied coupons and total credit added
 */
const applyWelcomeBonuses = async (userId) => {
  try {
    logger.info(`Checking welcome bonuses for user: ${userId}`);

    // Find all active WELCOME_BONUS coupons
    const welcomeCoupons = await prisma.coupon.findMany({
      where: {
        type: "WELCOME_BONUS",
        status: "ACTIVE",
        OR: [
          { validUntil: null }, // No expiry date
          { validUntil: { gte: new Date() } }, // Not expired
        ],
      },
      orderBy: {
        createdAt: "asc", // Apply older coupons first
      },
    });

    // Filter coupons that still have uses available
    const availableCoupons = welcomeCoupons.filter(
      (coupon) => coupon.usedCount < coupon.maxUses
    );

    if (availableCoupons.length === 0) {
      logger.info(`No active welcome bonus coupons found for user: ${userId}`);
      return {
        success: true,
        appliedCoupons: [],
        totalCreditAdded: 0,
        message: "No welcome bonus coupons available",
      };
    }

    logger.info(
      `Found ${availableCoupons.length} welcome bonus coupons to check`
    );

    const appliedCoupons = [];
    let totalCreditAdded = 0;

    // Try to apply each welcome bonus coupon
    for (const coupon of availableCoupons) {
      try {
        // Check if user has already used this coupon
        const existingRedemption = await prisma.couponRedemption.findUnique({
          where: {
            couponId_userId: {
              couponId: coupon.id,
              userId: userId,
            },
          },
        });

        if (existingRedemption) {
          logger.info(`User ${userId} already redeemed coupon ${coupon.code}`);
          continue;
        }

        // Check if coupon still has uses available (double-check)
        if (coupon.usedCount >= coupon.maxUses) {
          logger.info(`Coupon ${coupon.code} has reached maximum uses`);
          continue;
        }

        // Apply the welcome bonus coupon
        logger.info(
          `Applying welcome bonus coupon ${coupon.code} to user ${userId}`
        );

        const redemptionResult = await couponService.redeemCreditTopupCoupon(
          userId,
          coupon.code
        );

        appliedCoupons.push({
          couponId: coupon.id,
          couponCode: coupon.code,
          creditAmount: coupon.creditAmount,
          redemptionId: redemptionResult.redemption.id,
        });

        totalCreditAdded += coupon.creditAmount;

        logger.info(
          `Successfully applied welcome bonus coupon ${coupon.code} (IDR ${coupon.creditAmount}) to user ${userId}`
        );
      } catch (couponError) {
        logger.error(
          `Failed to apply welcome bonus coupon ${coupon.code} to user ${userId}:`,
          couponError
        );
        // Continue with other coupons even if one fails
        continue;
      }
    }

    const result = {
      success: true,
      appliedCoupons,
      totalCreditAdded,
      message:
        appliedCoupons.length > 0
          ? `Applied ${appliedCoupons.length} welcome bonus coupon(s), total credit: IDR ${totalCreditAdded}`
          : "No welcome bonus coupons could be applied",
    };

    logger.info(
      `Welcome bonus application completed for user ${userId}:`,
      result
    );
    return result;
  } catch (error) {
    logger.error(`Error applying welcome bonuses for user ${userId}:`, error);

    // Return success even if welcome bonus fails - don't block registration
    return {
      success: true,
      appliedCoupons: [],
      totalCreditAdded: 0,
      message:
        "Welcome bonus application failed, but registration completed successfully",
      error: error.message,
    };
  }
};

/**
 * Get statistics about welcome bonus coupons
 * @returns {Promise<Object>} Statistics about welcome bonus coupons
 */
const getWelcomeBonusStats = async () => {
  try {
    const stats = await prisma.coupon.groupBy({
      by: ["status"],
      where: {
        type: "WELCOME_BONUS",
      },
      _count: {
        id: true,
      },
      _sum: {
        usedCount: true,
        maxUses: true,
        creditAmount: true,
      },
    });

    const totalRedemptions = await prisma.couponRedemption.count({
      where: {
        redemptionType: "WELCOME_BONUS",
      },
    });

    const totalCreditGiven = await prisma.couponRedemption.aggregate({
      where: {
        redemptionType: "WELCOME_BONUS",
      },
      _sum: {
        creditAmount: true,
      },
    });

    return {
      couponStats: stats,
      totalRedemptions,
      totalCreditGiven: totalCreditGiven._sum.creditAmount || 0,
    };
  } catch (error) {
    logger.error("Error getting welcome bonus stats:", error);
    throw error;
  }
};

export default {
  applyWelcomeBonuses,
  getWelcomeBonusStats,
};
