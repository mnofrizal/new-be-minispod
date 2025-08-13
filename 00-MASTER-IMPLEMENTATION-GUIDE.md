# 🚀 MASTER IMPLEMENTATION GUIDE

## Service Catalog dengan Credit-Based Billing System

> **PANDUAN UTAMA**: File ini adalah satu-satunya panduan yang perlu Anda ikuti untuk implementasi lengkap service catalog dengan quota system dan credit-based billing.

---

## 📋 OVERVIEW

Implementasi service catalog untuk PaaS platform MinisPod dengan fitur:

- ✅ **Service Catalog**: Katalog layanan (N8N, Ghost, dll) dengan multiple plans
- ✅ **Quota System**: Pembatasan resource server dengan real-time tracking
- ✅ **Credit-Based Billing**: User top-up credit, auto-debit untuk subscription
- ✅ **Upgrade-Only Policy**: User hanya bisa upgrade, tidak bisa beli service yang sama
- ✅ **Kubernetes Integration**: Auto-provisioning service ke K8s cluster

---

## 🔄 BUSINESS WORKFLOWS

### **1. NEW SUBSCRIPTION WORKFLOW**

```mermaid
graph TD
    A[User Selects Service Plan] --> B{Check Existing Subscription}
    B -->|Has Active Subscription| C[Show Upgrade Option]
    B -->|No Subscription| D{Check Credit Balance}

    D -->|Insufficient Credit| E[Redirect to Top-Up]
    D -->|Sufficient Credit| F{Check Quota Availability}

    F -->|No Quota| G[Show Waitlist/Notification]
    F -->|Quota Available| H[Allocate Quota]

    H --> I[Deduct Credit from Balance]
    I --> J[Create Subscription Record]
    J --> K[Start Kubernetes Provisioning]
    L --> M[Create Service Instance]
    M --> N[Update Instance Status RUNNING]

    E --> O[Top-Up Process]
    O --> D
```

**Key Steps:**

1. **Validation**: Check existing subscription (upgrade-only policy)
2. **Credit Check**: Ensure sufficient balance
3. **Quota Check**: Verify server capacity
4. **Payment**: Deduct credit from user balance
5. **Provisioning**: Create K8s resources
6. **Activation**: Update instance status

### **2. UPGRADE SUBSCRIPTION WORKFLOW**

```mermaid
graph TD
    A[User Requests Upgrade] --> B{Validate Upgrade Path}
    B -->|Invalid| C[Show Error - Must be Higher Tier]
    B -->|Valid| D{Check Credit Balance}

    D -->|Insufficient| E[Show Required Amount]
    D -->|Sufficient| F{Check New Plan Quota}

    F -->|No Quota| G[Show Waitlist Option]
    F -->|Quota Available| H[Calculate Prorated Amount]

    H --> I[Deduct Upgrade Cost]
    I --> J[Update Kubernetes Resources]
    J -->|Success| K[Release Old Quota]
    K --> L[Allocate New Quota]
    L --> M[Update Subscription Plan]
    M --> N[Create Transaction Record]

    J -->|Failed| O[Rollback Process]
    O --> P[Refund Deducted Credit]
```

**Key Features:**

- **Plan Hierarchy**: Only allow upgrades to higher tiers
- **Prorated Billing**: Calculate cost difference
- **Resource Updates**: Seamlessly update K8s resources
- **Rollback**: Handle failures gracefully

### **3. CREDIT TOP-UP WORKFLOW**

```mermaid
graph TD
    A[User Requests Top-Up] --> B[Select Amount & Payment Method]
    B --> C{Payment Method}

    C -->|Bank Transfer/E-Wallet/Credit Card| D[Create Midtrans Transaction]
    C -->|QRIS| E[Generate QRIS Code]

    D --> F[Redirect to Midtrans Payment Page]
    F --> G[User Completes Payment]
    G --> H[Midtrans Webhook Notification]

    E --> I[User Scans QRIS Code]
    I --> J[Payment Completed]
    J --> H

    H -->|Success| K[Credit User Account]
    H -->|Failed| L[Show Error Message]

    I --> M[Create Transaction Record]
    M --> N[Update User Balance]
    N --> O[Send Confirmation]
```

**Payment Methods (via Midtrans):**

