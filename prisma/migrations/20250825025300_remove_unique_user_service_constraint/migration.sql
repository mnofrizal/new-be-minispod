-- Remove unique constraint on (userId, serviceId) to allow multiple subscriptions per user-service
-- Business logic will enforce "one active subscription per user per service" instead

-- Drop the unique constraint
DROP INDEX IF EXISTS "subscriptions_userId_serviceId_key";

-- Remove the constraint name from the table
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "unique_user_service_subscription";