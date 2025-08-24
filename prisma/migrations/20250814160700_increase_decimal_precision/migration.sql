-- Increase decimal precision for credit fields to handle larger IDR amounts
-- DECIMAL(15,2) allows up to 999,999,999,999.99 (nearly 1 trillion IDR)

ALTER TABLE "users" 
ALTER COLUMN "creditBalance" TYPE DECIMAL(15,2),
ALTER COLUMN "totalTopUp" TYPE DECIMAL(15,2),
ALTER COLUMN "totalSpent" TYPE DECIMAL(15,2);

ALTER TABLE "transactions" 
ALTER COLUMN "amount" TYPE DECIMAL(15,2),
ALTER COLUMN "balanceBefore" TYPE DECIMAL(15,2),
ALTER COLUMN "balanceAfter" TYPE DECIMAL(15,2);

ALTER TABLE "service_plans" 
ALTER COLUMN "monthlyPrice" TYPE DECIMAL(15,2);

ALTER TABLE "subscriptions" 
ALTER COLUMN "monthlyPrice" TYPE DECIMAL(15,2),
ALTER COLUMN "lastChargeAmount" TYPE DECIMAL(15,2);