- **Bank Transfer**: BCA, BNI, BRI, Mandiri via Midtrans
- **E-Wallet**: GoPay, OVO, DANA, LinkAja via Midtrans
- **Credit Card**: Visa, Mastercard via Midtrans
- **QRIS**: Quick Response Indonesian Standard

### **4. AUTO-RENEWAL WORKFLOW**

```mermaid
graph TD
    A[Billing Job Scheduled] --> B[Check Subscription Status]
    B -->|Inactive| C[Skip Renewal]
    B -->|Active| D{Check Credit Balance}

    D -->|Sufficient| E[Deduct Monthly Fee]
    D -->|Insufficient| F[Start Grace Period]

    E --> G[Extend Subscription Period]
    G --> H[Create Transaction Record]
    H --> I[Schedule Next Billing]

    F --> J[Notify User - Low Credit]
    J --> K[Set Grace Period End Date]
    K --> L{Grace Period Check}

    L -->|Credit Added| M[Retry Auto-Renewal]
    L -->|Still Insufficient| N[Suspend Service]

    M --> D
    N --> O[Update Instance Status SUSPENDED]
    O --> P[Release Quota]
```

**Grace Period Features:**

- **7 Days Grace**: Service continues running
- **Daily Notifications**: Remind user to top-up
- **Auto-Retry**: Check credit daily during grace period
- **Suspension**: Suspend service after grace period

### **5. KUBERNETES PROVISIONING WORKFLOW**

```mermaid
graph TD
    A[Subscription Created] --> B[Generate Instance Config]
    B --> C[Create User Namespace]
    C --> D[Generate Unique Subdomain]
    D --> E[Create ConfigMap/Secrets]
    E --> F[Create PVC for Storage]
    F --> G[Create Deployment]
    G --> H[Create Service]
    H --> I[Create Ingress]
    I --> J[Wait for Pod Ready]

    J -->|Ready| K[Update Instance Status RUNNING]
    J -->|Failed| L[Update Instance Status ERROR]
    J -->|Timeout 5min| M[Update Instance Status ERROR]

    K --> N[Setup Health Monitoring]
    K --> O[Send Success Notification]

    L --> P[Log Error Details]
    M --> P
    P --> Q[Cleanup Partial Resources]
    Q --> R[Release Allocated Quota]
    R --> S[Refund User Credit]
```

**Kubernetes Resources Created:**

- **Namespace**: `user-{userId}`
- **Deployment**: With resource limits from plan
- **Service**: Internal cluster networking
- **Ingress**: External access with SSL
- **PVC**: Persistent storage
- **ConfigMap**: Environment variables

### **6. SIMPLIFIED QUOTA MANAGEMENT WORKFLOW**

```mermaid
graph TD
    A[Quota Operation Request] --> B{Operation Type}

    B -->|Allocate| C[Check Available Quota]
    B -->|Release| D[Return Quota to Available]

    C -->|Available| E[Increment Used Quota]
    C -->|Not Available| F[Return Error]

    E --> G[Update Plan Quotas]
    G --> H[Return Success]

    D --> I[Decrement Used Quota]
    I --> G
```

**Simplified Quota States:**

- **Total**: Maximum capacity per plan
- **Used**: Currently allocated to running services
- **Available**: Calculated as (Total - Used)

---

## 🎯 IMPLEMENTATION ROADMAP (8 WEEKS)

### **PHASE 1: DATABASE & CORE MODELS** (Week 1-2)

**Priority: CRITICAL - Mulai dari sini!**

#### 1.1 Update Database Schema (3-4 hari)

**File yang dimodifikasi:**

- `prisma/schema.prisma` - Update dengan schema lengkap di bawah

**Complete Prisma Schema:**

