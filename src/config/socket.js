import { Server } from "socket.io";
import logger from "../utils/logger.js";
import initializeLogController from "../controllers/k8s/log.controller.js";

let io;

/**
 * Initializes the Socket.IO server and attaches controllers.
 * @param {http.Server} server - The HTTP server to attach Socket.IO to.
 * @returns {Server} The configured Socket.IO server instance.
 */
const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Allow all origins for now
      methods: ["GET", "POST"],
    },
  });

  // Initialize all Socket.IO controllers/namespaces
  initializeLogController(io);

  logger.info("Socket.IO server initialized and controllers attached");
  return io;
};

/**
 * Returns the initialized Socket.IO server instance.
 * @returns {Server} The Socket.IO server instance.
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
};

export { initializeSocketIO, getIO };
