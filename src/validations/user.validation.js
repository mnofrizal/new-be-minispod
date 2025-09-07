import Joi from "joi";

const updateProfile = {
  body: Joi.object().keys({
    name: Joi.string().min(2).max(50).optional().messages({
      "string.base": "Name must be a string",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 50 characters",
    }),
    phone: Joi.string()
      .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
      .optional()
      .messages({
        "string.base": "Phone must be a string",
        "string.pattern.base":
          "Phone number must be a valid Indonesian phone number",
      }),
    avatar: Joi.string().uri().optional().messages({
      "string.base": "Avatar must be a string",
      "string.uri": "Avatar must be a valid URL",
    }),
  }),
};

const updateAvatar = {
  body: Joi.object().keys({
    avatar: Joi.string().uri().required().messages({
      "string.base": "Avatar must be a string",
      "string.uri": "Avatar must be a valid URL",
      "any.required": "Avatar is required",
    }),
  }),
};

const getAllUsers = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    search: Joi.string().optional().allow(""),
    role: Joi.string().valid("USER", "ADMINISTRATOR").optional(),
  }),
};

const getUserById = {
  params: Joi.object().keys({
    id: Joi.string().required().messages({
      "string.empty": "User ID is required",
      "any.required": "User ID is required",
    }),
  }),
};

const createUser = {
  body: Joi.object().keys({
    name: Joi.string().min(2).max(50).required().messages({
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 50 characters",
      "any.required": "Name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Email must be a valid email address",
      "any.required": "Email is required",
    }),
    phone: Joi.string()
      .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Phone number must be a valid Indonesian phone number",
      }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
    role: Joi.string()
      .valid("USER", "ADMINISTRATOR")
      .optional()
      .default("USER"),
    avatar: Joi.string().uri().optional().messages({
      "string.uri": "Avatar must be a valid URL",
    }),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    id: Joi.string().required().messages({
      "string.empty": "User ID is required",
      "any.required": "User ID is required",
    }),
  }),
  body: Joi.object().keys({
    name: Joi.string().min(2).max(50).optional().messages({
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 50 characters",
    }),
    phone: Joi.string()
      .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Phone number must be a valid Indonesian phone number",
      }),
    role: Joi.string().valid("USER", "ADMINISTRATOR").optional(),
    avatar: Joi.string().uri().optional().messages({
      "string.uri": "Avatar must be a valid URL",
    }),
  }),
};

const deleteUser = {
  params: Joi.object().keys({
    id: Joi.string().required().messages({
      "string.empty": "User ID is required",
      "any.required": "User ID is required",
    }),
  }),
};

const toggleUserStatus = {
  params: Joi.object().keys({
    id: Joi.string().required().messages({
      "string.empty": "User ID is required",
      "any.required": "User ID is required",
    }),
  }),
  body: Joi.object().keys({
    isActive: Joi.boolean().required().messages({
      "boolean.base": "isActive must be a boolean value",
      "any.required": "isActive is required",
    }),
  }),
};

export default {
  updateProfile,
  updateAvatar,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
};