```prisma
// This is your Prisma schema file
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// EXISTING MODELS (Keep as is)
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

  // EXISTING RELATIONS
  refreshTokens RefreshToken[]

  // NEW RELATIONS - Service Catalog & Credit System
  creditBalance    Decimal @default(0) @db.Decimal(12, 2) // Credit balance in IDR
  totalTopUp       Decimal @default(0) @db.Decimal(12, 2) // Total lifetime top-up
  totalSpent       Decimal @default(0) @db.Decimal(12, 2) // Total lifetime spending

  subscriptions    Subscription[]
  transactions     Transaction[]

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

// Service Categories (Development Tools, CMS, etc.)
model ServiceCategory {
  id          String   @id @default(cuid())
  name        String   @unique // "Development Tools", "CMS"
  slug        String   @unique // "dev-tools", "cms"
  description String?
  sortOrder   Int      @default(0)
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
  longDescription String?
  icon        String?
  version     String   // "latest", "1.0.0"

  // Kubernetes Configuration
  dockerImage String   // "n8nio/n8n:latest"
  defaultPort Int      @default(3000)

  // Resource Requirements (minimum)
  minCpuMilli    Int @default(100)  // 0.1 CPU
  minMemoryMb    Int @default(128)  // 128MB RAM
  minStorageGb   Int @default(1)    // 1GB storage

  categoryId     String
  category       ServiceCategory @relation(fields: [categoryId], references: [id])

  envTemplate    Json? // Default environment variables
  tags           String[] // ["automation", "workflow"]
  documentation  String?

  isActive       Boolean @default(true)
  isPublic       Boolean @default(true)
  isFeatured     Boolean @default(false)
  sortOrder      Int     @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  plans          ServicePlan[]
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

  name        String   // "Free", "Basic", "Pro"
  planType    PlanType
  description String?

  // Pricing
  monthlyPrice Decimal @db.Decimal(10, 2) // Monthly price in IDR
  setupFee     Decimal @db.Decimal(10, 2) @default(0)

  // Resource Allocations
  cpuMilli     Int     // CPU in millicores
  memoryMb     Int     // Memory in MB
  storageGb    Int     // Storage in GB
  bandwidth    Int     @default(0) // Monthly bandwidth in GB

  // SIMPLIFIED QUOTA SYSTEM - Server Resource Management
  totalQuota      Int     // Total available slots
  usedQuota       Int     @default(0) // Currently used slots
  // availableQuota = totalQuota - usedQuota (calculated in code)

  features     Json?   // Array of features
  maxInstancesPerUser Int @default(1)
  maxDomains   Int     @default(1)

  isActive     Boolean @default(true)
  isPopular    Boolean @default(false)
  sortOrder    Int     @default(0)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptions Subscription[]

  @@unique([serviceId, planType])
  @@map("service_plans")
}

// ============================================================================
// SUBSCRIPTION & BILLING MODELS
// ============================================================================

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

  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])

  planId      String
  plan        ServicePlan @relation(fields: [planId], references: [id])

  status      SubscriptionStatus @default(ACTIVE)

  // Billing Information
  startDate   DateTime @default(now())
  endDate     DateTime // Next billing date
  lastBilled  DateTime?
  nextBilling DateTime?

  // Credit-based Billing
  monthlyPrice    Decimal @db.Decimal(10, 2) // Cached price
  lastChargeAmount Decimal? @db.Decimal(10, 2)
  failedCharges   Int @default(0)

  // Upgrade System
  previousPlanId String?
  upgradeDate    DateTime?
  downgradeTo    String?

  autoRenew   Boolean @default(true)
  gracePeriodEnd DateTime? // When service will be suspended

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  instances   ServiceInstance[]
  transactions Transaction[]

  // BUSINESS RULE: One active subscription per user per service
  @@unique([userId, serviceId], name: "unique_user_service_subscription")
  @@map("subscriptions")
}

// ============================================================================
// CREDIT & TRANSACTION SYSTEM
// ============================================================================

enum TransactionType {
  TOP_UP          // User top-up credit
  SUBSCRIPTION    // Monthly subscription charge
  UPGRADE         // Upgrade cost difference
  REFUND          // Refund from cancellation
  ADMIN_ADJUSTMENT // Manual admin adjustment
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
  REFUNDED
}

enum PaymentMethod {
  MIDTRANS_BANK_TRANSFER  // BCA, BNI, BRI, Mandiri
  MIDTRANS_E_WALLET      // GoPay, OVO, DANA, LinkAja
  MIDTRANS_CREDIT_CARD   // Visa, Mastercard
  MIDTRANS_QRIS          // QRIS payment
  ADMIN_MANUAL           // Manual admin adjustment
}

model Transaction {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  type            TransactionType
  status          TransactionStatus @default(PENDING)
  amount          Decimal           @db.Decimal(12, 2) // Amount in IDR

  // Balance Information
  balanceBefore   Decimal           @db.Decimal(12, 2)
  balanceAfter    Decimal           @db.Decimal(12, 2)

  // Payment Information
  paymentMethod   PaymentMethod?
  paymentReference String?
  paymentProof    String?

  subscriptionId  String?
  subscription    Subscription?     @relation(fields: [subscriptionId], references: [id])

  description     String
  metadata        Json?

  processedBy     String?
  adminNotes      String?

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  completedAt     DateTime?

  @@map("transactions")
}

// ============================================================================
// SERVICE INSTANCES & KUBERNETES
// ============================================================================

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

  // NOTE: Service information is accessed via subscription.plan.service
  // This creates a cleaner architecture where instances belong only to subscriptions

  // Instance Configuration
  name           String
  subdomain      String   @unique // "myapp.minispod.com"

  // Kubernetes Information
  namespace      String   // K8s namespace
  podName        String?
  serviceName    String?
  ingressName    String?
  deploymentName String?

  status         InstanceStatus @default(PENDING)
  healthStatus   String?
  lastHealthCheck DateTime?

  envVars        Json?
  customDomain   String?
  sslEnabled     Boolean  @default(false)

  // Resource Usage (cached from K8s)
  cpuUsage       Decimal? @db.Decimal(5, 2)
  memoryUsage    Decimal? @db.Decimal(8, 2)
  storageUsage   Decimal? @db.Decimal(8, 2)

  publicUrl      String?
  adminUrl       String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastStarted    DateTime?
  lastStopped    DateTime?

  @@map("service_instances")
}

// ============================================================================
// QUOTA MANAGEMENT - SIMPLIFIED (No QuotaLog needed for MVP)
// ============================================================================
// Quota tracking is handled directly in ServicePlan model
// with simple totalQuota and usedQuota fields
```

