import cron from "node-cron";
import billingService from "../services/billing.service.js";
import notificationService from "../services/notification.service.js";
import logger from "../utils/logger.js";

// Environment configuration for scheduled jobs
const CRON_DAILY_RENEWALS = process.env.CRON_DAILY_RENEWALS || "0 2 * * *";
const CRON_GRACE_PERIOD = process.env.CRON_GRACE_PERIOD || "0 3 * * *";
const CRON_LOW_CREDIT_NOTIFICATIONS =
  process.env.CRON_LOW_CREDIT_NOTIFICATIONS || "0 9 * * *";
const CRON_GRACE_PERIOD_REMINDERS =
  process.env.CRON_GRACE_PERIOD_REMINDERS || "0 18 * * *";
const CRON_BILLING_STATS = process.env.CRON_BILLING_STATS || "0 23 * * *";
const BILLING_TIMEZONE = process.env.BILLING_TIMEZONE || "Asia/Jakarta";
const AUTO_RENEWAL_ENABLED = process.env.AUTO_RENEWAL_ENABLED !== "false";

/**
 * Auto-renewal job scheduler
 * Handles scheduled billing operations and notifications
 */
class AutoRenewalJob {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn("Auto-renewal jobs are already running");
      return;
    }

    logger.info("Starting auto-renewal job scheduler...");

    // Daily auto-renewal processing at 2:00 AM
    this.jobs.set(
      "daily-renewals",
      cron.schedule(
        "0 2 * * *",
        async () => {
          await this.processDailyRenewals();
        },
        {
          scheduled: false,
          timezone: "Asia/Jakarta",
        }
      )
    );

    // Grace period processing at 3:00 AM daily
    this.jobs.set(
      "grace-period",
      cron.schedule(
        "0 3 * * *",
        async () => {
          await this.processGracePeriod();
        },
        {
          scheduled: false,
          timezone: "Asia/Jakarta",
        }
      )
    );

    // Low credit notifications at 9:00 AM daily
    this.jobs.set(
      "low-credit-notifications",
      cron.schedule(
        "0 9 * * *",
        async () => {
          await this.processLowCreditNotifications();
        },
        {
          scheduled: false,
          timezone: "Asia/Jakarta",
        }
      )
    );

    // Grace period reminders at 6:00 PM daily
    this.jobs.set(
      "grace-period-reminders",
      cron.schedule(
        "0 18 * * *",
        async () => {
          await this.processGracePeriodReminders();
        },
        {
          scheduled: false,
          timezone: "Asia/Jakarta",
        }
      )
    );

    // Billing statistics at 11:00 PM daily
    this.jobs.set(
      "billing-stats",
      cron.schedule(
        "0 23 * * *",
        async () => {
          await this.generateBillingStats();
        },
        {
          scheduled: false,
          timezone: "Asia/Jakarta",
        }
      )
    );

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started job: ${name}`);
    });

    this.isRunning = true;
    logger.info("All auto-renewal jobs started successfully");
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("Auto-renewal jobs are not running");
      return;
    }

    logger.info("Stopping auto-renewal job scheduler...");

    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    logger.info("All auto-renewal jobs stopped");
  }

  /**
   * Process daily auto-renewals
   */
  async processDailyRenewals() {
    const startTime = new Date();
    logger.info("Starting daily auto-renewal processing...");

    try {
      const results = await billingService.processAutoRenewals();

      // Send admin summary
      await notificationService.sendAdminBillingSummary(results);

      // Send individual notifications for successful renewals
      if (results.successful > 0) {
        logger.info(`Successfully processed ${results.successful} renewals`);
      }

      // Log failed renewals for investigation
      if (results.failed > 0) {
        logger.error(
          `Failed to process ${results.failed} renewals:`,
          results.errors
        );
      }

      const duration = new Date() - startTime;
      logger.info(`Daily auto-renewal processing completed in ${duration}ms`);

      return results;
    } catch (error) {
      logger.error("Daily auto-renewal processing failed:", error);

      // Send error notification to admin
      await notificationService.sendAdminBillingSummary({
        processed: 0,
        successful: 0,
        failed: 0,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Process subscriptions in grace period
   */
  async processGracePeriod() {
    const startTime = new Date();
    logger.info("Starting grace period processing...");

    try {
      const results = await billingService.processGracePeriodSubscriptions();

      if (results.expired > 0) {
        logger.warn(
          `Expired ${results.expired} subscriptions due to expired grace period`
        );
      }

      if (results.renewed > 0) {
        logger.info(
          `Renewed ${results.renewed} subscriptions during grace period`
        );
      }

      const duration = new Date() - startTime;
      logger.info(`Grace period processing completed in ${duration}ms`);

      return results;
    } catch (error) {
      logger.error("Grace period processing failed:", error);
      throw error;
    }
  }

  /**
   * Process low credit notifications
   */
  async processLowCreditNotifications() {
    const startTime = new Date();
    logger.info("Starting low credit notification processing...");

    try {
      const lowCreditSubscriptions =
        await billingService.getLowCreditSubscriptions();

      if (lowCreditSubscriptions.length === 0) {
        logger.info("No low credit subscriptions found");
        return { processed: 0, successful: 0, failed: 0 };
      }

      const results = await notificationService.processLowCreditNotifications(
        lowCreditSubscriptions
      );

      const duration = new Date() - startTime;
      logger.info(
        `Low credit notification processing completed in ${duration}ms`
      );

      return results;
    } catch (error) {
      logger.error("Low credit notification processing failed:", error);
      throw error;
    }
  }

  /**
   * Process grace period reminders
   */
  async processGracePeriodReminders() {
    const startTime = new Date();
    logger.info("Starting grace period reminder processing...");

    try {
      // Get subscriptions in grace period
      const subscriptionsInGracePeriod =
        await this.getSubscriptionsInGracePeriod();

      if (subscriptionsInGracePeriod.length === 0) {
        logger.info("No subscriptions in grace period found");
        return { processed: 0, successful: 0, failed: 0 };
      }

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (const subscription of subscriptionsInGracePeriod) {
        results.processed++;

        try {
          const daysRemaining = Math.ceil(
            (new Date(subscription.gracePeriodEnd) - new Date()) /
              (1000 * 60 * 60 * 24)
          );

          await notificationService.sendGracePeriodReminder(
            subscription,
            daysRemaining
          );
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            subscriptionId: subscription.id,
            error: error.message,
          });
        }
      }

      const duration = new Date() - startTime;
      logger.info(
        `Grace period reminder processing completed in ${duration}ms`
      );

      return results;
    } catch (error) {
      logger.error("Grace period reminder processing failed:", error);
      throw error;
    }
  }

  /**
   * Generate billing statistics
   */
  async generateBillingStats() {
    const startTime = new Date();
    logger.info("Generating billing statistics...");

    try {
      const stats = await billingService.getBillingStats();

      logger.info("Daily billing statistics:", stats);

      const duration = new Date() - startTime;
      logger.info(`Billing statistics generation completed in ${duration}ms`);

      return stats;
    } catch (error) {
      logger.error("Billing statistics generation failed:", error);
      throw error;
    }
  }

  /**
   * Get subscriptions currently in grace period
   * @returns {Promise<Array>} Subscriptions in grace period
   */
  async getSubscriptionsInGracePeriod() {
    const { default: prisma } = await import("../utils/prisma.js");

    return await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        gracePeriodEnd: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            creditBalance: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        plan: {
          select: {
            name: true,
            monthlyPrice: true,
          },
        },
      },
    });
  }

  /**
   * Run a specific job manually (for testing/debugging)
   * @param {string} jobName - Name of the job to run
   */
  async runJob(jobName) {
    logger.info(`Manually running job: ${jobName}`);

    switch (jobName) {
      case "daily-renewals":
        return await this.processDailyRenewals();
      case "grace-period":
        return await this.processGracePeriod();
      case "low-credit-notifications":
        return await this.processLowCreditNotifications();
      case "grace-period-reminders":
        return await this.processGracePeriodReminders();
      case "billing-stats":
        return await this.generateBillingStats();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size,
    };
  }
}

// Create singleton instance
const autoRenewalJob = new AutoRenewalJob();

export default autoRenewalJob;
