# System Architecture

## Overall Architecture

The backend follows a **layered architecture** pattern with clear separation of concerns:

```
┌─────────────────┐
│   REST API      │ ← Express.js routes
├─────────────────┤
│  Controllers    │ ← Request handling & validation
├─────────────────┤
│   Services      │ ← Business logic
├─────────────────┤
│  Data Access    │ ← Prisma ORM
├─────────────────┤
│   Database      │ ← PostgreSQL
└─────────────────┘
```

## Source Code Structure

### Core Application Files

- [`src/app.js`](src/app.js:1) - Main Express application setup and middleware
- [`src/routes/index.routes.js`](src/routes/index.routes.js:1) - Central route aggregation

### Authentication & User Management

- [`src/controllers/auth.controller.js`](src/controllers/auth.controller.js:1) - Authentication endpoints
- [`src/services/auth.service.js`](src/services/auth.service.js:1) - Auth business logic and JWT handling
- [`src/middleware/auth.js`](src/middleware/auth.js:1) - JWT verification and role-based authorization
- [`src/validations/auth.validation.js`](src/validations/auth.validation.js:1) - Joi validation schemas

### Service Catalog & Business Logic

- [`src/controllers/catalog.controller.js`](src/controllers/catalog.controller.js:1) - Public catalog browsing endpoints
- [`src/services/catalog.service.js`](src/services/catalog.service.js:1) - Service catalog management and browsing
- [`src/services/quota.service.js`](src/services/quota.service.js:1) - Simplified quota management system
- [`src/services/credit.service.js`](src/services/credit.service.js:1) - Credit balance and wallet management
- [`src/services/subscription.service.js`](src/services/subscription.service.js:1) - Subscription lifecycle management
- [`src/services/transaction.service.js`](src/services/transaction.service.js:1) - Transaction handling and reporting
- [`src/services/payment/midtrans.service.js`](src/services/payment/midtrans.service.js:1) - Midtrans payment integration

### Wallet Management System

- [`src/controllers/wallet.controller.js`](src/controllers/wallet.controller.js:1) - Complete wallet management with 12 endpoints (added coupon functionality)
- [`src/routes/wallet.routes.js`](src/routes/wallet.routes.js:1) - JWT-authenticated wallet routes with coupon endpoints
- [`src/validations/wallet.validation.js`](src/validations/wallet.validation.js:1) - Comprehensive Joi validation schemas

### Coupon/Code Redemption System

- [`src/controllers/admin/coupon.controller.js`](src/controllers/admin/coupon.controller.js:1) - Admin coupon management with 7 endpoints
- [`src/routes/admin/coupon.routes.js`](src/routes/admin/coupon.routes.js:1) - ADMINISTRATOR role-protected coupon routes
- [`src/services/coupon.service.js`](src/services/coupon.service.js:1) - Complete coupon business logic with 3 redemption types
- [`src/validations/coupon.validation.js`](src/validations/coupon.validation.js:1) - Comprehensive coupon validation schemas
- [`rest/coupon.rest`](rest/coupon.rest:1) - Complete test suite with 35 test scenarios
- [`prisma/seed-coupons.js`](prisma/seed-coupons.js:1) - Sample coupon data for testing

### Subscription Management System

