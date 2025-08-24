-- Change all currency fields from DECIMAL to INTEGER for IDR
-- IDR doesn't use decimal places (no cents), so INTEGER is more appropriate

-- First, convert existing decimal values to integers (multiply by 100 to preserve precision if any)
-- Then change column types to INTEGER

-- Update User table
ALTER TABLE "users" 
  ALTER COLUMN "creditBalance" TYPE INTEGER USING (ROUND("creditBalance")::INTEGER),
  ALTER COLUMN "totalTopUp" TYPE INTEGER USING (ROUND("totalTopUp")::INTEGER),
  ALTER COLUMN "totalSpent" TYPE INTEGER USING (ROUND("totalSpent")::INTEGER);

-- Update ServicePlan table  
ALTER TABLE "service_plans"
  ALTER COLUMN "monthlyPrice" TYPE INTEGER USING (ROUND("monthlyPrice")::INTEGER);

-- Update Subscription table
ALTER TABLE "subscriptions"
  ALTER COLUMN "monthlyPrice" TYPE INTEGER USING (ROUND("monthlyPrice")::INTEGER),
  ALTER COLUMN "lastChargeAmount" TYPE INTEGER USING (ROUND("lastChargeAmount")::INTEGER);

-- Update Transaction table
ALTER TABLE "transactions"
  ALTER COLUMN "amount" TYPE INTEGER USING (ROUND("amount")::INTEGER),
  ALTER COLUMN "balanceBefore" TYPE INTEGER USING (ROUND("balanceBefore")::INTEGER),
  ALTER COLUMN "balanceAfter" TYPE INTEGER USING (ROUND("balanceAfter")::INTEGER);