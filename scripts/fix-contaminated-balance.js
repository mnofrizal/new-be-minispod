import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixContaminatedBalances() {
  console.log("🔍 Checking for contaminated balance data...");

  try {
    // Get all users with potentially contaminated balances
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        totalTopUp: true,
        totalSpent: true,
      },
    });

    console.log(`📊 Found ${users.length} users to check`);

    let fixedCount = 0;
    const fixes = [];

    for (const user of users) {
      let needsFix = false;
      const originalBalance = user.creditBalance;
      const originalTopUp = user.totalTopUp;
      const originalSpent = user.totalSpent;

      // Convert Decimal to string to check for contamination
      const balanceStr = originalBalance?.toString() || "0";
      const topUpStr = originalTopUp?.toString() || "0";
      const spentStr = originalSpent?.toString() || "0";

      // Check if values are contaminated (contain dots indicating decimal concatenation)
      const isBalanceContaminated =
        balanceStr.includes(".") && balanceStr.split(".").length > 2;
      const isTopUpContaminated =
        topUpStr.includes(".") && topUpStr.split(".").length > 2;
      const isSpentContaminated =
        spentStr.includes(".") && spentStr.split(".").length > 2;

      let fixedBalance = originalBalance;
      let fixedTopUp = originalTopUp;
      let fixedSpent = originalSpent;

      if (isBalanceContaminated) {
        // Extract the first valid number before contamination
        const parts = balanceStr.split(".");
        fixedBalance = parseInt(parts[0]) || 0;
        needsFix = true;
      }

      if (isTopUpContaminated) {
        const parts = topUpStr.split(".");
        fixedTopUp = parseInt(parts[0]) || 0;
        needsFix = true;
      }

      if (isSpentContaminated) {
        const parts = spentStr.split(".");
        fixedSpent = parseInt(parts[0]) || 0;
        needsFix = true;
      }

      // Also check for values that are too large for integer (> 2,147,483,647)
      const MAX_INT = 2147483647;
      if (Number(originalBalance) > MAX_INT) {
        fixedBalance = Math.min(Number(originalBalance), MAX_INT);
        needsFix = true;
      }
      if (Number(originalTopUp) > MAX_INT) {
        fixedTopUp = Math.min(Number(originalTopUp), MAX_INT);
        needsFix = true;
      }
      if (Number(originalSpent) > MAX_INT) {
        fixedSpent = Math.min(Number(originalSpent), MAX_INT);
        needsFix = true;
      }

      if (needsFix) {
        fixes.push({
          userId: user.id,
          email: user.email,
          original: {
            balance: balanceStr,
            topUp: topUpStr,
            spent: spentStr,
          },
          fixed: {
            balance: fixedBalance,
            topUp: fixedTopUp,
            spent: fixedSpent,
          },
        });

        console.log(`🔧 Fixing user ${user.email}:`);
        console.log(`   Balance: ${balanceStr} → ${fixedBalance}`);
        console.log(`   TopUp: ${topUpStr} → ${fixedTopUp}`);
        console.log(`   Spent: ${spentStr} → ${fixedSpent}`);

        fixedCount++;
      }
    }

    if (fixes.length === 0) {
      console.log("✅ No contaminated data found!");
      return;
    }

    console.log(`\n🚨 Found ${fixes.length} users with contaminated data`);
    console.log("📝 Fixes to be applied:");
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix.email}`);
      console.log(`   Balance: ${fix.original.balance} → ${fix.fixed.balance}`);
      console.log(`   TopUp: ${fix.original.topUp} → ${fix.fixed.topUp}`);
      console.log(`   Spent: ${fix.original.spent} → ${fix.fixed.spent}`);
    });

    // Apply fixes in a transaction
    console.log("\n🔄 Applying fixes...");
    await prisma.$transaction(async (tx) => {
      for (const fix of fixes) {
        await tx.user.update({
          where: { id: fix.userId },
          data: {
            creditBalance: fix.fixed.balance,
            totalTopUp: fix.fixed.topUp,
            totalSpent: fix.fixed.spent,
          },
        });
      }
    });

    console.log(`✅ Successfully fixed ${fixedCount} users!`);

    // Also check and fix transactions
    console.log("\n🔍 Checking transactions...");
    const transactions = await prisma.transaction.findMany({
      select: {
        id: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
      },
    });

    const transactionFixes = [];
    for (const transaction of transactions) {
      let needsFix = false;
      const MAX_INT = 2147483647;

      let fixedAmount = transaction.amount;
      let fixedBalanceBefore = transaction.balanceBefore;
      let fixedBalanceAfter = transaction.balanceAfter;

      if (Number(transaction.amount) > MAX_INT) {
        fixedAmount = Math.min(Number(transaction.amount), MAX_INT);
        needsFix = true;
      }
      if (Number(transaction.balanceBefore) > MAX_INT) {
        fixedBalanceBefore = Math.min(
          Number(transaction.balanceBefore),
          MAX_INT
        );
        needsFix = true;
      }
      if (Number(transaction.balanceAfter) > MAX_INT) {
        fixedBalanceAfter = Math.min(Number(transaction.balanceAfter), MAX_INT);
        needsFix = true;
      }

      if (needsFix) {
        transactionFixes.push({
          id: transaction.id,
          original: {
            amount: transaction.amount,
            balanceBefore: transaction.balanceBefore,
            balanceAfter: transaction.balanceAfter,
          },
          fixed: {
            amount: fixedAmount,
            balanceBefore: fixedBalanceBefore,
            balanceAfter: fixedBalanceAfter,
          },
        });
      }
    }

    if (transactionFixes.length > 0) {
      console.log(`🔧 Fixing ${transactionFixes.length} transactions...`);
      await prisma.$transaction(async (tx) => {
        for (const fix of transactionFixes) {
          await tx.transaction.update({
            where: { id: fix.id },
            data: {
              amount: fix.fixed.amount,
              balanceBefore: fix.fixed.balanceBefore,
              balanceAfter: fix.fixed.balanceAfter,
            },
          });
        }
      });
      console.log(`✅ Fixed ${transactionFixes.length} transactions!`);
    } else {
      console.log("✅ No transaction fixes needed!");
    }
  } catch (error) {
    console.error("❌ Error fixing contaminated balances:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixContaminatedBalances()
  .then(() => {
    console.log("\n🎉 Data cleanup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Data cleanup failed:", error);
    process.exit(1);
  });
