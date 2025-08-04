import { getReasonPhrase } from "http-status-codes";

const sendResponse = (res, statusCode, data = null, message = null) => {
  const success = statusCode >= 200 && statusCode < 300;
  const responseMessage = message || getReasonPhrase(statusCode);

  const response = {
    success,
    statusCode,
    message: responseMessage,
    timestamp: new Date().toISOString(),
  };

  if (data) {
    response.data = data;
  }

  res.status(statusCode).json(response);
};

export default sendResponse;
