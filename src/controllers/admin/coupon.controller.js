import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import prisma from "../../utils/prisma.js";
import logger from "../../utils/logger.js";

/**
 * Create new coupon
 * POST /api/admin/coupons
 */
const createCoupon = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const {
      code,
      name,
      description,
      type,
      creditAmount,
      discountType,
      discountPercent,
      maxUses,
      maxUsesPerUser,
      serviceId,
      planType,
      validFrom,
      validUntil,
    } = req.body;

    // Validate coupon type specific fields
    if (type === "CREDIT_TOPUP" && !creditAmount) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Credit amount is required for credit top-up coupons"
      );
    }

    if (type === "SUBSCRIPTION_DISCOUNT") {
      if (!discountType) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Discount type is required for subscription discount coupons"
        );
      }
      if (discountType === "FIXED_AMOUNT" && !creditAmount) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Credit amount is required for fixed amount discount coupons"
        );
      }
      if (discountType === "PERCENTAGE" && !discountPercent) {
        return sendResponse(
          res,
          StatusCodes.BAD_REQUEST,
          null,
          "Discount percentage is required for percentage discount coupons"
        );
      }
    }

    if (type === "FREE_SERVICE" && !serviceId) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Service ID is required for free service coupons"
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        creditAmount,
        discountType,
        discountPercent,
        maxUses: maxUses || 1,
        maxUsesPerUser: maxUsesPerUser || 1,
        serviceId,
        planType,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        createdBy: adminId,
      },
      include: {
        service: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    logger.info(`Coupon created: ${coupon.code} by admin ${adminId}`);

    sendResponse(
      res,
      StatusCodes.CREATED,
      { coupon },
      "Coupon created successfully"
    );
  } catch (error) {
    logger.error("Create coupon error:", error);
    if (error.code === "P2002") {
      sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Coupon code already exists"
      );
    } else {
      sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Failed to create coupon"
      );
    }
  }
};

/**
 * List all coupons with filtering
 * GET /api/admin/coupons
 */
const listCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, serviceId, search } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      ...(status && { status }),
      ...(type && { type }),
      ...(serviceId && { serviceId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [coupons, totalCount] = await Promise.all([
      prisma.coupon.findMany({
        where: whereClause,
        include: {
          service: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { redemptions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: offset,
      }),
      prisma.coupon.count({ where: whereClause }),
    ]);

    sendResponse(
      res,
      StatusCodes.OK,
      {
        coupons,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasMore: offset + parseInt(limit) < totalCount,
        },
      },
      "Coupons retrieved successfully"
    );
  } catch (error) {
    logger.error("List coupons error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve coupons"
    );
  }
};

/**
 * Get coupon details
 * GET /api/admin/coupons/:couponId
 */
const getCouponDetails = async (req, res) => {
  try {
    const { couponId } = req.params;

    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        service: {
          select: { id: true, name: true, slug: true },
        },
        redemptions: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            transaction: {
              select: { id: true, customId: true, status: true },
            },
            subscription: {
              select: {
                id: true,
                service: { select: { name: true } },
                plan: { select: { name: true } },
              },
            },
          },
          orderBy: { redeemedAt: "desc" },
        },
        _count: {
          select: { redemptions: true },
        },
      },
    });

    if (!coupon) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "Coupon not found");
    }

    sendResponse(
      res,
      StatusCodes.OK,
      { coupon },
      "Coupon details retrieved successfully"
    );
  } catch (error) {
    logger.error("Get coupon details error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve coupon details"
    );
  }
};

/**
 * Update coupon
 * PUT /api/admin/coupons/:couponId
 */
