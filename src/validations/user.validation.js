import Joi from "joi";

const updateProfile = {
  body: Joi.object().keys({
    name: Joi.string(),
    email: Joi.string().email(),
  }),
};

export default {
  updateProfile,
};
