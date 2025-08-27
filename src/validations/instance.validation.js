import Joi from "joi";

/**
 * Validation schema for creating a service instance
 */
const createInstance = {
  body: Joi.object({
    subscriptionId: Joi.string().required().messages({
      "string.empty": "Subscription ID is required",
      "any.required": "Subscription ID is required",
    }),
  }),
};

/**
 * Validation schema for getting user instances
 */
const getUserInstances = {
  query: Joi.object({
    status: Joi.string()
      .valid(
        "PENDING",
        "PROVISIONING",
        "RUNNING",
        "STOPPED",
        "ERROR",
        "TERMINATED",
        "MAINTENANCE"
      )
      .optional()
      .messages({
        "any.only":
          "Status must be one of: PENDING, PROVISIONING, RUNNING, STOPPED, ERROR, TERMINATED, MAINTENANCE",
      }),
    includeTerminated: Joi.string().valid("true", "false").optional().messages({
      "any.only": "includeTerminated must be 'true' or 'false'",
    }),
  }),
};

/**
 * Validation schema for getting instance details
 */
const getInstanceDetails = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
};

/**
 * Validation schema for updating service instance
 */
const updateInstance = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
  body: Joi.object({
    planId: Joi.string().required().messages({
      "string.empty": "Plan ID is required",
      "any.required": "Plan ID is required",
    }),
  }),
};

/**
 * Validation schema for terminating service instance
 */
const terminateInstance = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
};

/**
 * Validation schema for getting instance logs
 */
const getInstanceLogs = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
  query: Joi.object({
    lines: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .messages({
        "number.base": "Lines must be a number",
        "number.integer": "Lines must be an integer",
        "number.min": "Lines must be at least 1",
        "number.max": "Lines cannot exceed 1000",
      }),
    follow: Joi.string()
      .valid("true", "false")
      .optional()
      .default("false")
      .messages({
        "any.only": "Follow must be 'true' or 'false'",
      }),
  }),
};

/**
 * Validation schema for restarting service instance
 */
const restartInstance = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
};

/**
 * Validation schema for stopping service instance
 */
const stopInstance = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
};

/**
 * Validation schema for starting service instance
 */
const startInstance = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.empty": "Instance ID is required",
      "any.required": "Instance ID is required",
    }),
  }),
};

export default {
  createInstance,
  getUserInstances,
  getInstanceDetails,
  updateInstance,
  terminateInstance,
  getInstanceLogs,
  restartInstance,
  stopInstance,
  startInstance,
};
