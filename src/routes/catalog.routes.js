import express from "express";
import catalogController from "../controllers/catalog.controller.js";
import validate from "../middleware/validate.js";
import catalogValidation from "../validations/catalog.validation.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Protected catalog endpoints - authentication required

/**
 * @route   GET /api/catalog/categories
 * @desc    Get all service categories
 * @access  Private (User/Admin)
 */
router.get("/categories", catalogController.getCategories);

/**
 * @route   GET /api/catalog/services
 * @desc    Get all services with pagination
 * @access  Private (User/Admin)
 */
router.get(
  "/services",

  validate(catalogValidation.getAllServices),
  catalogController.getAllServices
);

/**
 * @route   GET /api/catalog/categories/:categorySlug/services
 * @desc    Get services by category
 * @access  Private (User/Admin)
 */
router.get(
  "/categories/:categorySlug/services",

  validate(catalogValidation.getServicesByCategory),
  catalogController.getServicesByCategory
);

/**
 * @route   GET /api/catalog/services/:serviceSlug
 * @desc    Get service details
 * @access  Private (User/Admin)
 */
router.get(
  "/services/:serviceSlug",

  validate(catalogValidation.getServiceDetails),
  catalogController.getServiceDetails
);

/**
 * @route   GET /api/catalog/services/:serviceSlug/plans
 * @desc    Get service plans
 * @access  Private (User/Admin)
 */
router.get(
  "/services/:serviceSlug/plans",

  validate(catalogValidation.getServicePlans),
  catalogController.getServicePlans
);

/**
 * @route   GET /api/catalog/search
 * @desc    Search services
 * @access  Private (User/Admin)
 */
router.get(
  "/search",

  validate(catalogValidation.searchServices),
  catalogController.searchServices
);

/**
 * @route   GET /api/catalog/featured
 * @desc    Get featured services
 * @access  Private (User/Admin)
 */
router.get(
  "/featured",

  validate(catalogValidation.getFeaturedServices),
  catalogController.getFeaturedServices
);

export default router;
