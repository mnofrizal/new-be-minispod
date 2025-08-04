const express = require("express");
const userController = require("../controllers/user.controller");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Profile routes
router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);
router.patch("/avatar", userController.updateAvatar);

module.exports = router;
