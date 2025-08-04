const express = require("express");
const authController = require("../controllers/auth.controller");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);

// Protected routes
router.get("/profile", authenticateToken, authController.getProfile);
router.post("/logout", authenticateToken, authController.logout);
router.post("/logout-all", authenticateToken, authController.logoutAll);

module.exports = router;
