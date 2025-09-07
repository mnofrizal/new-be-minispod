import express from "express";
import authController from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import authValidation from "../validations/auth.validation.js";

const router = express.Router();

// Public routes
router.post(
  "/register",
  validate(authValidation.register),
  authController.register
);
router.post("/login", validate(authValidation.login), authController.login);
router.post(
  "/refresh-token",
  validate(authValidation.refreshToken),
  authController.refreshToken
);

// Google OAuth routes
router.post(
  "/google/login",
  validate(authValidation.googleLogin),
  authController.googleLogin
);

// Protected routes
router.get("/profile", authenticateToken, authController.getProfile);
router.post(
  "/logout",
  authenticateToken,
  validate(authValidation.logout),
  authController.logout
);
router.post("/logout-all", authenticateToken, authController.logoutAll);

// Google OAuth protected routes
router.post(
  "/google/link",
  authenticateToken,
  validate(authValidation.linkGoogleAccount),
  authController.linkGoogleAccount
);
router.post(
  "/google/unlink",
  authenticateToken,
  authController.unlinkGoogleAccount
);

export default router;