const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const {
      name,
      description,
      status,
      maxUses,
      maxUsesPerUser,
      validFrom,
      validUntil,
    } = req.body;

    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!existingCoupon) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "Coupon not found");
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(maxUses && { maxUses }),
        ...(maxUsesPerUser && { maxUsesPerUser }),
        ...(validFrom && { validFrom: new Date(validFrom) }),
        ...(validUntil !== undefined && {
          validUntil: validUntil ? new Date(validUntil) : null,
        }),
      },
      include: {
        service: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    logger.info(
      `Coupon updated: ${updatedCoupon.code} by admin ${req.user.userId}`
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { coupon: updatedCoupon },
      "Coupon updated successfully"
    );
  } catch (error) {
    logger.error("Update coupon error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update coupon"
    );
  }
};

/**
 * Delete coupon
 * DELETE /api/admin/coupons/:couponId
 */
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    if (!existingCoupon) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "Coupon not found");
    }

    if (existingCoupon._count.redemptions > 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Cannot delete coupon that has been redeemed. Consider disabling it instead."
      );
    }

    await prisma.coupon.delete({
      where: { id: couponId },
    });

    logger.info(
      `Coupon deleted: ${existingCoupon.code} by admin ${req.user.userId}`
    );

    sendResponse(res, StatusCodes.OK, null, "Coupon deleted successfully");
  } catch (error) {
    logger.error("Delete coupon error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to delete coupon"
    );
  }
};

/**
 * Get coupon statistics
 * GET /api/admin/coupons/statistics
 */
const getCouponStatistics = async (req, res) => {
  try {
    const { period = "month" } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      usedUpCoupons,
      totalRedemptions,
      periodRedemptions,
      topCoupons,
      redemptionsByType,
    ] = await Promise.all([
      // Total coupons
      prisma.coupon.count(),

      // Active coupons
      prisma.coupon.count({
        where: { status: "ACTIVE" },
      }),

      // Expired coupons
      prisma.coupon.count({
        where: { status: "EXPIRED" },
      }),

      // Used up coupons
      prisma.coupon.count({
        where: { status: "USED_UP" },
      }),

      // Total redemptions
      prisma.couponRedemption.count(),

      // Period redemptions
      prisma.couponRedemption.count({
        where: {
          redeemedAt: {
            gte: startDate,
          },
        },
      }),

      // Top redeemed coupons
      prisma.coupon.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          usedCount: true,
          maxUses: true,
        },
        orderBy: { usedCount: "desc" },
        take: 10,
      }),

      // Redemptions by type
      prisma.couponRedemption.groupBy({
        by: ["redemptionType"],
        _count: {
          id: true,
        },
        where: {
          redeemedAt: {
            gte: startDate,
          },
        },
      }),
    ]);

    const statistics = {
      overview: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        usedUpCoupons,
        totalRedemptions,
        periodRedemptions,
      },
      topCoupons,
      redemptionsByType: redemptionsByType.reduce((acc, item) => {
        acc[item.redemptionType] = item._count.id;
        return acc;
      }, {}),
      period,
      startDate,
      endDate: now,
    };

    sendResponse(
      res,
      StatusCodes.OK,
      { statistics },
      "Coupon statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Get coupon statistics error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve coupon statistics"
    );
  }
};

/**
 * Bulk update coupon status
 * PUT /api/admin/coupons/bulk-status
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const { couponIds, status } = req.body;

    if (!couponIds || !Array.isArray(couponIds) || couponIds.length === 0) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Coupon IDs array is required"
      );
    }

    if (!["ACTIVE", "DISABLED", "EXPIRED"].includes(status)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Invalid status. Must be ACTIVE, DISABLED, or EXPIRED"
      );
    }

    const result = await prisma.coupon.updateMany({
      where: {
        id: { in: couponIds },
      },
      data: {
        status,
      },
    });

    logger.info(
      `Bulk status update: ${result.count} coupons set to ${status} by admin ${req.user.userId}`
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { updatedCount: result.count },
      `${result.count} coupons updated successfully`
    );
  } catch (error) {
    logger.error("Bulk update status error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update coupon status"
    );
  }
};

export default {
  createCoupon,
  listCoupons,
  getCouponDetails,
  updateCoupon,
  deleteCoupon,
  getCouponStatistics,
  bulkUpdateStatus,
};
