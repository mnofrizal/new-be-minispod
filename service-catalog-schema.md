# Complete Prisma Schema - Service Catalog with Quota System

## Complete Schema File

Berikut adalah complete Prisma schema yang menggabungkan existing models dengan service catalog dan quota system:

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// EXISTING MODELS (User Management & Authentication)
// ============================================================================

enum Role {
  ADMINISTRATOR
  USER
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  phone     String?  @unique
  role      Role     @default(USER)
  avatar    String?
  password  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Existing Relations
  refreshTokens RefreshToken[]

  // New Relations - Service Catalog
  subscriptions Subscription[]

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("refresh_tokens")
}

// ============================================================================
// SERVICE CATALOG MODELS
// ============================================================================

// Service Categories (Development Tools, CMS, Analytics, etc.)
model ServiceCategory {
  id          String   @id @default(cuid())
  name        String   @unique // "Development Tools", "CMS", "Analytics"
  slug        String   @unique // "dev-tools", "cms", "analytics"
  description String?
  icon        String?  // URL atau icon identifier
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0) // For display ordering
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  services Service[]

  @@map("service_categories")
}

// Service Templates (N8N, Ghost, etc.)
model Service {
  id          String   @id @default(cuid())
  name        String   // "N8N Automation", "Ghost Blog"
  slug        String   @unique // "n8n-automation", "ghost-blog"
  description String?
  longDescription String? // Detailed description for service page
  icon        String?
  version     String   // "latest", "1.0.0"

  // Kubernetes Configuration
  dockerImage String   // "n8nio/n8n:latest"
  defaultPort Int      @default(3000)

  // Resource Requirements (minimum for any plan)
  minCpuMilli    Int @default(100)  // 0.1 CPU
  minMemoryMb    Int @default(128)  // 128MB RAM
  minStorageGb   Int @default(1)    // 1GB storage

  // Service Configuration
  categoryId     String
  category       ServiceCategory @relation(fields: [categoryId], references: [id])

  // Environment Variables Template
  envTemplate    Json? // Default environment variables as JSON

  // Service Metadata
  tags           String[] // ["automation", "workflow", "integration"]
  documentation  String?  // URL to documentation

  // Service Status
  isActive       Boolean @default(true)
  isPublic       Boolean @default(true) // Visible in public catalog
  isFeatured     Boolean @default(false) // Featured in homepage
  sortOrder      Int     @default(0) // Display order

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  plans          ServicePlan[]
  instances      ServiceInstance[]
  subscriptions  Subscription[]

  @@map("services")
}

// Service Plans with Quota System
enum PlanType {
  FREE
  BASIC
  PRO
  PREMIUM
  ENTERPRISE
}

model ServicePlan {
  id          String   @id @default(cuid())
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  name        String   // "Free", "Basic", "Pro", "Premium"
  planType    PlanType
  description String?

  // Pricing
  monthlyPrice Decimal @db.Decimal(10, 2) // Monthly price in IDR
  setupFee     Decimal @db.Decimal(10, 2) @default(0) // One-time setup fee

  // Resource Allocations
  cpuMilli     Int     // CPU in millicores (1000 = 1 CPU)
  memoryMb     Int     // Memory in MB
  storageGb    Int     // Storage in GB
  bandwidth    Int     @default(0) // Monthly bandwidth in GB (0 = unlimited)

  // SIMPLIFIED QUOTA SYSTEM - Server Resource Management
  totalQuota      Int     // Total available slots for this plan across all users
  usedQuota       Int     @default(0) // Currently used slots
  // availableQuota = totalQuota - usedQuota (calculated in code)

  // Features & Limits
  features     Json?   // Array of features ["custom_domain", "ssl", "backup"]
  maxInstancesPerUser Int @default(1) // Max instances per user for this plan
  maxDomains   Int     @default(1) // Max custom domains

  // Plan Settings
  isActive     Boolean @default(true)
  isPopular    Boolean @default(false) // Mark as "Most Popular"
  sortOrder    Int     @default(0) // Display order

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  subscriptions Subscription[]

  @@unique([serviceId, planType])
  @@map("service_plans")
}

// User Subscriptions with Upgrade System
enum SubscriptionStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
  EXPIRED
  PENDING_UPGRADE
  PENDING_PAYMENT
}

