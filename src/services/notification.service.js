import logger from "../utils/logger.js";

/**
 * Send low credit notification to user
 * @param {Object} subscription - Subscription with user, service, and plan data
 * @returns {Promise<Object>} Notification result
 */
const sendLowCreditNotification = async (subscription) => {
  try {
    const { user, service, plan, nextBilling } = subscription;
    const shortfall = plan.monthlyPrice - user.creditBalance;
    const daysUntilBilling = Math.ceil(
      (new Date(nextBilling) - new Date()) / (1000 * 60 * 60 * 24)
    );

    const notificationData = {
      type: "LOW_CREDIT_WARNING",
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      serviceName: service.name,
      planName: plan.name,
      currentBalance: user.creditBalance,
      requiredAmount: plan.monthlyPrice,
      shortfall,
      daysUntilBilling,
      nextBillingDate: nextBilling,
      subscriptionId: subscription.id,
    };

    // Log notification (in production, this would send email/SMS/push notification)
    logger.warn("LOW CREDIT NOTIFICATION", {
      ...notificationData,
      message: `User ${user.email} has insufficient credit (${user.creditBalance} IDR) for upcoming renewal of ${service.name} (${plan.monthlyPrice} IDR required). Renewal due in ${daysUntilBilling} days.`,
    });

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // TODO: Integrate with SMS service (Twilio, etc.)
    // TODO: Integrate with push notification service

    return {
      success: true,
      notificationType: "LOW_CREDIT_WARNING",
      recipient: user.email,
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send low credit notification:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send renewal success notification
 * @param {Object} subscription - Subscription data
 * @param {number} chargedAmount - Amount charged for renewal
 * @returns {Promise<Object>} Notification result
 */
const sendRenewalSuccessNotification = async (subscription, chargedAmount) => {
  try {
    const notificationData = {
      type: "RENEWAL_SUCCESS",
      userId: subscription.userId,
      subscriptionId: subscription.id,
      chargedAmount,
      newEndDate: subscription.endDate,
      nextBillingDate: subscription.nextBilling,
    };

    logger.info("RENEWAL SUCCESS NOTIFICATION", {
      ...notificationData,
      message: `Subscription renewed successfully. Charged ${chargedAmount} IDR. Next billing: ${subscription.nextBilling}`,
    });

    return {
      success: true,
      notificationType: "RENEWAL_SUCCESS",
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send renewal success notification:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send renewal failure notification
 * @param {Object} subscription - Subscription with user data
 * @param {string} reason - Failure reason
 * @param {number} gracePeriodDays - Grace period days
 * @returns {Promise<Object>} Notification result
 */
const sendRenewalFailureNotification = async (
  subscription,
  reason,
  gracePeriodDays = 7
) => {
  try {
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

    const notificationData = {
      type: "RENEWAL_FAILURE",
      userId: subscription.user.id,
      userEmail: subscription.user.email,
      userName: subscription.user.name,
      subscriptionId: subscription.id,
      serviceName: subscription.service.name,
      planName: subscription.plan.name,
      reason,
      gracePeriodDays,
      gracePeriodEnd,
      requiredAmount: subscription.plan.monthlyPrice,
      currentBalance: subscription.user.creditBalance,
    };

    logger.error("RENEWAL FAILURE NOTIFICATION", {
      ...notificationData,
      message: `Renewal failed for ${
        subscription.user.email
      }: ${reason}. Grace period of ${gracePeriodDays} days granted until ${gracePeriodEnd.toISOString()}.`,
    });

    return {
      success: true,
      notificationType: "RENEWAL_FAILURE",
      recipient: subscription.user.email,
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send renewal failure notification:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send subscription suspension notification
 * @param {Object} subscription - Subscription with user data
 * @returns {Promise<Object>} Notification result
 */
const sendSuspensionNotification = async (subscription) => {
  try {
    const notificationData = {
      type: "SUBSCRIPTION_SUSPENDED",
      userId: subscription.user.id,
      userEmail: subscription.user.email,
      userName: subscription.user.name,
      subscriptionId: subscription.id,
      serviceName: subscription.service.name,
      planName: subscription.plan.name,
      suspendedAt: new Date(),
    };

    logger.warn("SUBSCRIPTION SUSPENSION NOTIFICATION", {
      ...notificationData,
      message: `Subscription suspended for ${subscription.user.email} due to insufficient credit after grace period. Service: ${subscription.service.name}`,
    });

    return {
      success: true,
      notificationType: "SUBSCRIPTION_SUSPENDED",
      recipient: subscription.user.email,
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send suspension notification:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send grace period reminder notification
 * @param {Object} subscription - Subscription with user data
 * @param {number} daysRemaining - Days remaining in grace period
 * @returns {Promise<Object>} Notification result
 */
const sendGracePeriodReminder = async (subscription, daysRemaining) => {
  try {
    const notificationData = {
      type: "GRACE_PERIOD_REMINDER",
      userId: subscription.user.id,
      userEmail: subscription.user.email,
      userName: subscription.user.name,
      subscriptionId: subscription.id,
      serviceName: subscription.service.name,
      planName: subscription.plan.name,
      daysRemaining,
      requiredAmount: subscription.plan.monthlyPrice,
      currentBalance: subscription.user.creditBalance,
      shortfall:
        subscription.plan.monthlyPrice - subscription.user.creditBalance,
    };

    logger.warn("GRACE PERIOD REMINDER", {
      ...notificationData,
      message: `Grace period reminder for ${subscription.user.email}: ${daysRemaining} days remaining. Please top up ${notificationData.shortfall} IDR to avoid suspension.`,
    });

    return {
      success: true,
      notificationType: "GRACE_PERIOD_REMINDER",
      recipient: subscription.user.email,
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send grace period reminder:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send batch notification summary to admin
 * @param {Object} results - Billing processing results
 * @returns {Promise<Object>} Notification result
 */
const sendAdminBillingSummary = async (results) => {
  try {
    const notificationData = {
      type: "ADMIN_BILLING_SUMMARY",
      timestamp: new Date(),
      ...results,
    };

    logger.info("ADMIN BILLING SUMMARY", {
      ...notificationData,
      message: `Daily billing summary: ${results.successful}/${results.processed} renewals successful, ${results.failed} failed, ${results.insufficientCredit} insufficient credit cases`,
    });

    return {
      success: true,
      notificationType: "ADMIN_BILLING_SUMMARY",
      data: notificationData,
    };
  } catch (error) {
    logger.error("Failed to send admin billing summary:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Process low credit notifications for subscriptions due soon
 * @param {Array} subscriptions - Array of subscriptions with low credit users
 * @returns {Promise<Object>} Notification processing results
 */
const processLowCreditNotifications = async (subscriptions) => {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  for (const subscription of subscriptions) {
    results.processed++;

    try {
      const result = await sendLowCreditNotification(subscription);
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          subscriptionId: subscription.id,
          userEmail: subscription.user.email,
          error: result.error,
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        subscriptionId: subscription.id,
        userEmail: subscription.user.email,
        error: error.message,
      });
    }
  }

  logger.info(
    `Low credit notifications processed: ${results.successful}/${results.processed} successful`
  );
  return results;
};

export default {
  sendLowCreditNotification,
  sendRenewalSuccessNotification,
  sendRenewalFailureNotification,
  sendSuspensionNotification,
  sendGracePeriodReminder,
  sendAdminBillingSummary,
  processLowCreditNotifications,
};
