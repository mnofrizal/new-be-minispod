import userService from "../services/user.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await userService.getProfileById(userId);

    if (!user) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, "User not found");
    }

    sendResponse(
      res,
      StatusCodes.OK,
      { user },
      "Profile retrieved successfully"
    );
  } catch (error) {
    logger.error("Get profile error:", error);
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

    if (!avatar || typeof avatar !== "string") {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        "Avatar URL is required and must be a string"
      );
    }

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

export default {
  getProfile,
  updateProfile,
  updateAvatar,
};