## 🏗️ SCHEMA DESIGN RATIONALE

### **Improved ServiceInstance Relationship**

The schema has been designed with **ServiceInstance belonging only to Subscription** for the following benefits:

#### **Cleaner Architecture**

```
User → Subscription → ServiceInstance
       ↓
       ServicePlan → Service
```

#### **Business Logic Benefits**

- ✅ **Single Source of Truth**: Instance lifecycle follows subscription lifecycle
- ✅ **Proper Cascading**: When subscription cancelled → instances automatically terminated
- ✅ **Quota Management**: Easier to enforce "max instances per subscription" limits
- ✅ **Billing Clarity**: One subscription = one billing entity, multiple instances possible

#### **Data Access Pattern**

```javascript
// Get service information from instance
const instance = await prisma.serviceInstance.findUnique({
  where: { id: instanceId },
  include: {
    subscription: {
      include: {
        plan: {
          include: {
            service: true,
          },
        },
      },
    },
  },
});

// Access service data via: instance.subscription.plan.service
const serviceName = instance.subscription.plan.service.name;
const dockerImage = instance.subscription.plan.service.dockerImage;
```

#### **Why This Design is Better**

- **No Dual Relationships**: Eliminates confusion between Service and Subscription
- **Consistent Hierarchy**: Clear parent-child relationships
- **Easier Queries**: Single path to get all related data
- **Better Performance**: Fewer joins needed for common operations

**Tasks:**

1. Backup existing database
2. Update `prisma/schema.prisma` dengan schema di atas
3. Generate migration: `npx prisma migrate dev --name add-service-catalog`
4. Update seed data: `prisma/seed.js`
5. Add Midtrans environment variables to `.env`

#### 1.3 Environment Configuration (1 hari)

**Update `.env` file:**

```bash
# Existing environment variables
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/new_minispod"

# JWT Configuration
JWT_SECRET="paas-jwt-secret-key-change-this-in-production-2024"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="paas-refresh-secret-key-change-this-in-production-2024"
JWT_REFRESH_EXPIRES_IN="7d"

# Midtrans Payment Gateway Configuration
MIDTRANS_SERVER_KEY="SB-Mid-server-2fQ1vz6SeSDnB9NB17QliwmU"
MIDTRANS_CLIENT_KEY="SB-Mid-client-zDyzjzIdYjGL1P0G"
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_NOTIFICATION_URL="http://localhost:3000/api/webhooks/midtrans/notification"
MIDTRANS_FINISH_URL="http://localhost:3000/payment/success"
MIDTRANS_UNFINISH_URL="http://localhost:3000/payment/pending"
MIDTRANS_ERROR_URL="http://localhost:3000/payment/error"
```

