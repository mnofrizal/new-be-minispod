import podService from "../../services/k8s/pod.service.js";
import sendResponse from "../../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../../utils/logger.js";

const getAllPods = async (req, res) => {
  try {
    const result = await podService.getAllPods();

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Kubernetes pods retrieved successfully"
    );
  } catch (error) {
    logger.error("Get all pods error:", error);

    if (error.message.includes("Kubernetes client not initialized")) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        "Kubernetes cluster not accessible"
      );
    }

    if (error.message.includes("client initialization failed")) {
      return sendResponse(
        res,
        StatusCodes.BAD_GATEWAY,
        null,
        "Failed to connect to Kubernetes cluster"
      );
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
  getAllPods,
};
