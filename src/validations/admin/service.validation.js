import Joi from "joi";

/**
 * Validation schema for creating a new service
 */
export const createServiceValidation = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      "string.empty": "Service name is required",
      "string.min": "Service name must be at least 2 characters long",
      "string.max": "Service name cannot exceed 100 characters",
    }),

    slug: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-z0-9-]+$/)
      .required()
      .messages({
        "string.empty": "Service slug is required",
        "string.min": "Service slug must be at least 2 characters long",
        "string.max": "Service slug cannot exceed 50 characters",
        "string.pattern.base":
          "Service slug can only contain lowercase letters, numbers, and hyphens",
      }),

    description: Joi.string().min(10).max(1000).required().messages({
      "string.empty": "Service description is required",
      "string.min": "Service description must be at least 10 characters long",
      "string.max": "Service description cannot exceed 1000 characters",
    }),

    categoryId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Category ID must contain only letters and numbers",
      "string.min": "Category ID must be at least 20 characters long",
      "string.max": "Category ID must not exceed 30 characters",
      "any.required": "Category ID is required",
    }),

    longDescription: Joi.string().max(5000).messages({
      "string.max": "Long description cannot exceed 5000 characters",
    }),

    icon: Joi.string().uri().messages({
      "string.uri": "Icon must be a valid URL",
    }),

    version: Joi.string().min(1).max(50).default("latest").messages({
      "string.min": "Version must be at least 1 character long",
      "string.max": "Version cannot exceed 50 characters",
    }),

    dockerImage: Joi.string().min(3).max(200).required().messages({
      "string.empty": "Docker image is required",
      "string.min": "Docker image must be at least 3 characters long",
      "string.max": "Docker image cannot exceed 200 characters",
    }),

    defaultPort: Joi.number().integer().min(1).max(65535).required().messages({
      "number.base": "Default port must be a number",
      "number.integer": "Default port must be an integer",
      "number.min": "Default port must be at least 1",
      "number.max": "Default port cannot exceed 65535",
    }),

    envTemplate: Joi.object().messages({
      "object.base": "Environment template must be an object",
    }),

    tags: Joi.array().items(Joi.string()).messages({
      "array.base": "Tags must be an array of strings",
    }),

    documentation: Joi.string().uri().messages({
      "string.uri": "Documentation must be a valid URL",
    }),

    isActive: Joi.boolean().default(true).messages({
      "boolean.base": "isActive must be a boolean value",
    }),

    isPublic: Joi.boolean().default(true).messages({
      "boolean.base": "isPublic must be a boolean value",
    }),

    isFeatured: Joi.boolean().default(false).messages({
      "boolean.base": "isFeatured must be a boolean value",
    }),

    sortOrder: Joi.number().integer().min(0).default(0).messages({
      "number.base": "Sort order must be a number",
      "number.integer": "Sort order must be an integer",
      "number.min": "Sort order must be at least 0",
    }),
  }),
};

/**
 * Validation schema for updating a service
 */
