import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedCoupons() {
  console.log("🎫 Seeding coupon data...");

  try {
    // Get existing services for coupon restrictions
    const services = await prisma.service.findMany({
      select: { id: true, name: true, slug: true },
    });

    const n8nService = services.find((s) => s.slug === "n8n-automation");
    const ghostService = services.find((s) => s.slug === "ghost-blog");

    // Create sample coupons
    const coupons = [
      // Credit Top-up Coupons (for billing page)
      {
        code: "WELCOME50K",
        name: "Welcome Bonus 50K",
        description: "50,000 IDR credit for new users",
        type: "CREDIT_TOPUP",
        creditAmount: 50000,
        maxUses: 100,
        maxUsesPerUser: 1,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed", // Will be updated with actual admin ID
      },
      {
        code: "TOPUP25K",
        name: "Top-up Bonus 25K",
        description: "25,000 IDR credit bonus",
        type: "CREDIT_TOPUP",
        creditAmount: 25000,
        maxUses: 200,
        maxUsesPerUser: 2,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed",
      },

      // Subscription Discount Coupons (for checkout page)
      {
        code: "SAVE20",
        name: "Save 20%",
        description: "20% discount on any subscription",
        type: "SUBSCRIPTION_DISCOUNT",
        discountType: "PERCENTAGE",
        discountPercent: 20,
        maxUses: 100,
        maxUsesPerUser: 1,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed",
      },
      {
        code: "SAVE30K",
        name: "Save 30K",
        description: "30,000 IDR discount on any subscription",
        type: "SUBSCRIPTION_DISCOUNT",
        discountType: "FIXED_AMOUNT",
        creditAmount: 30000,
        maxUses: 50,
        maxUsesPerUser: 1,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed",
      },
      {
        code: "FIRSTSUB10",
        name: "First Subscription 10% Off",
        description: "10% discount for first-time subscribers",
        type: "SUBSCRIPTION_DISCOUNT",
        discountType: "PERCENTAGE",
        discountPercent: 10,
        maxUses: 500,
        maxUsesPerUser: 1,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed",
      },

      // Service-Specific Discount Coupons
      ...(n8nService
        ? [
            {
              code: "N8NSAVE30",
              name: "N8N 30% Off",
              description: "30% discount on N8N automation service",
              type: "SUBSCRIPTION_DISCOUNT",
              discountType: "PERCENTAGE",
              discountPercent: 30,
              serviceId: n8nService.id,
              planType: "PRO",
              maxUses: 25,
              maxUsesPerUser: 1,
              validUntil: new Date("2024-12-31T23:59:59.000Z"),
              createdBy: "admin-seed",
            },
          ]
        : []),

      // Free Service Coupons
      ...(ghostService
        ? [
            {
              code: "FREEGHOST",
              name: "Free Ghost Blog",
              description: "Free Ghost blog service for 1 month",
              type: "FREE_SERVICE",
              serviceId: ghostService.id,
              maxUses: 20,
              maxUsesPerUser: 1,
              validUntil: new Date("2024-12-31T23:59:59.000Z"),
              createdBy: "admin-seed",
            },
          ]
        : []),

      ...(n8nService
        ? [
            {
              code: "FREEN8N",
              name: "Free N8N Trial",
              description: "Free N8N automation service for 1 month",
              type: "FREE_SERVICE",
              serviceId: n8nService.id,
              planType: "BASIC",
              maxUses: 15,
              maxUsesPerUser: 1,
              validUntil: new Date("2024-12-31T23:59:59.000Z"),
              createdBy: "admin-seed",
            },
          ]
        : []),

      // Limited Time Offers
      {
        code: "BLACKFRIDAY50",
        name: "Black Friday 50% Off",
        description: "Black Friday special - 50% discount on all subscriptions",
        type: "SUBSCRIPTION_DISCOUNT",
        discountType: "PERCENTAGE",
        discountPercent: 50,
        maxUses: 1000,
        maxUsesPerUser: 1,
        validFrom: new Date("2024-11-25T00:00:00.000Z"),
        validUntil: new Date("2024-11-30T23:59:59.000Z"),
        createdBy: "admin-seed",
      },

      // High-Value Credit Coupons
      {
        code: "MEGA100K",
        name: "Mega Credit 100K",
        description: "100,000 IDR credit bonus - limited time",
        type: "CREDIT_TOPUP",
        creditAmount: 100000,
        maxUses: 10,
        maxUsesPerUser: 1,
        validUntil: new Date("2024-12-31T23:59:59.000Z"),
        createdBy: "admin-seed",
      },
    ];

    // Get admin user for createdBy field
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMINISTRATOR" },
      select: { id: true },
    });

    if (adminUser) {
      // Update createdBy field with actual admin ID
      coupons.forEach((coupon) => {
        coupon.createdBy = adminUser.id;
      });
    }

    // Create coupons
    for (const couponData of coupons) {
      try {
        const coupon = await prisma.coupon.create({
          data: couponData,
        });
        console.log(`✅ Created coupon: ${coupon.code} (${coupon.type})`);
      } catch (error) {
        if (error.code === "P2002") {
          console.log(
            `⚠️  Coupon ${couponData.code} already exists, skipping...`
          );
        } else {
          console.error(
            `❌ Failed to create coupon ${couponData.code}:`,
            error.message
          );
        }
      }
    }

    console.log("🎫 Coupon seeding completed!");

    // Display summary
    const couponStats = await prisma.coupon.groupBy({
      by: ["type"],
      _count: { id: true },
    });

    console.log("\n📊 Coupon Summary:");
    couponStats.forEach((stat) => {
      console.log(`   ${stat.type}: ${stat._count.id} coupons`);
    });

    const totalCoupons = await prisma.coupon.count();
    console.log(`   Total: ${totalCoupons} coupons\n`);
  } catch (error) {
    console.error("❌ Error seeding coupons:", error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCoupons()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export default seedCoupons;
