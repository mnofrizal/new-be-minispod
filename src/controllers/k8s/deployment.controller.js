import deploymentService from "../../services/k8s/deployment.service.js";
import sendResponse from "../../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../../utils/logger.js";

const getAllDeployments = async (req, res) => {
  try {
    const result = await deploymentService.getAllDeployments();

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      "Kubernetes deployments retrieved successfully"
    );
  } catch (error) {
    logger.error("Get all deployments error:", error);

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
  getAllDeployments,
};