export const updateServiceValidation = {
  params: Joi.object({
    id: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),
  }),

  body: Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Service name must be at least 2 characters long",
      "string.max": "Service name cannot exceed 100 characters",
    }),

    slug: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-z0-9-]+$/)
      .messages({
        "string.min": "Service slug must be at least 2 characters long",
        "string.max": "Service slug cannot exceed 50 characters",
        "string.pattern.base":
          "Service slug can only contain lowercase letters, numbers, and hyphens",
      }),

    description: Joi.string().min(10).max(1000).messages({
      "string.min": "Service description must be at least 10 characters long",
      "string.max": "Service description cannot exceed 1000 characters",
    }),

    categoryId: Joi.string().alphanum().min(20).max(30).messages({
      "string.alphanum": "Category ID must contain only letters and numbers",
      "string.min": "Category ID must be at least 20 characters long",
      "string.max": "Category ID must not exceed 30 characters",
    }),

    longDescription: Joi.string().max(5000).messages({
      "string.max": "Long description cannot exceed 5000 characters",
    }),

    icon: Joi.string().uri().messages({
      "string.uri": "Icon must be a valid URL",
    }),

    version: Joi.string().min(1).max(50).messages({
      "string.min": "Version must be at least 1 character long",
      "string.max": "Version cannot exceed 50 characters",
    }),

    dockerImage: Joi.string().min(3).max(200).messages({
      "string.min": "Docker image must be at least 3 characters long",
      "string.max": "Docker image cannot exceed 200 characters",
    }),

    defaultPort: Joi.number().integer().min(1).max(65535).messages({
      "number.base": "Default port must be a number",
      "number.integer": "Default port must be an integer",
      "number.min": "Default port must be at least 1",
      "number.max": "Default port cannot exceed 65535",
    }),

    envTemplate: Joi.object().messages({
      "object.base": "Environment template must be an object",
    }),

    tags: Joi.array().items(Joi.string()).messages({
      "array.base": "Tags must be an array of strings",
    }),

    documentation: Joi.string().uri().messages({
      "string.uri": "Documentation must be a valid URL",
    }),

    isActive: Joi.boolean().messages({
      "boolean.base": "isActive must be a boolean value",
    }),

    isPublic: Joi.boolean().messages({
      "boolean.base": "isPublic must be a boolean value",
    }),

    isFeatured: Joi.boolean().messages({
      "boolean.base": "isFeatured must be a boolean value",
    }),

    sortOrder: Joi.number().integer().min(0).messages({
      "number.base": "Sort order must be a number",
      "number.integer": "Sort order must be an integer",
      "number.min": "Sort order must be at least 0",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * Validation schema for getting services with filters
 */
export const getServicesValidation = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),

    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),

    category: Joi.string().min(2).max(50).messages({
      "string.min": "Category must be at least 2 characters long",
      "string.max": "Category cannot exceed 50 characters",
    }),

    status: Joi.string().valid("active", "inactive").messages({
      "any.only": 'Status must be either "active" or "inactive"',
    }),

    search: Joi.string().min(1).max(100).messages({
      "string.min": "Search term must be at least 1 character long",
      "string.max": "Search term cannot exceed 100 characters",
    }),

    sortBy: Joi.string()
      .valid("name", "createdAt", "updatedAt")
      .default("createdAt")
      .messages({
        "any.only": "sortBy must be one of: name, createdAt, updatedAt",
      }),

    sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
      "any.only": 'sortOrder must be either "asc" or "desc"',
    }),
  }),
};

/**
 * Validation schema for creating a new service plan
 */
