import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import billingService from "../../services/billing.service.js";
import notificationService from "../../services/notification.service.js";
import autoRenewalJob from "../../jobs/auto-renewal.job.js";
import logger from "../../utils/logger.js";

// Environment configuration
const GRACE_PERIOD_MIN_DAYS = parseInt(process.env.GRACE_PERIOD_MIN_DAYS) || 1;
const GRACE_PERIOD_MAX_DAYS = parseInt(process.env.GRACE_PERIOD_MAX_DAYS) || 30;

/**
 * Get billing statistics
 * GET /api/admin/billing/stats
 */
const getBillingStats = async (req, res) => {
  try {
    const stats = await billingService.getBillingStats();

    sendResponse(
      res,
      StatusCodes.OK,
      stats,
      "Billing statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Get billing stats error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve billing statistics"
    );
  }
};

/**
 * Process auto-renewals manually
 * POST /api/admin/billing/process-renewals
 */
const processRenewals = async (req, res) => {
  try {
    const results = await billingService.processAutoRenewals();

    sendResponse(
      res,
      StatusCodes.OK,
      results,
      "Auto-renewal processing completed"
    );
  } catch (error) {
    logger.error("Process renewals error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to process renewals"
    );
  }
};

/**
 * Process grace period subscriptions manually
 * POST /api/admin/billing/process-grace-period
 */
const processGracePeriod = async (req, res) => {
  try {
    const results = await billingService.processGracePeriodSubscriptions();

    sendResponse(
      res,
      StatusCodes.OK,
      results,
      "Grace period processing completed"
    );
  } catch (error) {
    logger.error("Process grace period error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to process grace period subscriptions"
    );
  }
};

/**
 * Get low credit subscriptions
 * GET /api/admin/billing/low-credit
 */
const getLowCreditSubscriptions = async (req, res) => {
  try {
    const subscriptions = await billingService.getLowCreditSubscriptions();

    sendResponse(
      res,
      StatusCodes.OK,
      { subscriptions, count: subscriptions.length },
      "Low credit subscriptions retrieved successfully"
    );
  } catch (error) {
    logger.error("Get low credit subscriptions error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve low credit subscriptions"
    );
  }
};

/**
 * Send low credit notifications manually
 * POST /api/admin/billing/send-low-credit-notifications
 */
const sendLowCreditNotifications = async (req, res) => {
  try {
    const subscriptions = await billingService.getLowCreditSubscriptions();
    const results = await notificationService.processLowCreditNotifications(
      subscriptions
    );

    sendResponse(res, StatusCodes.OK, results, "Low credit notifications sent");
  } catch (error) {
    logger.error("Send low credit notifications error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to send low credit notifications"
    );
  }
};

/**
 * Get auto-renewal job status
 * GET /api/admin/billing/job-status
 */
const getJobStatus = async (req, res) => {
  try {
    const status = autoRenewalJob.getStatus();

    sendResponse(
      res,
      StatusCodes.OK,
      status,
      "Job status retrieved successfully"
    );
  } catch (error) {
    logger.error("Get job status error:", error);
    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve job status"
    );
  }
};

/**
 * Run a specific job manually
 * POST /api/admin/billing/run-job/:jobName
 */
const runJob = async (req, res) => {
  try {
    const { jobName } = req.params;

    const validJobs = [
      "daily-renewals",
      "grace-period",
      "low-credit-notifications",
      "grace-period-reminders",
      "billing-stats",
    ];

    if (!validJobs.includes(jobName)) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        `Invalid job name. Valid jobs: ${validJobs.join(", ")}`
      );
    }

    const result = await autoRenewalJob.runJob(jobName);

    sendResponse(
      res,
      StatusCodes.OK,
      result,
      `Job ${jobName} executed successfully`
    );
  } catch (error) {
    logger.error(`Run job error:`, error);

    if (error.message.includes("Unknown job")) {
      return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to run job"
    );
  }
};

/**
 * Set grace period for subscription
 * POST /api/admin/billing/set-grace-period/:subscriptionId
 */
const setGracePeriod = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { graceDays = 7 } = req.body;

    if (
      graceDays < GRACE_PERIOD_MIN_DAYS ||
      graceDays > GRACE_PERIOD_MAX_DAYS
    ) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        `Grace period must be between ${GRACE_PERIOD_MIN_DAYS} and ${GRACE_PERIOD_MAX_DAYS} days`
      );
    }

    const result = await billingService.setGracePeriod(
      subscriptionId,
      graceDays
    );

    sendResponse(
      res,
      StatusCodes.OK,
      { subscription: result },
      `Grace period of ${graceDays} days set successfully`
    );
  } catch (error) {
    logger.error("Set grace period error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to set grace period"
    );
  }
};

/**
 * Expire subscription manually
 * POST /api/admin/billing/expire/:subscriptionId
 */
const expireSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason = "Admin manual expiration" } = req.body;

    const result = await billingService.expireSubscription(subscriptionId);

    // Send expiration notification
    try {
      await notificationService.sendSuspensionNotification({
        ...result,
        user: { id: result.userId },
        service: { name: "Service" }, // This would need to be fetched if needed
        plan: { name: "Plan" },
      });
    } catch (notificationError) {
      logger.warn("Failed to send expiration notification:", notificationError);
    }

    sendResponse(
      res,
      StatusCodes.OK,
      { subscription: result },
      "Subscription expired successfully"
    );
  } catch (error) {
    logger.error("Expire subscription error:", error);

    if (error.message.includes("not found")) {
      return sendResponse(res, StatusCodes.NOT_FOUND, null, error.message);
    }

    sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to expire subscription"
    );
  }
};

export default {
  getBillingStats,
  processRenewals,
  processGracePeriod,
  getLowCreditSubscriptions,
  sendLowCreditNotifications,
  getJobStatus,
  runJob,
  setGracePeriod,
  expireSubscription,
};
