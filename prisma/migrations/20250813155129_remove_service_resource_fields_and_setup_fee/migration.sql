/*
  Warnings:

  - You are about to drop the column `setupFee` on the `service_plans` table. All the data in the column will be lost.
  - You are about to drop the column `minCpuMilli` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `minMemoryMb` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `minStorageGb` on the `services` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."service_plans" DROP COLUMN "setupFee";

-- AlterTable
ALTER TABLE "public"."services" DROP COLUMN "minCpuMilli",
DROP COLUMN "minMemoryMb",
DROP COLUMN "minStorageGb";
