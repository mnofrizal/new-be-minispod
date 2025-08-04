import Joi from "joi";

const register = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Email must be a valid email",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.base": "Password must be a string",
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
    name: Joi.string().required().messages({
      "string.base": "Name must be a string",
      "any.required": "Name is required",
    }),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Email must be a valid email",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "string.base": "Password must be a string",
      "any.required": "Password is required",
    }),
  }),
};

const refreshToken = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required().messages({
      "string.base": "Refresh token must be a string",
      "any.required": "Refresh token is required",
    }),
  }),
};

export default {
  register,
  login,
  refreshToken,
};