model Subscription {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  serviceId   String   // Reference to the service
  service     Service  @relation(fields: [serviceId], references: [id])

  planId      String
  plan        ServicePlan @relation(fields: [planId], references: [id])

  status      SubscriptionStatus @default(ACTIVE)

  // Billing Information
  startDate   DateTime @default(now())
  endDate     DateTime // Next billing date
  lastBilled  DateTime?
  nextBilling DateTime? // Next scheduled billing

  // Upgrade/Downgrade System
  previousPlanId String? // Track upgrade history
  upgradeDate    DateTime? // When was last upgrade
  downgradeTo    String? // Planned downgrade at end of billing cycle

  // Payment Settings
  autoRenew   Boolean @default(true)

  // Subscription Metadata
  notes       String? // Internal notes

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  instances   ServiceInstance[]

  // BUSINESS RULE: One active subscription per user per service
  @@unique([userId, serviceId], name: "unique_user_service_subscription")
  @@map("subscriptions")
}

// Active Service Instances (Running Pods)
enum InstanceStatus {
  PENDING
  PROVISIONING
  RUNNING
  STOPPED
  ERROR
  TERMINATED
  MAINTENANCE
}

model ServiceInstance {
  id             String   @id @default(cuid())
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  serviceId      String
  service        Service @relation(fields: [serviceId], references: [id])

  // Instance Configuration
  name           String   // User-defined name
  subdomain      String   @unique // "myapp.minispod.com"

  // Kubernetes Information
  namespace      String   // K8s namespace (usually user-specific)
  podName        String?  // Actual pod name in K8s
  serviceName    String?  // K8s service name
  ingressName    String?  // K8s ingress name
  deploymentName String?  // K8s deployment name

  // Instance Status & Health
  status         InstanceStatus @default(PENDING)
  healthStatus   String?  // "healthy", "unhealthy", "unknown"
  lastHealthCheck DateTime?

  // Configuration
  envVars        Json?    // Environment variables as JSON
  customDomain   String?  // Custom domain if configured
  sslEnabled     Boolean  @default(false)

  // Resource Usage (cached from K8s metrics)
  cpuUsage       Decimal? @db.Decimal(5, 2) // Current CPU usage %
  memoryUsage    Decimal? @db.Decimal(8, 2) // Current memory usage MB
  storageUsage   Decimal? @db.Decimal(8, 2) // Current storage usage GB

  // Instance Metadata
  publicUrl      String?  // Full public URL
  adminUrl       String?  // Admin panel URL if applicable

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastStarted    DateTime?
  lastStopped    DateTime?

  @@map("service_instances")
}

// SIMPLIFIED QUOTA MANAGEMENT
// Quota tracking is handled directly in ServicePlan model
// with simple totalQuota and usedQuota fields
// No audit trail needed for MVP - can be added later if required

// ============================================================================
// INDEXES FOR PERFORMANCE
// ============================================================================

// Add indexes for frequently queried fields
// These would be added as separate migration files

/*
-- Performance indexes to be added:

-- Service catalog queries
CREATE INDEX idx_services_category_active ON services(category_id, is_active, is_public);
CREATE INDEX idx_services_featured ON services(is_featured, sort_order) WHERE is_active = true;

-- Subscription queries
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_billing ON subscriptions(next_billing) WHERE status = 'ACTIVE';

-- Instance monitoring
CREATE INDEX idx_instances_status ON service_instances(status);
CREATE INDEX idx_instances_health ON service_instances(last_health_check) WHERE status = 'RUNNING';

-- Simplified quota management
CREATE INDEX idx_service_plans_quota ON service_plans(used_quota, total_quota) WHERE is_active = true;
*/
```

## Key Schema Features

### 1. **Simplified Quota Management System**

- `totalQuota`: Maximum slots available for each plan
- `usedQuota`: Currently allocated slots
- `availableQuota`: Calculated as (totalQuota - usedQuota)

### 2. **Upgrade-Only Policy**

- Unique constraint: `@@unique([userId, serviceId])` pada Subscription
- `previousPlanId` untuk tracking upgrade history
- `downgradeTo` untuk scheduled downgrades

### 3. **Resource Management**

- Detailed resource allocation per plan (CPU, Memory, Storage, Bandwidth)
- Real-time usage tracking in ServiceInstance
- Kubernetes integration fields

### 4. **Simplified Tracking**

- Basic quota tracking in ServicePlan model
- Transaction records for billing audit
- Can add detailed quota logging later if needed

### 5. **Business Logic Support**

- Service categorization dan featured items
- Plan popularity marking
- Instance health monitoring
- Custom domain support

## Migration Strategy

1. **Phase 1**: Add service catalog tables
2. **Phase 2**: Add simplified quota system
3. **Phase 3**: Add performance indexes
4. **Phase 4**: Add advanced features (quota logging, etc.) if needed

## Next Steps

1. Implement API endpoints untuk service catalog management
2. Create simplified quota management service layer
3. Build upgrade/downgrade logic
4. Implement Kubernetes provisioning integration
5. Add quota audit logging later if business requires it
