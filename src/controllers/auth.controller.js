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

    await authService.logout(refreshToken);

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

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    const result = await authService.googleLogin(idToken);

    // Use simplified response format without message
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Google login error:", error);

    if (
      error.message === "Invalid Google token" ||
      error.message === "Account is deactivated. Please contact administrator."
    ) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: error.message,
      });
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const linkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { idToken } = req.body;

    const result = await authService.linkGoogleAccount(userId, idToken);

    sendResponse(
      res,
      StatusCodes.OK,
      { user: result },
      "Google account linked successfully"
    );
  } catch (error) {
    logger.error("Link Google account error:", error);

    if (
      error.message === "Invalid Google token" ||
      error.message ===
        "This Google account is already linked to another user" ||
      error.message ===
        "Google account email does not match your account email" ||
      error.message === "User not found"
    ) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Internal server error"
    );
  }
};

const unlinkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await authService.unlinkGoogleAccount(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { user: result },
    });
  } catch (error) {
    logger.error("Unlink Google account error:", error);

    if (
      error.message === "User not found" ||
      error.message === "No Google account linked to this user" ||
      error.message.includes("Cannot unlink Google account")
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: error.message,
      });
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
  googleLogin,
  linkGoogleAccount,
  unlinkGoogleAccount,
};
