/**
 * Simple Import Test for Auto-Renewal System
 * Tests if all new modules can be imported without errors
 */

console.log("🔄 Testing Auto-Renewal System Imports...\n");

async function testImports() {
  const tests = [];

  // Test 1: Billing Service Import
  try {
    const billingService = await import("./src/services/billing.service.js");
    console.log("✅ Billing Service - Import successful");
    console.log("   Available methods:", Object.keys(billingService.default));
    tests.push({ name: "billingService", success: true });
  } catch (error) {
    console.log("❌ Billing Service - Import failed:", error.message);
    tests.push({
      name: "billingService",
      success: false,
      error: error.message,
    });
  }

  // Test 2: Notification Service Import
  try {
    const notificationService = await import(
      "./src/services/notification.service.js"
    );
    console.log("✅ Notification Service - Import successful");
    console.log(
      "   Available methods:",
      Object.keys(notificationService.default)
    );
    tests.push({ name: "notificationService", success: true });
  } catch (error) {
    console.log("❌ Notification Service - Import failed:", error.message);
    tests.push({
      name: "notificationService",
      success: false,
      error: error.message,
    });
  }

  // Test 3: Auto-Renewal Job Import
  try {
    const autoRenewalJob = await import("./src/jobs/auto-renewal.job.js");
    console.log("✅ Auto-Renewal Job - Import successful");
    console.log("   Job scheduler available:", typeof autoRenewalJob.default);
    tests.push({ name: "autoRenewalJob", success: true });
  } catch (error) {
    console.log("❌ Auto-Renewal Job - Import failed:", error.message);
    tests.push({
      name: "autoRenewalJob",
      success: false,
      error: error.message,
    });
  }

  // Test 4: Admin Billing Controller Import
  try {
    const billingController = await import(
      "./src/controllers/admin/billing.controller.js"
    );
    console.log("✅ Admin Billing Controller - Import successful");
    console.log(
      "   Available methods:",
      Object.keys(billingController.default)
    );
    tests.push({ name: "billingController", success: true });
  } catch (error) {
    console.log("❌ Admin Billing Controller - Import failed:", error.message);
    tests.push({
      name: "billingController",
      success: false,
      error: error.message,
    });
  }

  // Test 5: Admin Billing Routes Import
  try {
    const billingRoutes = await import("./src/routes/admin/billing.routes.js");
    console.log("✅ Admin Billing Routes - Import successful");
    tests.push({ name: "billingRoutes", success: true });
  } catch (error) {
    console.log("❌ Admin Billing Routes - Import failed:", error.message);
    tests.push({ name: "billingRoutes", success: false, error: error.message });
  }

  // Test 6: Main App Import (to test integration)
  try {
    const app = await import("./src/app.js");
    console.log(
      "✅ Main App - Import successful (auto-renewal integration works)"
    );
    tests.push({ name: "mainApp", success: true });
  } catch (error) {
    console.log("❌ Main App - Import failed:", error.message);
    tests.push({ name: "mainApp", success: false, error: error.message });
  }

  // Summary
  console.log("\n📊 Test Results Summary:");
  const successful = tests.filter((t) => t.success).length;
  const failed = tests.filter((t) => !t.success).length;

  console.log(`✅ Successful imports: ${successful}/${tests.length}`);
  console.log(`❌ Failed imports: ${failed}/${tests.length}`);

  if (failed > 0) {
    console.log("\n🔍 Failed Import Details:");
    tests
      .filter((t) => !t.success)
      .forEach((test) => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
  }

  if (successful === tests.length) {
    console.log("\n🎉 ALL IMPORTS SUCCESSFUL!");
    console.log("✅ Phase 6: Auto-Renewal System is properly integrated");
    return true;
  } else {
    console.log("\n❌ Some imports failed. Please check the errors above.");
    return false;
  }
}

// Run the test
testImports()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Test runner failed:", error);
    process.exit(1);
  });
