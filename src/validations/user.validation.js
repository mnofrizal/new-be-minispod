import Joi from "joi";

const updateProfile = {
  body: Joi.object().keys({
    name: Joi.string().messages({
      "string.base": "Name must be a string",
    }),
    phone: Joi.string()
      .pattern(/^(\+62|62|0)8[1-9][0-9]{6,9}$/)
      .messages({
        "string.base": "Phone must be a string",
        "string.pattern.base":
          "Phone number must be a valid Indonesian phone number",
      }),
    avatar: Joi.string().messages({
      "string.base": "Avatar must be a string",
    }),
  }),
};

const updateAvatar = {
  body: Joi.object().keys({
    avatar: Joi.string().required().messages({
      "string.base": "Avatar must be a string",
      "any.required": "Avatar is required",
    }),
  }),
};

export default {
  updateProfile,
  updateAvatar,
};