export const createServicePlanValidation = {
  params: Joi.object({
    serviceId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),
  }),

  body: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      "string.empty": "Plan name is required",
      "string.min": "Plan name must be at least 2 characters long",
      "string.max": "Plan name cannot exceed 100 characters",
    }),

    planType: Joi.string()
      .valid("FREE", "BASIC", "PRO", "PREMIUM", "ENTERPRISE")
      .required()
      .messages({
        "any.only":
          "Plan type must be one of: FREE, BASIC, PRO, PREMIUM, ENTERPRISE",
        "any.required": "Plan type is required",
      }),

    description: Joi.string().min(10).max(1000).messages({
      "string.min": "Plan description must be at least 10 characters long",
      "string.max": "Plan description cannot exceed 1000 characters",
    }),

    monthlyPrice: Joi.number()
      .integer()
      .min(0)
      .max(100000000)
      .required()
      .messages({
        "number.base": "Monthly price must be a number",
        "number.integer": "Monthly price must be an integer",
        "number.min": "Monthly price must be at least 0 IDR",
        "number.max": "Monthly price cannot exceed 100,000,000 IDR",
        "any.required": "Monthly price is required",
      }),

    cpuMilli: Joi.number().integer().min(100).max(16000).required().messages({
      "number.base": "CPU allocation must be a number",
      "number.integer": "CPU allocation must be an integer",
      "number.min": "CPU allocation must be at least 100 millicores",
      "number.max": "CPU allocation cannot exceed 16000 millicores",
      "any.required": "CPU allocation is required",
    }),

    memoryMb: Joi.number().integer().min(128).max(32768).required().messages({
      "number.base": "Memory allocation must be a number",
      "number.integer": "Memory allocation must be an integer",
      "number.min": "Memory allocation must be at least 128 MB",
      "number.max": "Memory allocation cannot exceed 32768 MB",
      "any.required": "Memory allocation is required",
    }),

    storageGb: Joi.number().min(0.1).max(1000).required().messages({
      "number.base": "Storage allocation must be a number",
      "number.min": "Storage allocation must be at least 0.1 GB",
      "number.max": "Storage allocation cannot exceed 1000 GB",
      "any.required": "Storage allocation is required",
    }),

    bandwidth: Joi.number().integer().min(0).max(10000).default(0).messages({
      "number.base": "Bandwidth must be a number",
      "number.integer": "Bandwidth must be an integer",
      "number.min": "Bandwidth must be at least 0 GB",
      "number.max": "Bandwidth cannot exceed 10000 GB",
    }),

    totalQuota: Joi.number().integer().min(1).max(10000).required().messages({
      "number.base": "Total quota must be a number",
      "number.integer": "Total quota must be an integer",
      "number.min": "Total quota must be at least 1",
      "number.max": "Total quota cannot exceed 10000",
      "any.required": "Total quota is required",
    }),

    features: Joi.array().items(Joi.string()).messages({
      "array.base": "Features must be an array of strings",
    }),

    maxInstancesPerUser: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(1)
      .messages({
        "number.base": "Max instances per user must be a number",
        "number.integer": "Max instances per user must be an integer",
        "number.min": "Max instances per user must be at least 1",
        "number.max": "Max instances per user cannot exceed 100",
      }),

    maxDomains: Joi.number().integer().min(1).max(100).default(1).messages({
      "number.base": "Max domains must be a number",
      "number.integer": "Max domains must be an integer",
      "number.min": "Max domains must be at least 1",
      "number.max": "Max domains cannot exceed 100",
    }),

    isActive: Joi.boolean().default(true).messages({
      "boolean.base": "isActive must be a boolean value",
    }),

    isPopular: Joi.boolean().default(false).messages({
      "boolean.base": "isPopular must be a boolean value",
    }),

    sortOrder: Joi.number().integer().min(0).default(0).messages({
      "number.base": "Sort order must be a number",
      "number.integer": "Sort order must be an integer",
      "number.min": "Sort order must be at least 0",
    }),
  }),
};

/**
 * Validation schema for updating a service plan
 */
