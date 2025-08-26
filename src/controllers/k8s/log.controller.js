import jwt from "jsonwebtoken";
import logService from "../../services/k8s/log.service.js";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";

const initializeLogController = (io) => {
  const logNamespace = io.of("/k8s-logs");

  // Middleware for JWT authentication
  logNamespace.use(async (socket, next) => {
    const { token, subscriptionId } = socket.handshake.auth;

    if (!token || !subscriptionId) {
      return next(
        new Error(
          "Authentication error: Token or Subscription ID not provided."
        )
      );
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found."));
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId: user.id,
        },
      });

      if (!subscription) {
        return next(
          new Error(
            "Authorization error: Subscription does not belong to user."
          )
        );
      }

      socket.user = user;
      socket.subscriptionId = subscriptionId;
      next();
    } catch (err) {
      logger.warn(`Socket Auth Error: ${err.message}`);
      return next(new Error("Authentication error: Invalid token."));
    }
  });

  logNamespace.on("connection", (socket) => {
    logger.info(
      `Client connected to logs: ${socket.id} for user ${socket.user.id} and subscription ${socket.subscriptionId}`
    );

    // Start streaming logs
    logService.streamLogs(socket, socket.subscriptionId);

    socket.on("disconnect", () => {
      logger.info(`Client disconnected from logs: ${socket.id}`);
    });
  });
};

export default initializeLogController;
