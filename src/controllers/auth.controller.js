import authService from "../services/auth.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, avatar } = req.body;

    const result = await authService.register({
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
      result,
      "User registered successfully"
    );
  } catch (error) {
    logger.error("Registration error:", error);

    if (error.message === "User with this email already exists") {
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

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    sendResponse(res, StatusCodes.OK, result, "Login successful");
  } catch (error) {
    logger.error("Login error:", error);

    if (error.message === "Invalid email or password") {
      return sendResponse(res, StatusCodes.UNAUTHORIZED, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const result = await authService.refreshAccessToken(refreshToken);

    sendResponse(res, StatusCodes.OK, result, "Token refreshed successfully");
  } catch (error) {
    logger.error("Refresh token error:", error);

    if (
      error.message === "Invalid refresh token" ||
      error.message === "Refresh token expired"
    ) {
      return sendResponse(res, StatusCodes.UNAUTHORIZED, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    sendResponse(res, StatusCodes.OK, null, "Logged out successfully");
  } catch (error) {
    logger.error("Logout error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const logoutAll = async (req, res) => {
  try {
    const userId = req.user.userId;

    await authService.revokeAllRefreshTokens(userId);

    sendResponse(
      res,
      StatusCodes.OK,
      null,
      "Logged out from all devices successfully"
    );
  } catch (error) {
    logger.error("Logout all error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await authService.getUserById(userId);

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

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
};