export const updateServicePlanValidation = {
  params: Joi.object({
    serviceId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),

    planId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum":
        "Service plan ID must contain only letters and numbers",
      "string.min": "Service plan ID must be at least 20 characters long",
      "string.max": "Service plan ID must not exceed 30 characters",
      "any.required": "Service plan ID is required",
    }),
  }),

  body: Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Plan name must be at least 2 characters long",
      "string.max": "Plan name cannot exceed 100 characters",
    }),

    description: Joi.string().min(10).max(1000).messages({
      "string.min": "Plan description must be at least 10 characters long",
      "string.max": "Plan description cannot exceed 1000 characters",
    }),

    monthlyPrice: Joi.number().integer().min(0).max(100000000).messages({
      "number.base": "Monthly price must be a number",
      "number.integer": "Monthly price must be an integer",
      "number.min": "Monthly price must be at least 0 IDR",
      "number.max": "Monthly price cannot exceed 100,000,000 IDR",
    }),

    cpuMilli: Joi.number().integer().min(100).max(16000).messages({
      "number.base": "CPU allocation must be a number",
      "number.integer": "CPU allocation must be an integer",
      "number.min": "CPU allocation must be at least 100 millicores",
      "number.max": "CPU allocation cannot exceed 16000 millicores",
    }),

    memoryMb: Joi.number().integer().min(128).max(32768).messages({
      "number.base": "Memory allocation must be a number",
      "number.integer": "Memory allocation must be an integer",
      "number.min": "Memory allocation must be at least 128 MB",
      "number.max": "Memory allocation cannot exceed 32768 MB",
    }),

    storageGb: Joi.number().min(0.1).max(1000).messages({
      "number.base": "Storage allocation must be a number",
      "number.min": "Storage allocation must be at least 0.1 GB",
      "number.max": "Storage allocation cannot exceed 1000 GB",
    }),

    bandwidth: Joi.number().integer().min(0).max(10000).messages({
      "number.base": "Bandwidth must be a number",
      "number.integer": "Bandwidth must be an integer",
      "number.min": "Bandwidth must be at least 0 GB",
      "number.max": "Bandwidth cannot exceed 10000 GB",
    }),

    totalQuota: Joi.number().integer().min(1).max(10000).messages({
      "number.base": "Total quota must be a number",
      "number.integer": "Total quota must be an integer",
      "number.min": "Total quota must be at least 1",
      "number.max": "Total quota cannot exceed 10000",
    }),

    features: Joi.array().items(Joi.string()).messages({
      "array.base": "Features must be an array of strings",
    }),

    maxInstancesPerUser: Joi.number().integer().min(1).max(100).messages({
      "number.base": "Max instances per user must be a number",
      "number.integer": "Max instances per user must be an integer",
      "number.min": "Max instances per user must be at least 1",
      "number.max": "Max instances per user cannot exceed 100",
    }),

    maxDomains: Joi.number().integer().min(1).max(100).messages({
      "number.base": "Max domains must be a number",
      "number.integer": "Max domains must be an integer",
      "number.min": "Max domains must be at least 1",
      "number.max": "Max domains cannot exceed 100",
    }),

    isActive: Joi.boolean().messages({
      "boolean.base": "isActive must be a boolean value",
    }),

    isPopular: Joi.boolean().messages({
      "boolean.base": "isPopular must be a boolean value",
    }),

    sortOrder: Joi.number().integer().min(0).messages({
      "number.base": "Sort order must be a number",
      "number.integer": "Sort order must be an integer",
      "number.min": "Sort order must be at least 0",
    }),
  })
    .min(1)
    .messages({
      "object.min": "At least one field must be provided for update",
    }),
};

/**
 * Validation schema for service plan ID parameters
 */
export const servicePlanIdValidation = {
  params: Joi.object({
    serviceId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),

    planId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum":
        "Service plan ID must contain only letters and numbers",
      "string.min": "Service plan ID must be at least 20 characters long",
      "string.max": "Service plan ID must not exceed 30 characters",
      "any.required": "Service plan ID is required",
    }),
  }),

  query: Joi.object({
    force: Joi.boolean().default(false).messages({
      "boolean.base": "Force parameter must be a boolean value",
    }),
  }),
};

/**
 * Validation schema for service ID parameter
 */
export const serviceIdValidation = {
  params: Joi.object({
    id: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),
  }),

  query: Joi.object({
    force: Joi.boolean().default(false).messages({
      "boolean.base": "Force parameter must be a boolean value",
    }),
  }),
};

/**
 * Validation schema for service plan routes that use serviceId parameter
 */
export const servicePlanServiceIdValidation = {
  params: Joi.object({
    serviceId: Joi.string().alphanum().min(20).max(30).required().messages({
      "string.alphanum": "Service ID must contain only letters and numbers",
      "string.min": "Service ID must be at least 20 characters long",
      "string.max": "Service ID must not exceed 30 characters",
      "any.required": "Service ID is required",
    }),
  }),
};
