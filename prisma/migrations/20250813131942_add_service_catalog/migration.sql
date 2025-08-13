-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('FREE', 'BASIC', 'PRO', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'PENDING_UPGRADE', 'PENDING_PAYMENT');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('TOP_UP', 'SUBSCRIPTION', 'UPGRADE', 'REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('MIDTRANS_BANK_TRANSFER', 'MIDTRANS_E_WALLET', 'MIDTRANS_CREDIT_CARD', 'MIDTRANS_QRIS', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "public"."InstanceStatus" AS ENUM ('PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'ERROR', 'TERMINATED', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "creditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTopUp" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."service_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "longDescription" TEXT,
    "icon" TEXT,
    "version" TEXT NOT NULL,
    "dockerImage" TEXT NOT NULL,
    "defaultPort" INTEGER NOT NULL DEFAULT 3000,
    "minCpuMilli" INTEGER NOT NULL DEFAULT 100,
    "minMemoryMb" INTEGER NOT NULL DEFAULT 128,
    "minStorageGb" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT NOT NULL,
    "envTemplate" JSONB,
    "tags" TEXT[],
    "documentation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_plans" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" "public"."PlanType" NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "setupFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cpuMilli" INTEGER NOT NULL,
    "memoryMb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "bandwidth" INTEGER NOT NULL DEFAULT 0,
    "totalQuota" INTEGER NOT NULL,
    "usedQuota" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB,
    "maxInstancesPerUser" INTEGER NOT NULL DEFAULT 1,
    "maxDomains" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lastBilled" TIMESTAMP(3),
    "nextBilling" TIMESTAMP(3),
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "lastChargeAmount" DECIMAL(10,2),
    "failedCharges" INTEGER NOT NULL DEFAULT 0,
    "previousPlanId" TEXT,
    "upgradeDate" TIMESTAMP(3),
    "downgradeTo" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "gracePeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "public"."PaymentMethod",
    "paymentReference" TEXT,
    "paymentProof" TEXT,
    "subscriptionId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "processedBy" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_instances" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "podName" TEXT,
    "serviceName" TEXT,
    "ingressName" TEXT,
    "deploymentName" TEXT,
    "status" "public"."InstanceStatus" NOT NULL DEFAULT 'PENDING',
    "healthStatus" TEXT,
    "lastHealthCheck" TIMESTAMP(3),
    "envVars" JSONB,
    "customDomain" TEXT,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cpuUsage" DECIMAL(5,2),
    "memoryUsage" DECIMAL(8,2),
    "storageUsage" DECIMAL(8,2),
    "publicUrl" TEXT,
    "adminUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastStarted" TIMESTAMP(3),
    "lastStopped" TIMESTAMP(3),

    CONSTRAINT "service_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_name_key" ON "public"."service_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "public"."service_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "public"."services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_plans_serviceId_planType_key" ON "public"."service_plans"("serviceId", "planType");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_serviceId_key" ON "public"."subscriptions"("userId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "service_instances_subdomain_key" ON "public"."service_instances"("subdomain");

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_plans" ADD CONSTRAINT "service_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."service_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_instances" ADD CONSTRAINT "service_instances_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
