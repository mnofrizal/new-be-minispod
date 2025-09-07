import express from "express";
import validate from "../../middleware/validate.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getServiceStatistics,
  getAllServicePlans,
  getServicePlans,
  createServicePlan,
  getServicePlan,
  updateServicePlan,
  deleteServicePlan,
  toggleServicePlanStatus,
} from "../../controllers/admin/service.controller.js";
import {
  createServiceValidation,
  updateServiceValidation,
  getServicesValidation,
  serviceIdValidation,
  createServicePlanValidation,
  updateServicePlanValidation,
  servicePlanIdValidation,
  servicePlanServiceIdValidation,
} from "../../validations/admin/service.validation.js";

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   GET /api/admin/services/statistics
 * @desc    Get service statistics
 * @access  Admin only
 */
router.get("/statistics", getServiceStatistics);

/**
 * @route   GET /api/admin/plans
 * @desc    Get all service plans across all services
 * @access  Admin only
 */
router.get("/plans", validate(getServicesValidation), getAllServicePlans);

/**
 * @route   GET /api/admin/services
 * @desc    Get all services with filtering and pagination
 * @access  Admin only
 */
router.get("/", validate(getServicesValidation), getAllServices);

/**
 * @route   GET /api/admin/services/:id
 * @desc    Get service by ID
 * @access  Admin only
 */
router.get("/:id", validate(serviceIdValidation), getServiceById);

/**
 * @route   POST /api/admin/services
 * @desc    Create new service
 * @access  Admin only
 */
router.post("/", validate(createServiceValidation), createService);

/**
 * @route   PUT /api/admin/services/:id
 * @desc    Update service
 * @access  Admin only
 */
router.put("/:id", validate(updateServiceValidation), updateService);

/**
 * @route   DELETE /api/admin/services/:id
 * @desc    Delete service
 * @access  Admin only
 */
router.delete("/:id", validate(serviceIdValidation), deleteService);

/**
 * @route   PATCH /api/admin/services/:id/toggle-status
 * @desc    Toggle service status (active/inactive)
 * @access  Admin only
 */
router.patch(
  "/:id/toggle-status",
  validate(serviceIdValidation),
  toggleServiceStatus
);

/**
 * @route   GET /api/admin/services/:serviceId/plans
 * @desc    Get all plans for a specific service
 * @access  Admin only
 */
router.get(
  "/:serviceId/plans",
  validate(servicePlanServiceIdValidation),
  getServicePlans
);

/**
 * @route   POST /api/admin/services/:serviceId/plans
 * @desc    Create new service plan for a service
 * @access  Admin only
 */
router.post(
  "/:serviceId/plans",
  validate(createServicePlanValidation),
  createServicePlan
);

/**
 * @route   GET /api/admin/services/:serviceId/plans/:planId
 * @desc    Get specific service plan
 * @access  Admin only
 */
router.get(
  "/:serviceId/plans/:planId",
  validate(servicePlanIdValidation),
  getServicePlan
);

/**
 * @route   PUT /api/admin/services/:serviceId/plans/:planId
 * @desc    Update service plan
 * @access  Admin only
 */
router.put(
  "/:serviceId/plans/:planId",
  validate(updateServicePlanValidation),
  updateServicePlan
);

/**
 * @route   DELETE /api/admin/services/:serviceId/plans/:planId
 * @desc    Delete service plan
 * @access  Admin only
 */
router.delete(
  "/:serviceId/plans/:planId",
  validate(servicePlanIdValidation),
  deleteServicePlan
);

/**
 * @route   PATCH /api/admin/services/:serviceId/plans/:planId/toggle-status
 * @desc    Toggle service plan status (active/inactive)
 * @access  Admin only
 */
router.patch(
  "/:serviceId/plans/:planId/toggle-status",
  validate(servicePlanIdValidation),
  toggleServicePlanStatus
);

export default router;
