import authService from "../services/auth.service.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return sendResponse(
        res,
        StatusCodes.UNAUTHORIZED,
        null,
        "Access token is required"
      );
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return sendResponse(
      res,
      StatusCodes.FORBIDDEN,
      null,
      "Invalid or expired token"
    );
  }
};

export const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const user = await authService.getUserById(userId);

      if (!roles.includes(user.role)) {
        return sendResponse(
          res,
          StatusCodes.FORBIDDEN,
          null,
          "Access denied. Insufficient permissions."
        );
      }

      next();
    } catch (error) {
      logger.error("Authorization error:", error);
      return sendResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        null,
        "Internal server error"
      );
    }
  };
};
