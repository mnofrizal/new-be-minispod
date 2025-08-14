import catalogService from "../services/catalog.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

const getCategories = async (req, res) => {
  try {
    const categories = await catalogService.getServiceCategories();

    sendResponse(
      res,
      StatusCodes.OK,
      categories,
      "Service categories retrieved successfully"
    );
  } catch (error) {
    logger.error("Get categories error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service categories"
    );
  }
};

const getServicesByCategory = async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await catalogService.getServicesByCategory(
      categorySlug,
      parseInt(page),
      parseInt(limit)
    );

    if (!result) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Category not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Services retrieved successfully"
    );
  } catch (error) {
    logger.error("Get services by category error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve services"
    );
  }
};

const getAllServices = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await catalogService.getAllServices(
      parseInt(page),
      parseInt(limit)
    );

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "All services retrieved successfully"
    );
  } catch (error) {
    logger.error("Get all services error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve services"
    );
  }
};

const getServiceDetails = async (req, res) => {
  try {
    const { serviceSlug } = req.params;

    const service = await catalogService.getServiceDetails(serviceSlug);

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.OK,
      service,
      "Service details retrieved successfully"
    );
  } catch (error) {
    logger.error("Get service details error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service details"
    );
  }
};

const searchServices = async (req, res) => {
  try {
    const {
      q = "",
      category = "",
      featured = false,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {
      query: q,
      category,
      featured: featured === "true",
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const result = await catalogService.searchServices(filters);

    sendResponse(res, StatusCodes.OK, result, "Search completed successfully");
  } catch (error) {
    logger.error("Search services error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to search services"
    );
  }
};

const getFeaturedServices = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const services = await catalogService.getFeaturedServices(parseInt(limit));

    sendResponse(
      res,
      StatusCodes.OK,
      services,
      "Featured services retrieved successfully"
    );
  } catch (error) {
    logger.error("Get featured services error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve featured services"
    );
  }
};

const getServicePlans = async (req, res) => {
  try {
    const { serviceSlug } = req.params;

    const plans = await catalogService.getServicePlans(serviceSlug);

    if (!plans) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    sendResponse(
      res,
      StatusCodes.OK,
      plans,
      "Service plans retrieved successfully"
    );
  } catch (error) {
    logger.error("Get service plans error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service plans"
    );
  }
};

export default {
  getCategories,
  getAllServices,
  getServicesByCategory,
  getServiceDetails,
  searchServices,
  getFeaturedServices,
  getServicePlans,
};