**Install Midtrans SDK:**

```bash
npm install midtrans-client
```

#### 1.4 Core Service Layer (2-3 hari)

**Files to create:**

```
src/services/
├── catalog.service.js      # Service catalog business logic
├── quota.service.js        # Simplified quota management
├── credit.service.js       # Credit & wallet management
├── subscription.service.js # Subscription logic
├── transaction.service.js  # Transaction handling
└── payment/
    └── midtrans.service.js # Midtrans payment integration
```

**Additional config files:**

```
src/config/
└── midtrans.js            # Midtrans configuration
```

**Key functions to implement:**

```javascript
// catalog.service.js
-getServiceCategories() -
  getServicesByCategory() -
  getServiceDetails() -
  searchServices() -
  // quota.service.js (simplified)
  checkQuotaAvailability() -
  allocateQuota() -
  releaseQuota() -
  // credit.service.js
  checkSufficientCredit() -
  deductCredit() -
  addCredit() -
  getTransactionHistory() -
  // subscription.service.js
  createSubscription() -
  validateSubscription() -
  processUpgrade();
```

---

### **PHASE 2: PUBLIC CATALOG API** (Week 2-3)

**Priority: HIGH**

#### 2.1 Public Catalog Endpoints (3-4 hari)

**Files to create:**

```
src/controllers/catalog.controller.js
src/routes/catalog.routes.js
src/validations/catalog.validation.js
rest/catalog.rest
```

**API Endpoints:**

```http
GET /api/catalog/categories
GET /api/catalog/categories/:categorySlug/services
GET /api/catalog/services/:serviceSlug
GET /api/catalog/search
```

#### 2.2 Wallet Management API (2-3 hari)

**Files to create:**

```
src/controllers/user/wallet.controller.js
src/routes/user/wallet.routes.js
src/validations/wallet.validation.js
rest/user/wallet.rest
```

**API Endpoints:**

```http
GET /api/user/wallet
POST /api/user/wallet/topup
POST /api/user/wallet/topup/:transactionId/proof
GET /api/user/wallet/transactions
```

---

### **PHASE 3: SUBSCRIPTION SYSTEM** (Week 3-4)

**Priority: CRITICAL**

#### 3.1 Credit-Based Subscription (4-5 hari)

**Files to create:**

```
src/controllers/user/subscription.controller.js
src/routes/user/subscription.routes.js
src/validations/subscription.validation.js
rest/user/subscriptions.rest
```

**Core Features:**

- Credit validation before subscription
- Duplicate subscription detection (upgrade-only policy)
- Quota allocation
- Transaction recording

**API Endpoints:**

```http
GET /api/user/services/subscriptions
POST /api/user/services/subscribe
PUT /api/user/services/subscriptions/:id/upgrade
DELETE /api/user/services/subscriptions/:id
```

#### 3.2 Instance Management (2-3 hari)

**Files to create:**

```
src/controllers/user/instance.controller.js
src/routes/user/instance.routes.js
rest/user/instances.rest
```

---

### **PHASE 4: KUBERNETES INTEGRATION** (Week 4-6)

**Priority: CRITICAL**

#### 4.1 Basic Provisioning (5-6 hari)

**Files to create:**

```
src/services/k8s/provisioning.service.js
src/config/k8s-templates.js
src/utils/k8s-helper.js
```

**Integration:**

- Extend existing `src/config/kubernetes.js`
- Use existing K8s monitoring services
- Create user namespaces
- Deploy services with resource limits

#### 4.2 Resource Management (3-4 hari)

**Features:**

- Dynamic resource scaling
- Storage management
- Health monitoring integration

---

### **PHASE 5: AUTO-RENEWAL SYSTEM** (Week 6-7)

**Priority: HIGH**

#### 5.1 Billing Job Scheduler (4-5 hari)

