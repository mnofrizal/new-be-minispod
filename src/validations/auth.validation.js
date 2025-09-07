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
    name: Joi.string().min(2).max(50).required().messages({
      "string.base": "Name must be a string",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 50 characters",
      "any.required": "Name is required",
    }),
    phone: Joi.string()
      .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Phone number must be a valid Indonesian phone number",
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

const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().optional().messages({
      "string.base": "Refresh token must be a string",
    }),
  }),
};

const googleLogin = {
  body: Joi.object().keys({
    idToken: Joi.string().required().messages({
      "string.base": "ID token must be a string",
      "any.required": "Google ID token is required",
    }),
  }),
};

const linkGoogleAccount = {
  body: Joi.object().keys({
    idToken: Joi.string().required().messages({
      "string.base": "ID token must be a string",
      "any.required": "Google ID token is required",
    }),
  }),
};

export default {
  register,
  login,
  refreshToken,
  logout,
  googleLogin,
  linkGoogleAccount,
};
