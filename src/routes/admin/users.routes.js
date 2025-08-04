import express from "express";
import userController from "../../controllers/user.controller.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import userValidation from "../../validations/user.validation.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

// POST /api/admin/users - Create new user (Admin Only)
router.post(
  "/",
  validate(userValidation.createUser),
  userController.createUser
);

// GET /api/admin/users - Get all users with pagination and filters
router.get("/", userController.getAllUsers);

// GET /api/admin/users/:id - Get user by ID
router.get("/:id", userController.getUserById);

// PUT /api/admin/users/:id - Update user
router.put(
  "/:id",
  validate(userValidation.updateUser),
  userController.updateUser
);

// DELETE /api/admin/users/:id - Delete user
router.delete("/:id", userController.deleteUser);

// PATCH /api/admin/users/:id/status - Toggle user active status
router.patch(
  "/:id/status",
  validate(userValidation.toggleStatus),
  userController.toggleUserStatus
);

export default router;