**Files to create:**

```
src/services/billing.service.js
src/jobs/auto-renewal.job.js
src/services/notification.service.js
```

**Features:**

- Scheduled auto-renewal jobs
- Credit deduction for renewals
- Grace period management
- Low credit notifications

#### 5.2 Upgrade System (2-3 hari)

**Features:**

- Plan upgrade validation
- Prorated billing
- Kubernetes resource updates
- Quota management

---

### **PHASE 6: ADMIN & ANALYTICS** (Week 7-8)

**Priority: MEDIUM**

#### 6.1 Admin Management (3-4 hari)

**Files to create:**

```
src/controllers/admin/service.controller.js
src/controllers/admin/quota.controller.js (simplified)
src/controllers/admin/wallet.controller.js
src/routes/admin/service.routes.js
rest/admin/services.rest
```

#### 6.2 Analytics & Reporting (2-3 hari)

**Features:**

- Revenue tracking
- Quota utilization reports
- User analytics

---

## 🛠️ DEVELOPMENT GUIDELINES

### File Structure

```
src/
├── controllers/
│   ├── catalog.controller.js
│   ├── admin/
│   │   ├── service.controller.js
│   │   ├── quota.controller.js (simplified)
│   │   └── wallet.controller.js
│   └── user/
│       ├── wallet.controller.js
│       ├── subscription.controller.js
│       └── instance.controller.js
├── services/
│   ├── catalog.service.js
│   ├── quota.service.js (simplified)
│   ├── credit.service.js
│   ├── subscription.service.js
│   ├── billing.service.js
│   └── k8s/
│       └── provisioning.service.js
├── routes/
│   ├── catalog.routes.js
│   ├── admin/
│   │   └── service.routes.js
│   └── user/
│       ├── wallet.routes.js
│       └── subscription.routes.js
├── validations/
│   ├── catalog.validation.js
│   ├── wallet.validation.js
│   └── subscription.validation.js
└── jobs/
    └── auto-renewal.job.js
```

### Error Handling

```javascript
const ERROR_CODES = {
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  INSUFFICIENT_CREDIT: "INSUFFICIENT_CREDIT",
  DUPLICATE_SUBSCRIPTION: "DUPLICATE_SUBSCRIPTION",
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  PROVISIONING_FAILED: "PROVISIONING_FAILED",
};
```

### Testing Strategy

- Unit tests untuk semua service functions
- Integration tests untuk API endpoints
- E2E tests untuk critical workflows
- Load testing untuk quota system

---

## 🚀 QUICK START

### Step 1: Database Setup

```bash
# Update schema
npx prisma migrate dev --name add-service-catalog

# Generate client
npx prisma generate

# Seed data
npm run db:seed
```

### Step 2: Start Implementation

1. **Week 1**: Mulai dengan Phase 1 - Database & Core Models
2. **Week 2**: Phase 2 - Public Catalog API
3. **Week 3**: Phase 3 - Subscription System
4. **Continue**: Follow roadmap sequentially

### Step 3: Testing

```bash
# Run tests
npm test

# Test API endpoints
# Use .rest files in rest/ directory
```

---

## 📊 SUCCESS METRICS

### Technical

- API response time < 200ms
- 99.9% uptime
- Minimal quota conflicts
- < 5 minute provisioning time

### Business

- Successful subscription rate
- Credit top-up conversion
- User retention rate
- Revenue growth

---

## ⚠️ IMPORTANT NOTES

1. **Start with Phase 1** - Database schema adalah foundation
2. **Test setiap phase** sebelum lanjut ke phase berikutnya
3. **Credit system** adalah core feature - implement dengan hati-hati
4. **Quota management** menggunakan database transactions untuk consistency
5. **Kubernetes integration** perlu testing di cluster yang sebenarnya

---

## 📞 NEXT STEPS

1. **Review roadmap ini** dan pastikan sesuai dengan kebutuhan
2. **Setup development environment** (database, K8s cluster)
3. **Mulai Phase 1** - Database schema implementation
4. **Follow roadmap step by step** - jangan skip phase

---

## 💼 BUSINESS LOGIC IMPLEMENTATION

### **Midtrans Payment Service**

```javascript
// src/config/midtrans.js
const midtransClient = require("midtrans-client");

const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

module.exports = { snap, coreApi };
```

