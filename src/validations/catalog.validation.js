import Joi from "joi";

const getServicesByCategory = {
  params: Joi.object().keys({
    categorySlug: Joi.string().required().messages({
      "string.empty": "Category slug is required",
      "any.required": "Category slug is required",
    }),
  }),
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),
};

const getServiceDetails = {
  params: Joi.object().keys({
    serviceSlug: Joi.string().required().messages({
      "string.empty": "Service slug is required",
      "any.required": "Service slug is required",
    }),
  }),
};

const getServicePlans = {
  params: Joi.object().keys({
    serviceSlug: Joi.string().required().messages({
      "string.empty": "Service slug is required",
      "any.required": "Service slug is required",
    }),
  }),
};

const searchServices = {
  query: Joi.object().keys({
    q: Joi.string().optional().allow(""),
    category: Joi.string().optional().allow(""),
    featured: Joi.string().valid("true", "false").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),
};

const getAllServices = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),
};

const getFeaturedServices = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(20).optional(),
  }),
};

export default {
  getAllServices,
  getServicesByCategory,
  getServiceDetails,
  getServicePlans,
  searchServices,
  getFeaturedServices,
};
