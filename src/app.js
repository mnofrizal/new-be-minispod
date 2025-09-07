import express from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import { initializeSocketIO } from "./config/socket.js";

// Import routes
import routes from "./routes/index.routes.js";

// Import health monitoring service
import healthService from "./services/k8s/health.service.js";
import autoRenewalJob from "./jobs/auto-renewal.job.js";
import logger from "./utils/logger.js";

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocketIO(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Routes
app.use("/api", routes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

// Start health monitoring for service instances
let healthMonitoringInterval = null;
if (process.env.NODE_ENV !== "test") {
  // Start health monitoring after a short delay to allow server to fully start
  setTimeout(() => {
    try {
      healthMonitoringInterval = healthService.startHealthMonitoring(
        5 * 60 * 1000
      ); // 5 minutes
      logger.info("Health monitoring service started");
    } catch (error) {
      logger.warn("Failed to start health monitoring:", error.message);
    }
  }, 10000); // 10 second delay

  // Start auto-renewal job scheduler after health monitoring
  setTimeout(() => {
    try {
      autoRenewalJob.start();
      logger.info("Auto-renewal job scheduler started");
    } catch (error) {
      logger.warn("Failed to start auto-renewal jobs:", error.message);
    }
  }, 15000); // 15 second delay
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  if (healthMonitoringInterval) {
    clearInterval(healthMonitoringInterval);
    logger.info("Health monitoring stopped");
  }
  try {
    autoRenewalJob.stop();
    logger.info("Auto-renewal jobs stopped");
  } catch (error) {
    logger.warn("Error stopping auto-renewal jobs:", error.message);
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  if (healthMonitoringInterval) {
    clearInterval(healthMonitoringInterval);
    logger.info("Health monitoring stopped");
  }
  try {
    autoRenewalJob.stop();
    logger.info("Auto-renewal jobs stopped");
  } catch (error) {
    logger.warn("Error stopping auto-renewal jobs:", error.message);
  }
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  logger.info(`MinisPod Backend API with Socket.IO started on port ${PORT}`);
});

export { app, server };