```javascript
// src/services/payment/midtrans.service.js
const { snap, coreApi } = require("../../config/midtrans");
const prisma = require("../../utils/prisma");

class MidtransService {
  async createTopUpTransaction(userId, amount, paymentMethod) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Create transaction record first
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: "TOP_UP",
        status: "PENDING",
        amount,
        balanceBefore: user.creditBalance,
        balanceAfter: user.creditBalance, // Will be updated after payment
        description: `Top-up credit via ${paymentMethod}`,
        paymentMethod: `MIDTRANS_${paymentMethod.toUpperCase()}`,
        paymentReference: null, // Will be set after Midtrans response
      },
    });

    // Prepare Midtrans transaction
    const parameter = {
      transaction_details: {
        order_id: transaction.id,
        gross_amount: amount,
      },
      customer_details: {
        first_name: user.name,
        email: user.email,
        phone: user.phone,
      },
      item_details: [
        {
          id: "topup-credit",
          price: amount,
          quantity: 1,
          name: "Credit Top-Up",
        },
      ],
      callbacks: {
        finish: process.env.MIDTRANS_FINISH_URL,
        unfinish: process.env.MIDTRANS_UNFINISH_URL,
        error: process.env.MIDTRANS_ERROR_URL,
      },
    };

    // Create Snap transaction
    const snapTransaction = await snap.createTransaction(parameter);

    // Update transaction with Midtrans reference
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentReference: snapTransaction.token,
        metadata: {
          midtrans_redirect_url: snapTransaction.redirect_url,
          midtrans_token: snapTransaction.token,
        },
      },
    });

    return {
      transactionId: transaction.id,
      snapToken: snapTransaction.token,
      redirectUrl: snapTransaction.redirect_url,
    };
  }

  async handleNotification(notification) {
    try {
      const statusResponse = await coreApi.transaction.notification(
        notification
      );

      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      const transaction = await prisma.transaction.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      let newStatus = "PENDING";
      let shouldCreditAccount = false;

      if (transactionStatus === "capture") {
        if (fraudStatus === "challenge") {
          newStatus = "PENDING";
        } else if (fraudStatus === "accept") {
          newStatus = "COMPLETED";
          shouldCreditAccount = true;
        }
      } else if (transactionStatus === "settlement") {
        newStatus = "COMPLETED";
        shouldCreditAccount = true;
      } else if (
        transactionStatus === "cancel" ||
        transactionStatus === "deny" ||
        transactionStatus === "expire"
      ) {
        newStatus = "FAILED";
      } else if (transactionStatus === "pending") {
        newStatus = "PENDING";
      }

      // Update transaction status
      await prisma.transaction.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          completedAt: shouldCreditAccount ? new Date() : null,
          metadata: {
            ...transaction.metadata,
            midtrans_status: transactionStatus,
            midtrans_fraud_status: fraudStatus,
            midtrans_payment_type: statusResponse.payment_type,
            midtrans_transaction_time: statusResponse.transaction_time,
          },
        },
      });

      // Credit user account if payment successful
      if (shouldCreditAccount) {
        await prisma.user.update({
          where: { id: transaction.userId },
          data: {
            creditBalance: { increment: transaction.amount },
            totalTopUp: { increment: transaction.amount },
          },
        });

        // Update transaction with new balance
        const updatedUser = await prisma.user.findUnique({
          where: { id: transaction.userId },
        });

        await prisma.transaction.update({
          where: { id: orderId },
          data: {
            balanceAfter: updatedUser.creditBalance,
          },
        });
      }

      return { success: true, status: newStatus };
    } catch (error) {
      console.error("Midtrans notification error:", error);
      throw error;
    }
  }

  async checkTransactionStatus(transactionId) {
    try {
      const statusResponse = await coreApi.transaction.status(transactionId);
      return statusResponse;
    } catch (error) {
      console.error("Check transaction status error:", error);
      throw error;
    }
  }
}

module.exports = new MidtransService();
```

### **Webhook Controller for Midtrans**

