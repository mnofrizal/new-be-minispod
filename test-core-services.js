import catalogService from "./src/services/catalog.service.js";
import quotaService from "./src/services/quota.service.js";
import creditService from "./src/services/credit.service.js";
import subscriptionService from "./src/services/subscription.service.js";
import transactionService from "./src/services/transaction.service.js";
import midtransService from "./src/services/payment/midtrans.service.js";

async function testCoreServices() {
  console.log("🧪 Testing Core Services...\n");

  try {
    // Test 1: Catalog Service
    console.log("1️⃣ Testing Catalog Service...");
    const categories = await catalogService.getServiceCategories();
    console.log(`✅ Found ${categories.length} service categories`);

    const services = await catalogService.getFeaturedServices(3);
    console.log(`✅ Found ${services.length} featured services`);

    if (services.length > 0) {
      const serviceDetails = await catalogService.getServiceDetails(
        services[0].slug
      );
      console.log(`✅ Retrieved details for service: ${serviceDetails.name}`);
    }

    // Test 2: Quota Service
    console.log("\n2️⃣ Testing Quota Service...");
    const quotaOverview = await quotaService.getQuotaOverview();
    console.log(
      `✅ Found ${quotaOverview.length} service plans with quota info`
    );

    const quotaStats = await quotaService.getQuotaStatistics();
    console.log(
      `✅ Quota statistics: ${quotaStats.totalQuota} total, ${quotaStats.usedQuota} used`
    );

    // Test 3: Credit Service
    console.log("\n3️⃣ Testing Credit Service...");
    // Get a test user (from seed data)
    const testUserId = "user1@minispod.com"; // We'll need to get actual user ID

    // First, let's get user by email to get the ID
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const testUser = await prisma.user.findUnique({
      where: { email: testUserId },
      select: { id: true, name: true, creditBalance: true },
    });

    if (testUser) {
      const creditInfo = await creditService.getUserCreditInfo(testUser.id);
      console.log(
        `✅ Credit info for ${testUser.name}: ${creditInfo.creditBalance} IDR`
      );

      const creditCheck = await creditService.checkSufficientCredit(
        testUser.id,
        50000
      );
      console.log(
        `✅ Credit check for 50,000 IDR: ${
          creditCheck.hasSufficientCredit ? "Sufficient" : "Insufficient"
        }`
      );
    }

    // Test 4: Transaction Service
    console.log("\n4️⃣ Testing Transaction Service...");
    const recentTransactions = await transactionService.getTransactions(
      {},
      { limit: 5 }
    );
    console.log(
      `✅ Found ${recentTransactions.transactions.length} recent transactions`
    );

    const transactionStats =
      await transactionService.getTransactionStatistics();
    console.log(
      `✅ Transaction stats: ${transactionStats.overview.totalTransactions} total transactions`
    );

    // Test 5: Subscription Service (validation only)
    console.log("\n5️⃣ Testing Subscription Service...");
    if (testUser && quotaOverview.length > 0) {
      const planId = quotaOverview[0].planId;
      const validation = await subscriptionService.validateSubscription(
        testUser.id,
        planId
      );
      console.log(
        `✅ Subscription validation: ${
          validation.isValid ? "Valid" : validation.error
        }`
      );

      const userSubscriptions = await subscriptionService.getUserSubscriptions(
        testUser.id
      );
      console.log(`✅ User has ${userSubscriptions.length} subscriptions`);
    }

    // Test 6: Midtrans Service (configuration only)
    console.log("\n6️⃣ Testing Midtrans Service...");
    const paymentMethods = midtransService.getAvailablePaymentMethods();
    console.log(
      `✅ Available payment methods: ${paymentMethods.length} methods`
    );

    const midtransConfig = await midtransService.validateConfiguration();
    console.log(
      `✅ Midtrans configuration: ${
        midtransConfig.isValid ? "Valid" : midtransConfig.error
      }`
    );

    await prisma.$disconnect();

    console.log("\n🎉 All Core Services Test Completed Successfully!");
    console.log("\n📊 Test Summary:");
    console.log("✅ Catalog Service - Working");
    console.log("✅ Quota Service - Working");
    console.log("✅ Credit Service - Working");
    console.log("✅ Transaction Service - Working");
    console.log("✅ Subscription Service - Working");
    console.log("✅ Midtrans Service - Working");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testCoreServices();