- [`src/controllers/subscription.controller.js`](src/controllers/subscription.controller.js:1) - User subscription management with 7 endpoints (added auto-renew toggle)
- [`src/controllers/admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:1) - Admin subscription management with 9 endpoints (added update endpoint)
- [`src/routes/subscription.routes.js`](src/routes/subscription.routes.js:1) - JWT-authenticated user subscription routes
- [`src/routes/admin/subscription.routes.js`](src/routes/admin/subscription.routes.js:1) - ADMINISTRATOR role-protected admin routes
- [`src/validations/subscription.validation.js`](src/validations/subscription.validation.js:1) - User subscription validation schemas (added auto-renew validation)
- [`src/validations/admin/subscription.validation.js`](src/validations/admin/subscription.validation.js:1) - Admin subscription validation schemas (added update validation)

### Payment Integration

- [`src/config/midtrans.js`](src/config/midtrans.js:1) - Midtrans payment gateway configuration

### Kubernetes Integration

- [`src/config/kubernetes.js`](src/config/kubernetes.js:1) - K8s client initialization and management
- [`src/controllers/k8s/`](src/controllers/k8s/) - K8s resource controllers (pods, deployments, nodes, namespaces, ingresses, services)
- [`src/services/k8s/`](src/services/k8s/) - K8s business logic, metrics collection, network monitoring, and service provisioning
- [`src/utils/k8s-helper.js`](src/utils/k8s-helper.js:1) - Core Kubernetes API operations and utilities
- [`src/config/k8s-templates.js`](src/config/k8s-templates.js:1) - Kubernetes manifest generation and templates

### Service Provisioning & Instance Management

- [`src/controllers/instance.controller.js`](src/controllers/instance.controller.js:1) - Service instance lifecycle management with 6 endpoints
- [`src/routes/instance.routes.js`](src/routes/instance.routes.js:1) - JWT-authenticated instance management routes
- [`src/validations/instance.validation.js`](src/validations/instance.validation.js:1) - Instance management validation schemas
- [`src/services/k8s/provisioning.service.js`](src/services/k8s/provisioning.service.js:1) - Automated Kubernetes service deployment
- [`src/services/k8s/health.service.js`](src/services/k8s/health.service.js:1) - Real-time service health monitoring
- [`src/controllers/admin/health.controller.js`](src/controllers/admin/health.controller.js:1) - Admin health monitoring endpoints

### Auto-Renewal & Billing System

- [`src/services/billing.service.js`](src/services/billing.service.js:1) - Complete auto-renewal logic with grace period management
- [`src/services/notification.service.js`](src/services/notification.service.js:1) - Comprehensive notification system for billing alerts
- [`src/jobs/auto-renewal.job.js`](src/jobs/auto-renewal.job.js:1) - Scheduled job management with 5 cron jobs
- [`src/controllers/admin/billing.controller.js`](src/controllers/admin/billing.controller.js:1) - Admin billing management with 9 endpoints
- [`src/routes/admin/billing.routes.js`](src/routes/admin/billing.routes.js:1) - Admin billing routes with environment-based validation

### Support Ticket System

- [`src/controllers/ticket.controller.js`](src/controllers/ticket.controller.js:1) - User ticket management with 7 endpoints (create, list, view, message, close, stats, download)
- [`src/controllers/admin/ticket.controller.js`](src/controllers/admin/ticket.controller.js:1) - Admin ticket management with 8 endpoints (full lifecycle management and bulk operations)
- [`src/routes/ticket.routes.js`](src/routes/ticket.routes.js:1) - JWT-authenticated user ticket routes with multipart/form-data support
- [`src/routes/admin/ticket.routes.js`](src/routes/admin/ticket.routes.js:1) - ADMINISTRATOR role-protected admin ticket routes
- [`src/services/ticket.service.js`](src/services/ticket.service.js:1) - Complete ticket business logic with auto-increment numbering and image handling
- [`src/validations/ticket.validation.js`](src/validations/ticket.validation.js:1) - Comprehensive ticket validation schemas with file upload validation
- [`src/utils/upload.js`](src/utils/upload.js:1) - Multer configuration for image uploads with validation and storage management
- [`rest/ticket.rest`](rest/ticket.rest:1) - Complete user ticket test suite with 35+ test scenarios
- [`rest/admin/ticket.rest`](rest/admin/ticket.rest:1) - Complete admin ticket test suite with 45+ test scenarios

### Database Layer

- [`prisma/schema.prisma`](prisma/schema.prisma:1) - Complete database schema with service catalog and support ticket models
- [`src/utils/prisma.js`](src/utils/prisma.js:1) - Prisma client instance
- [`prisma/seed.js`](prisma/seed.js:1) - Comprehensive seed data with service catalog

### Utilities

- [`src/utils/response.js`](src/utils/response.js:1) - Standardized API response formatting
- [`src/utils/logger.js`](src/utils/logger.js:1) - Winston logging configuration
- [`src/utils/transactionId.js`](src/utils/transactionId.js:1) - Custom transaction ID generation and validation

## Key Technical Decisions

### Authentication Architecture

- **JWT Access Tokens**: Short-lived (24h) for API access
- **Refresh Tokens**: Long-lived (7d) stored in database for token renewal
- **Role-based Access**: USER and ADMINISTRATOR roles with middleware enforcement
- **Password Security**: bcrypt with 12 salt rounds

### Service Catalog Architecture

- **ServiceCategory Model**: Hierarchical service organization (Development Tools, CMS, Databases)
- **Service Model**: Service templates with Kubernetes configuration (N8N, Ghost, PostgreSQL)
- **ServicePlan Model**: Pricing tiers with simplified quota system (FREE, BASIC, PRO, PREMIUM, ENTERPRISE)
- **Subscription Model**: User subscriptions with credit-based billing and upgrade-only policy
- **Transaction Model**: Complete transaction tracking with Midtrans payment methods and custom TXMP-XXX ID format
- **ServiceInstance Model**: Kubernetes instance management linked to subscriptions

### Database Design

- **User Model**: Enhanced with credit fields (creditBalance, totalTopUp, totalSpent) with Int precision for IDR currency
- **RefreshToken Model**: Secure token management with expiration
- **Service Catalog Models**: Complete schema for PaaS service management
- **Credit System**: Transaction-based credit management with audit trail
- **Cascade Deletion**: Proper relationship management across all models
- **Currency Storage**: Int fields for IDR to avoid decimal precision issues
- **Custom Transaction IDs**: TXMP-XXX format with PostgreSQL sequence auto-increment starting from 101
- **Support Ticket Models**: Ticket, TicketMessage, and TicketAttachment models with auto-increment ticket numbers
- **Three-Status Workflow**: OPEN → IN_PROGRESS → CLOSED with automatic status transitions

### Kubernetes Integration

- **Dual Environment Support**: In-cluster config for production, local kubeconfig for development
- **Metrics Collection**: Real-time CPU and memory usage via Kubernetes Metrics API
- **Network Monitoring**: Complete ingress and service monitoring with detailed configuration data
- **Multi-API Support**: CoreV1Api, AppsV1Api, NetworkingV1Api, and MetricsV1beta1Api clients
- **Error Handling**: Graceful degradation when K8s cluster is unavailable
- **Multi-namespace Support**: Cross-namespace resource monitoring
- **Service Provisioning**: Automated deployment of containerized services with full lifecycle management
- **Resource Templates**: Dynamic Kubernetes manifest generation for various service types
- **Deployment Readiness**: Industry best-practice readiness checks using deployment status conditions
- **Resource Cleanup**: Automatic termination and cleanup on subscription cancellation

### Auto-Renewal System Architecture

- **Scheduled Jobs**: 5 cron jobs with configurable schedules via environment variables
- **Grace Period Management**: Configurable grace periods (1-30 days) with enable/disable option
- **Notification System**: 6 notification types for comprehensive user communication
- **Environment Configuration**: Complete control via .env variables for all billing settings
- **Rollback Procedures**: Complete failure recovery with state restoration for upgrades
- **Admin Controls**: Comprehensive admin tools for billing management and subscription editing

### Credit-Based Billing System

- **Credit Management**: Real-time balance tracking with transaction history
- **Payment Integration**: Midtrans gateway with multiple payment methods (Bank Transfer, E-Wallet, Credit Card, QRIS)
- **Transaction Types**: TOP_UP, SUBSCRIPTION, UPGRADE, REFUND, ADMIN_ADJUSTMENT, COUPON_REDEMPTION
- **Automated Processing**: Webhook handling for payment notifications
- **Audit Trail**: Complete transaction logging with balance snapshots and custom transaction IDs
- **Custom ID Format**: TXMP-XXX sequential numbering with PostgreSQL sequence management

### Coupon/Code Redemption System Architecture

- **Three Coupon Types**: CREDIT_TOPUP (billing page), SUBSCRIPTION_DISCOUNT (checkout), FREE_SERVICE (free subscriptions)
- **Flexible Discounts**: Fixed amount and percentage discounts with service-specific restrictions
- **Usage Controls**: Per-user and total usage limits with expiry date management
- **Transaction Safety**: All operations protected by database transactions with race condition handling
- **Admin Management**: Complete coupon lifecycle with creation, monitoring, and analytics
- **Audit Trail**: Full redemption tracking with metadata and transaction linking
- **Error Handling**: Consistent error messages and graceful constraint violation handling

### Support Ticket System Architecture

- **Three-Status Workflow**: OPEN (new tickets) → IN_PROGRESS (when admin responds) → CLOSED (final state)
- **Auto-Increment Tickets**: PostgreSQL sequence-based ticket numbering with formatted display (#001, #002, etc.)
- **Image Upload Support**: Multi-file image attachments with comprehensive validation (JPEG, PNG, GIF, WebP, max 5MB each, 5 files per request)
- **User Self-Service**: Users can create tickets, add messages with attachments, and close their own tickets (no reopen capability)
- **Admin Management**: Full admin control with bulk operations, comprehensive statistics, and complete ticket lifecycle management
- **Automatic Status Management**: Tickets automatically change to IN_PROGRESS when admin responds
- **File Storage**: Secure file storage with UUID-based naming and access control
- **Comprehensive Testing**: Complete REST test suites for both user and admin functionality

### Simplified Quota Management

- **Real-time Tracking**: totalQuota and usedQuota fields per service plan
- **Atomic Operations**: Database transactions for quota allocation/release
- **Capacity Monitoring**: Utilization tracking with health status indicators
- **Availability Checks**: Pre-allocation validation to prevent overselling

### API Design Patterns

- **Consistent Response Format**: Standardized success/error responses with timestamps
- **HTTP Status Codes**: Proper status code usage throughout
- **Error Handling**: Global error handler with detailed logging
- **Validation**: Joi schemas for request validation
- **Business Logic Separation**: Clean service layer architecture with modern const-based patterns
- **Architecture Modernization**: Consistent const-based function patterns across all core services

### Auto-Renewal System Design

- **Scheduled Processing**: Daily auto-renewal at 2:00 AM with configurable cron schedules
- **Grace Period Logic**: Configurable grace periods with immediate suspension option
- **Notification Pipeline**: Proactive notifications (low credit warnings, grace period reminders)
- **Admin Interface**: Complete billing management with manual job execution capabilities
- **Environment Control**: All settings configurable via .env variables
- **Rollback System**: Complete failure recovery for upgrade operations

## Component Relationships

### Authentication Flow

1. User registers/logs in → [`auth.controller.js`](src/controllers/auth.controller.js:1)
2. Controller calls → [`auth.service.js`](src/services/auth.service.js:1)
3. Service interacts with → [`prisma.js`](src/utils/prisma.js:1) → PostgreSQL
4. JWT tokens generated and returned

### Service Catalog Flow

1. User browses catalog → Catalog Controller (to be implemented)
2. Controller calls → [`catalog.service.js`](src/services/catalog.service.js:1)
3. Service queries → Database models → Returns formatted catalog data
4. Availability checked via → [`quota.service.js`](src/services/quota.service.js:1)

### Subscription Creation Flow

1. User selects plan → [`subscription.controller.js`](src/controllers/subscription.controller.js:1) → `createSubscription()`
2. Validation → [`subscription.service.js`](src/services/subscription.service.js:656) → `validateSubscription()`
3. Credit check → [`credit.service.js`](src/services/credit.service.js:6) → `checkSufficientCredit()`
4. Quota allocation → [`quota.service.js`](src/services/quota.service.js:46) → `allocateQuota()`
5. Credit deduction → [`credit.service.js`](src/services/credit.service.js:25) → `deductCredit()`
6. Subscription created → Database transaction → Success response

### Admin Subscription Management Flow

1. Admin creates subscription → [`admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:14) → `createSubscriptionForUser()`
2. Bonus subscription option → [`subscription.service.js`](src/services/subscription.service.js:15) → `createSubscription()` with `skipCreditCheck`
3. Admin upgrade subscription → [`admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:650) → `upgradeSubscriptionForUser()`
4. Bonus upgrade option → [`subscription.service.js`](src/services/subscription.service.js:196) → `upgradeSubscription()` with bonus support
5. Admin refund/extend → Complete admin control over subscription lifecycle

### Payment Processing Flow

1. User initiates top-up → [`wallet.controller.js`](src/controllers/wallet.controller.js:1) → `createTopUp()`
2. Controller calls → [`midtrans.service.js`](src/services/payment/midtrans.service.js:15) → `createTopUpTransaction()`
3. Midtrans API → Payment page → User completes payment
4. Webhook notification → [`midtrans.service.js`](src/services/payment/midtrans.service.js:183) → `handleNotification()`
5. Credit added → Direct database transaction with atomic balance update
6. Transaction status updated → COMPLETED with proper balance tracking

### Coupon Redemption Flow

1. **Credit Top-up Coupon (Billing Page)**:

   - User validates coupon → [`wallet.controller.js`](src/controllers/wallet.controller.js:1) → `validateCoupon()`
   - User redeems coupon → [`wallet.controller.js`](src/controllers/wallet.controller.js:1) → `redeemCoupon()`
   - Controller calls → [`coupon.service.js`](src/services/coupon.service.js:135) → `redeemCreditTopupCoupon()`
   - Credit added → [`credit.service.js`](src/services/credit.service.js:121) → `addCredit()`
   - Transaction created → COUPON_REDEMPTION type with audit trail

2. **Subscription Discount Coupon (Checkout Page)**:

   - User creates subscription → [`subscription.controller.js`](src/controllers/subscription.controller.js:87) → `createSubscription()`
   - Coupon validation → [`coupon.service.js`](src/services/coupon.service.js:233) → `calculateSubscriptionDiscount()`
   - Subscription created → [`subscription.service.js`](src/services/subscription.service.js:17) → `createSubscription()` with discount
   - Coupon applied → [`coupon.service.js`](src/services/coupon.service.js:308) → `applySubscriptionDiscount()`
   - Redemption record → Database with subscription link

3. **Free Service Coupon**:
   - User creates subscription → [`subscription.controller.js`](src/controllers/subscription.controller.js:87) → `createSubscription()`
   - Free service coupon → [`coupon.service.js`](src/services/coupon.service.js:377) → `redeemFreeServiceCoupon()`
   - Subscription created → Zero cost with coupon audit trail
   - Service provisioned → Normal Kubernetes deployment flow

### Support Ticket Flow

1. **User Creates Ticket**:

   - User creates ticket → [`ticket.controller.js`](src/controllers/ticket.controller.js:1) → `createTicket()`
   - Controller calls → [`ticket.service.js`](src/services/ticket.service.js:1) → `createTicket()`
   - Database transaction → Ticket created with auto-increment number
   - File attachments → Stored securely with validation

2. **Admin Responds to Ticket**:

   - Admin adds message → [`admin/ticket.controller.js`](src/controllers/admin/ticket.controller.js:1) → `addMessage()`
   - Controller calls → [`ticket.service.js`](src/services/ticket.service.js:1) → `addMessageToTicket()` with `isAdmin=true`
   - Automatic status change → OPEN → IN_PROGRESS when admin responds
   - Message stored → Database with admin flag and attachments

3. **User Self-Service Close**:

   - User closes ticket → [`ticket.controller.js`](src/controllers/ticket.controller.js:1) → `closeTicket()`
   - Controller calls → [`ticket.service.js`](src/services/ticket.service.js:1) → `closeTicketByUser()`
   - Status updated → CLOSED (no reopen capability for users)
   - Audit trail → Complete logging of closure action

4. **Admin Management**:
   - Admin bulk operations → [`admin/ticket.controller.js`](src/controllers/admin/ticket.controller.js:1) → `bulkCloseTickets()`
   - Admin statistics → [`admin/ticket.controller.js`](src/controllers/admin/ticket.controller.js:1) → `getTicketStats()`
   - Complete lifecycle control → Close, reopen, bulk operations with comprehensive management

### Service Provisioning Flow

1. User creates subscription → [`subscription.controller.js`](src/controllers/subscription.controller.js:1) → `createSubscription()`
2. Subscription service → [`subscription.service.js`](src/services/subscription.service.js:15) → `createSubscription()`
3. Automatic provisioning → [`provisioning.service.js`](src/services/k8s/provisioning.service.js:1) → `provisionService()`
4. Kubernetes deployment → [`k8s-helper.js`](src/utils/k8s-helper.js:1) → Resource creation
5. Health monitoring → [`health.service.js`](src/services/k8s/health.service.js:1) → Status tracking
6. Instance record → Database → ServiceInstance model updated

### Service Termination Flow

1. User cancels subscription → [`subscription.controller.js`](src/controllers/subscription.controller.js:1) → `cancelSubscription()`
2. Subscription service → [`subscription.service.js`](src/services/subscription.service.js:407) → `cancelSubscription()`
3. Resource cleanup → [`provisioning.service.js`](src/services/k8s/provisioning.service.js:1) → `terminateServiceInstance()`
4. Kubernetes deletion → [`k8s-helper.js`](src/utils/k8s-helper.js:1) → Resource removal
5. Database cleanup → ServiceInstance status updated to TERMINATED

### Kubernetes Monitoring Flow

1. Admin requests K8s data → [`k8s/*.controller.js`](src/controllers/k8s/)
2. Controller calls → [`k8s/*.service.js`](src/services/k8s/)
3. Service uses → [`kubernetes.js`](src/config/kubernetes.js:1) client
4. Metrics collected and formatted for response

### Request Processing Pipeline

1. **Route Matching**: [`index.routes.js`](src/routes/index.routes.js:1)
2. **Authentication**: [`auth.js`](src/middleware/auth.js:1) middleware
3. **Authorization**: Role-based access control
4. **Validation**: Joi schema validation
5. **Controller**: Request handling
6. **Service**: Business logic execution
7. **Response**: Standardized format via [`response.js`](src/utils/response.js:1)

## Critical Implementation Paths

### User Registration Path

[`auth.routes.js`](src/routes/auth.routes.js:1) → [`auth.controller.js`](src/controllers/auth.controller.js:6) → [`auth.service.js`](src/services/auth.service.js:6) → [`prisma.js`](src/utils/prisma.js:1)

### Service Catalog Browsing Path

Catalog Routes (to be implemented) → Catalog Controller (to be implemented) → [`catalog.service.js`](src/services/catalog.service.js:25) → Database

### User Subscription Management Path

[`subscription.routes.js`](src/routes/subscription.routes.js:1) → [`subscription.controller.js`](src/controllers/subscription.controller.js:1) → [`subscription.service.js`](src/services/subscription.service.js:15) → [`credit.service.js`](src/services/credit.service.js:25) + [`quota.service.js`](src/services/quota.service.js:46)

### Admin Subscription Management Path

[`admin/subscription.routes.js`](src/routes/admin/subscription.routes.js:1) → [`admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:1) → [`subscription.service.js`](src/services/subscription.service.js:15) → Database transactions with bonus capabilities

### Payment Processing Path

[`wallet.routes.js`](src/routes/wallet.routes.js:1) → [`wallet.controller.js`](src/controllers/wallet.controller.js:1) → [`midtrans.service.js`](src/services/payment/midtrans.service.js:15) → Midtrans API

### Protected Route Access

[`routes/*`] → [`auth.js`](src/middleware/auth.js:6) → [`auth.service.js`](src/services/auth.service.js:189) → Controller

### Service Instance Management Path

[`instance.routes.js`](src/routes/instance.routes.js:1) → [`instance.controller.js`](src/controllers/instance.controller.js:1) → [`provisioning.service.js`](src/services/k8s/provisioning.service.js:1) → [`k8s-helper.js`](src/utils/k8s-helper.js:1) → K8s API

### K8s Resource Monitoring

[`k8s.routes.js`] → [`k8s.controller.js`] → [`k8s.service.js`] → [`kubernetes.js`](src/config/kubernetes.js:46) → K8s API

### Auto-Renewal Processing Flow

1. Scheduled job triggers → [`auto-renewal.job.js`](src/jobs/auto-renewal.job.js:1) → `processDailyRenewals()`
2. Billing service → [`billing.service.js`](src/services/billing.service.js:24) → `processAutoRenewals()`
3. Credit validation → [`credit.service.js`](src/services/credit.service.js:25) → `deductCredit()`
4. Success → Subscription updated → Notification sent
5. Failure → Grace period set → Notification sent → Daily reminders

### Grace Period Management Flow

1. Renewal fails → [`billing.service.js`](src/services/billing.service.js:199) → `setGracePeriod()`
2. Daily processing → [`auto-renewal.job.js`](src/jobs/auto-renewal.job.js:1) → `processGracePeriod()`
3. Grace period expired → Check credit → Suspend or renew
4. Notifications → [`notification.service.js`](src/services/notification.service.js:1) → Various notification types

### Admin Billing Management Flow

1. Admin requests → [`admin/billing.routes.js`](src/routes/admin/billing.routes.js:1) → Admin billing controller
2. Controller calls → [`billing.service.js`](src/services/billing.service.js:1) → Billing operations
3. Manual job execution → [`auto-renewal.job.js`](src/jobs/auto-renewal.job.js:1) → Specific job functions
4. Statistics → Database aggregation → Formatted response

### Support Ticket Management Flow

1. User ticket creation → [`ticket.routes.js`](src/routes/ticket.routes.js:1) → [`ticket.controller.js`](src/controllers/ticket.controller.js:1) → [`ticket.service.js`](src/services/ticket.service.js:1) → Database with auto-increment
2. Admin ticket management → [`admin/ticket.routes.js`](src/routes/admin/ticket.routes.js:1) → [`admin/ticket.controller.js`](src/controllers/admin/ticket.controller.js:1) → [`ticket.service.js`](src/services/ticket.service.js:1) → Complete lifecycle control
3. File upload handling → [`upload.js`](src/utils/upload.js:1) → Multer validation → Secure storage → Database attachment records
4. Status transitions → Automatic IN_PROGRESS when admin responds → Manual CLOSED by user or admin

## Kubernetes Endpoints Architecture

### Resource Monitoring Endpoints

- **Pods**: [`src/controllers/k8s/pod.controller.js`](src/controllers/k8s/pod.controller.js:1) → [`src/services/k8s/pod.service.js`](src/services/k8s/pod.service.js:1)
- **Deployments**: [`src/controllers/k8s/deployment.controller.js`](src/controllers/k8s/deployment.controller.js:1) → [`src/services/k8s/deployment.service.js`](src/services/k8s/deployment.service.js:1)
- **Nodes**: [`src/controllers/k8s/node.controller.js`](src/controllers/k8s/node.controller.js:1) → [`src/services/k8s/node.service.js`](src/services/k8s/node.service.js:1)
- **Namespaces**: [`src/controllers/k8s/namespace.controller.js`](src/controllers/k8s/namespace.controller.js:1) → [`src/services/k8s/namespace.service.js`](src/services/k8s/namespace.service.js:1)

### Network Monitoring Endpoints

- **Ingresses**: [`src/controllers/k8s/ingress.controller.js`](src/controllers/k8s/ingress.controller.js:1) → [`src/services/k8s/ingress.service.js`](src/services/k8s/ingress.service.js:1)
- **Services**: [`src/controllers/k8s/service.controller.js`](src/controllers/k8s/service.controller.js:1) → [`src/services/k8s/service.service.js`](src/services/k8s/service.service.js:1)

### API Routes Structure

All K8s endpoints follow the pattern: `GET /api/admin/k8s/{resource}` with admin authentication required.

### Testing Infrastructure

- [`rest/admin/k8s-pods.rest`](rest/admin/k8s-pods.rest:1) - Pod endpoint testing
- [`rest/admin/k8s-deployments.rest`](rest/admin/k8s-deployments.rest:1) - Deployment endpoint testing
- [`rest/admin/k8s-nodes.rest`](rest/admin/k8s-nodes.rest:1) - Node endpoint testing
- [`rest/admin/k8s-namespaces.rest`](rest/admin/k8s-namespaces.rest:1) - Namespace endpoint testing
- [`rest/admin/k8s-ingresses.rest`](rest/admin/k8s-ingresses.rest:1) - Ingress endpoint testing
- [`rest/admin/k8s-services.rest`](rest/admin/k8s-services.rest:1) - Service endpoint testing
- [`rest/instance.rest`](rest/instance.rest:1) - Service instance management testing
- [`rest/admin/health.rest`](rest/admin/health.rest:1) - Health monitoring endpoint testing
- [`rest/end-to-end-test.rest`](rest/end-to-end-test.rest:1) - Complete subscription-to-deployment workflow testing
- [`rest/admin/billing.rest`](rest/admin/billing.rest:1) - Auto-renewal system testing with 25 comprehensive test scenarios
- [`rest/ticket.rest`](rest/ticket.rest:1) - User ticket system testing with 35+ comprehensive test scenarios
- [`rest/admin/ticket.rest`](rest/admin/ticket.rest:1) - Admin ticket system testing with 45+ comprehensive test scenarios

### Support Ticket System Testing

- **User Functionality Tests**: Complete validation of ticket creation, messaging, file uploads, and self-service closure
- **Admin Management Tests**: Full admin control testing including bulk operations, statistics, and lifecycle management
- **File Upload Tests**: Comprehensive validation of image upload functionality with size and type restrictions
- **Status Workflow Tests**: Complete testing of three-status workflow with automatic transitions
- **Error Handling Tests**: Extensive validation of error scenarios and edge cases
- **Authentication Tests**: Complete access control validation for user and admin endpoints

### Auto-Renewal System Testing

- **Billing Service Tests**: Complete validation of auto-renewal processing logic
- **Job Scheduler Tests**: Manual job execution and status monitoring
- **Grace Period Tests**: Grace period setting, processing, and suspension workflows
- **Notification Tests**: All 6 notification types with mock data validation
- **Admin Interface Tests**: Complete admin billing management endpoint testing
- **Environment Tests**: Configuration validation and fallback testing
- **Integration Tests**: End-to-end auto-renewal workflow validation
