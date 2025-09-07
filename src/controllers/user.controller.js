import userService from "../services/user.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await userService.getProfileById(userId);

    sendResponse(
      res,
      StatusCodes.OK,
      { user },
      "Profile retrieved successfully"
    );
  } catch (error) {
    logger.error("Get profile error:", error);

    if (error.message === "User not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, avatar } = req.body;

    // Update user profile
    const updatedUser = await userService.updateUserProfile(userId, {
      name,
      phone,
      avatar,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      { user: updatedUser },
      "Profile updated successfully"
    );
  } catch (error) {
    logger.error("Update profile error:", error);

    if (error.message === "Phone number is already in use") {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.code === "P2025") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { avatar } = req.body;

    const updatedUser = await userService.updateUserAvatar(userId, avatar);

    sendResponse(
      res,
      StatusCodes.OK,
      { user: updatedUser },
      "Avatar updated successfully"
    );
  } catch (error) {
    logger.error("Update avatar error:", error);

    if (error.code === "P2025") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

// Admin functions
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;

    const users = await userService.getAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      role,
    });

    sendResponse(res, StatusCodes.OK, users, "Users retrieved successfully");
  } catch (error) {
    logger.error("Get all users error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userService.getProfileById(id);

    sendResponse(res, StatusCodes.OK, { user }, "User retrieved successfully");
  } catch (error) {
    logger.error("Get user by ID error:", error);

    if (error.message === "User not found") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, avatar } = req.body;

    const updatedUser = await userService.updateUserProfile(id, {
      name,
      phone,
      role,
      avatar,
    });

    sendResponse(
      res,
      StatusCodes.OK,
      { user: updatedUser },
      "User updated successfully"
    );
  } catch (error) {
    logger.error("Update user error:", error);

    if (error.code === "P2025") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    if (error.message === "Phone number is already in use") {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await userService.deleteUser(id);

    sendResponse(res, StatusCodes.OK, null, "User deleted successfully");
  } catch (error) {
    logger.error("Delete user error:", error);

    if (error.code === "P2025") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedUser = await userService.toggleUserStatus(id, isActive);

    sendResponse(
      res,
      StatusCodes.OK,
      { user: updatedUser },
      `User ${isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    logger.error("Toggle user status error:", error);

    if (error.code === "P2025") {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, avatar } = req.body;

    const newUser = await userService.createUser({
      name,
      email,
      phone,
      password,
      role,
      avatar,
    });

    sendResponse(
      res,
      StatusCodes.CREATED,
      { user: newUser },
      "User created successfully"
    );
  } catch (error) {
    logger.error("Create user error:", error);

    if (error.message === "User with this email already exists") {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    if (error.message === "Phone number is already in use") {
      return sendResponse(res, StatusCodes.CONFLICT, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

export default {
  getProfile,
  updateProfile,
  updateAvatar,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  createUser,
};
