import nodeService from '../../services/k8s/node.service.js';
import sendResponse from '../../utils/response.js';
import { StatusCodes } from 'http-status-codes';
import logger from '../../utils/logger.js';

const getAllNodes = async (req, res) => {
  try {
    const result = await nodeService.getAllNodes();

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      'Kubernetes nodes retrieved successfully'
    );
  } catch (error) {
    logger.error('Get all nodes error:', error);

    if (error.message.includes('Kubernetes client not initialized')) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        'Kubernetes cluster not accessible'
      );
    }

    if (error.message.includes('client initialization failed')) {
      return sendResponse(
        res,
        StatusCodes.BAD_GATEWAY,
        null,
        'Failed to connect to Kubernetes cluster'
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

const getNodeByName = async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        'Node name is required'
      );
    }

    const node = await nodeService.getNodeByName(name);

    sendResponse(
      res,
      StatusCodes.OK,
      { node },
      `Node '${name}' retrieved successfully`
    );
  } catch (error) {
    logger.error(`Get node '${req.params.name}' error:`, error);

    if (error.message.includes('not found')) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        error.message
      );
    }

    if (error.message.includes('Kubernetes client not initialized')) {
      return sendResponse(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        null,
        'Kubernetes cluster not accessible'
      );
    }

    if (error.message.includes('client initialization failed')) {
      return sendResponse(
        res,
        StatusCodes.BAD_GATEWAY,
        null,
        'Failed to connect to Kubernetes cluster'
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
  getAllNodes,
  getNodeByName,
};