```javascript
// src/controllers/webhook/midtrans.controller.js
const midtransService = require("../../services/payment/midtrans.service");
const { successResponse, errorResponse } = require("../../utils/response");

class MidtransWebhookController {
  async handleNotification(req, res) {
    try {
      const notification = req.body;

      const result = await midtransService.handleNotification(notification);

      return successResponse(
        res,
        result,
        "Notification processed successfully"
      );
    } catch (error) {
      console.error("Midtrans webhook error:", error);
      return errorResponse(res, "Failed to process notification", 500);
    }
  }
}

module.exports = new MidtransWebhookController();
```

### **Wallet Controller with Midtrans Integration**

```javascript
// src/controllers/user/wallet.controller.js
const midtransService = require("../../services/payment/midtrans.service");
const { successResponse, errorResponse } = require("../../utils/response");

class WalletController {
  async createTopUp(req, res) {
    try {
      const { amount, paymentMethod } = req.body;
      const userId = req.user.id;

      // Validate amount (minimum 10,000 IDR)
      if (amount < 10000) {
        return errorResponse(res, "Minimum top-up amount is Rp 10,000", 400);
      }

      // Create Midtrans transaction
      const result = await midtransService.createTopUpTransaction(
        userId,
        amount,
        paymentMethod
      );

      return successResponse(
        res,
        result,
        "Top-up transaction created successfully"
      );
    } catch (error) {
      console.error("Create top-up error:", error);
      return errorResponse(res, "Failed to create top-up transaction", 500);
    }
  }

  async getWalletBalance(req, res) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          totalTopUp: true,
          totalSpent: true,
        },
      });

      return successResponse(
        res,
        user,
        "Wallet balance retrieved successfully"
      );
    } catch (error) {
      console.error("Get wallet balance error:", error);
      return errorResponse(res, "Failed to get wallet balance", 500);
    }
  }
}

module.exports = new WalletController();
```

### **Routes for Midtrans Integration**

```javascript
// src/routes/webhook/midtrans.routes.js
const express = require("express");
const midtransController = require("../../controllers/webhook/midtrans.controller");

const router = express.Router();

router.post("/notification", midtransController.handleNotification);

module.exports = router;
```

```javascript
// src/routes/user/wallet.routes.js
const express = require("express");
const walletController = require("../../controllers/user/wallet.controller");
const auth = require("../../middleware/auth");

const router = express.Router();

router.use(auth.verifyToken);

router.get("/", walletController.getWalletBalance);
router.post("/topup", walletController.createTopUp);

module.exports = router;
```

### **Update Main Routes**

```javascript
// Add to src/routes/index.routes.js
const midtransWebhookRoutes = require("./webhook/midtrans.routes");
const walletRoutes = require("./user/wallet.routes");

// Add these routes
app.use("/api/webhooks/midtrans", midtransWebhookRoutes);
app.use("/api/user/wallet", walletRoutes);
```

---

## 🚨 MIDTRANS INTEGRATION CHECKLIST

### **Phase 2 Additional Tasks**

- [ ] Install midtrans-client package
- [ ] Create Midtrans configuration file
- [ ] Implement MidtransService class
- [ ] Create webhook controller for notifications
- [ ] Update wallet controller with Midtrans integration
- [ ] Add webhook routes
- [ ] Test Midtrans sandbox integration
- [ ] Implement transaction status checking

### **Testing Midtrans Integration**

```javascript
// rest/user/wallet-midtrans.rest
### Get wallet balance
GET http://localhost:3000/api/user/wallet
Authorization: Bearer {{jwt_token}}

### Create top-up transaction
POST http://localhost:3000/api/user/wallet/topup
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "amount": 50000,
  "paymentMethod": "CREDIT_CARD"
}

### Midtrans webhook simulation (for testing)
POST http://localhost:3000/api/webhooks/midtrans/notification
Content-Type: application/json

{
  "transaction_time": "2024-01-15 10:30:00",
  "transaction_status": "settlement",
  "transaction_id": "test-transaction-123",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "test-signature",
  "payment_type": "credit_card",
  "order_id": "transaction-id-from-database",
  "merchant_id": "test-merchant",
  "gross_amount": "50000.00",
  "fraud_status": "accept",
  "currency": "IDR"
}
```

**File ini adalah satu-satunya panduan yang Anda butuhkan. Ikuti secara sequential dari Phase 1 sampai Phase 6.**
