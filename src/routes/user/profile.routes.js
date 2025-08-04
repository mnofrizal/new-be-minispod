import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import userValidation from "../../validations/user.validation.js";
import userController from "../../controllers/user.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Profile routes
router.get("/profile", userController.getProfile);
router.put(
  "/profile",
  validate(userValidation.updateProfile),
  userController.updateProfile
);
router.patch(
  "/avatar",
  validate(userValidation.updateAvatar),
  userController.updateAvatar
);

export default router;
