import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedWelcomeBonusCoupons() {
  console.log("🎁 Seeding welcome bonus coupons...");

  try {
    // Create sample welcome bonus coupons
    const welcomeCoupons = [
      {
        code: "WELCOME2025",
        name: "Welcome Bonus 2025",
        description: "Welcome bonus for new users - IDR 20,000 credit",
        type: "WELCOME_BONUS",
        status: "ACTIVE",
        creditAmount: 20000,
        maxUses: 1000, // Allow 1000 users to get this bonus
        usedCount: 0,
        maxUsesPerUser: 1, // One per user
        validFrom: new Date(),
        validUntil: new Date("2025-12-31"), // Valid until end of 2025
        createdBy: "system", // System-created coupon
      },
      {
        code: "NEWUSER5K",
        name: "New User Bonus",
        description: "Additional bonus for new users - IDR 5,000 credit",
        type: "WELCOME_BONUS",
        status: "ACTIVE",
        creditAmount: 5000,
        maxUses: 500, // Limited to 500 users
        usedCount: 0,
        maxUsesPerUser: 1,
        validFrom: new Date(),
        validUntil: new Date("2025-06-30"), // Valid until mid-2025
        createdBy: "system",
      },
      {
        code: "DISABLED_WELCOME",
        name: "Disabled Welcome Bonus",
        description: "Example of disabled welcome bonus",
        type: "WELCOME_BONUS",
        status: "DISABLED", // This won't be applied
        creditAmount: 10000,
        maxUses: 100,
        usedCount: 0,
        maxUsesPerUser: 1,
        validFrom: new Date(),
        validUntil: new Date("2025-12-31"),
        createdBy: "system",
      },
    ];

    // Create welcome bonus coupons
    for (const couponData of welcomeCoupons) {
      const existingCoupon = await prisma.coupon.findUnique({
        where: { code: couponData.code },
      });

      if (!existingCoupon) {
        await prisma.coupon.create({
          data: couponData,
        });
        console.log(
          `✅ Created welcome bonus coupon: ${couponData.code} (${couponData.status})`
        );
      } else {
        console.log(
          `⚠️  Welcome bonus coupon already exists: ${couponData.code}`
        );
      }
    }

    console.log("🎉 Welcome bonus coupons seeded successfully!");
    console.log("");
    console.log("📋 Summary:");
    console.log(
      "- WELCOME2025: IDR 20,000 (Active, 1000 uses, valid until Dec 2025)"
    );
    console.log(
      "- NEWUSER5K: IDR 5,000 (Active, 500 uses, valid until Jun 2025)"
    );
    console.log("- DISABLED_WELCOME: IDR 10,000 (Disabled - won't be applied)");
    console.log("");
    console.log("💡 New users will automatically receive:");
    console.log("   - IDR 20,000 from WELCOME2025");
    console.log("   - IDR 5,000 from NEWUSER5K");
    console.log("   - Total: IDR 25,000 welcome bonus");
    console.log("");
    console.log("🔧 To manage welcome bonuses:");
    console.log("   - Enable/disable via coupon admin endpoints");
    console.log("   - Adjust amounts by updating creditAmount");
    console.log("   - Set expiry dates via validUntil field");
    console.log("   - Control usage limits via maxUses field");
  } catch (error) {
    console.error("❌ Error seeding welcome bonus coupons:", error);
    throw error;
  }
}

async function main() {
  await seedWelcomeBonusCoupons();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
