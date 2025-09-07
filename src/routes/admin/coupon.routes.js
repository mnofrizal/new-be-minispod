import express from "express";
import couponController from "../../controllers/admin/coupon.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import couponValidation from "../../validations/coupon.validation.js";

const router = express.Router();

// All admin coupon routes require ADMINISTRATOR role
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// Create new coupon
router.post(
  "/",
  validate({ body: couponValidation.createCouponSchema }),
  couponController.createCoupon
);

// List all coupons with filtering
router.get(
  "/",
  validate({ query: couponValidation.listCouponsSchema }),
  couponController.listCoupons
);

// Get coupon statistics
router.get(
  "/statistics",
  validate({ query: couponValidation.couponStatisticsSchema }),
  couponController.getCouponStatistics
);

// Bulk update coupon status
router.put(
  "/bulk-status",
  validate({ body: couponValidation.bulkUpdateStatusSchema }),
  couponController.bulkUpdateStatus
);

// Get coupon details
router.get(
  "/:couponId",
  validate({ params: couponValidation.couponIdSchema }),
  couponController.getCouponDetails
);

// Update coupon
router.put(
  "/:couponId",
  validate({
    params: couponValidation.couponIdSchema,
    body: couponValidation.updateCouponSchema,
  }),
  couponController.updateCoupon
);

// Delete coupon
router.delete(
  "/:couponId",
  validate({ params: couponValidation.couponIdSchema }),
  couponController.deleteCoupon
);

export default router;
