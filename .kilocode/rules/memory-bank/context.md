# Current Context

## Current Work Focus

The backend API has **completed Phase 9: Support Ticket System** with comprehensive customer support functionality. The project now includes complete PaaS platform functionality with Google OAuth support, automated welcome bonuses, configurable grace periods, comprehensive admin management tools, intelligent subscription management, flexible coupon system, and full-featured support ticket system.

**Recent Major Updates (August 31, 2025):**

- **Support Ticket System**: Complete customer support system with auto-increment ticket numbers and image attachments
- **Three-Status Workflow**: OPEN → IN_PROGRESS (when admin responds) → CLOSED with automatic status transitions
- **User Self-Service**: Users can create tickets, add messages with attachments, and close their own tickets (no reopen)
- **Admin Management**: Full admin control with bulk operations, comprehensive statistics, and complete ticket lifecycle management
- **Image Upload Support**: Multi-file image attachments with validation (JPEG, PNG, GIF, WebP, max 5MB each, 5 files per request)
- **Auto-Increment Tickets**: PostgreSQL sequence-based ticket numbering with formatted display (#001, #002, etc.)
- **Comprehensive Testing**: Complete REST test suites for both user and admin functionality with 35+ test scenarios each
- **Database Integration**: Full Prisma schema integration with Ticket, TicketMessage, and TicketAttachment models

## Recent Implementation Status

### ✅ Completed Features

**Foundation Layer (Previously Completed):**

- **User Authentication System**: Complete JWT-based auth with refresh tokens
- **User Management**: Registration, login, profile management with role-based access
- **Kubernetes Integration**: Comprehensive monitoring of pods, deployments, nodes, namespaces, ingresses, and services
- **Admin APIs**: Complete administrative endpoints for K8s resource management
- **Metrics Collection**: CPU and memory usage monitoring for pods with unified container data structure
- **Network Monitoring**: Ingress and Service monitoring with detailed network configuration data
- **Error Handling**: Comprehensive error handling and logging system

**Phase 1: Database & Core Models (Completed):**

- **Complete Database Schema**: All service catalog models implemented (ServiceCategory, Service, ServicePlan, Subscription, Transaction, ServiceInstance)
- **User Model Enhancement**: Added credit fields with increased precision to Int for IDR currency
- **Database Migration**: Successfully applied with comprehensive seed data and currency conversion
- **Core Service Layer**: 6 comprehensive business logic services implemented
- **Midtrans Integration**: Complete payment gateway integration ready
- **Simplified Quota System**: Real-time quota management with database transactions
- **Credit-Based Billing**: Complete credit management system
- **Subscription Management**: Full subscription lifecycle management
- **Transaction System**: Comprehensive transaction handling and reporting

**Phase 2.1: Public Catalog API (Completed):**

- **Catalog Controller**: Complete service catalog browsing endpoints
- **Catalog Routes**: Public API routes for service discovery
- **Catalog Validation**: Joi validation schemas for catalog endpoints
- **Service Filtering**: Category-based filtering and search functionality

**Phase 2.2: Wallet Management API (Completed):**

- **Wallet Controller**: 9 comprehensive wallet management endpoints
- **Wallet Routes**: JWT-authenticated routes for credit management
- **Wallet Validation**: Complete Joi validation with CUID support
- **Midtrans Integration**: Full payment gateway integration with webhook handling
- **Credit Processing**: Real-time balance tracking and transaction management
- **Payment Methods**: Support for Bank Transfer, E-Wallet, Credit Card, QRIS
- **Transaction Lifecycle**: Complete status tracking and cancellation support
- **Database Precision Fix**: Resolved overflow errors with currency conversion to Int

**Phase 3: Subscription Management API (Completed):**

- **User Subscription Controller**: 6 comprehensive user subscription endpoints
- **User Subscription Routes**: JWT-authenticated routes for subscription management
- **User Subscription Validation**: Complete Joi validation schemas
- **Admin Subscription Controller**: 7 comprehensive admin subscription management endpoints
- **Admin Subscription Routes**: ADMINISTRATOR role-protected routes
- **Admin Subscription Validation**: Complete admin-specific validation schemas
- **Bonus Subscription System**: Admin capability to create free subscriptions with audit trail
- **Admin Upgrade System**: Admin capability to upgrade subscriptions with bonus upgrade support
- **Subscription Lifecycle**: Create, upgrade, cancel, refund, extend, and force-cancel capabilities
- **Business Logic**: Upgrade-only policy, prorated billing, quota management
- **Comprehensive Testing**: 28 user test cases + 41 admin test cases
- **Subscription Metrics Endpoint**: Real-time metrics API for frontend polling with simplified response structure

**Phase 4: Service Provisioning & Instance Management (Completed):**

- **Kubernetes Provisioning Service**: Complete automated service deployment system
- **Service Instance Management**: Full lifecycle management with 6 endpoints
- **Health Monitoring System**: Real-time service health checks and status monitoring
- **Deployment Automation**: Robust Kubernetes resource creation and management
- **Error Handling**: Comprehensive debugging and error recovery mechanisms
- **Resource Cleanup**: Automatic termination on subscription cancellation
- **End-to-End Integration**: Verified subscription-to-deployment workflow
- **Production Readiness**: Battle-tested deployment logic with extensive debugging
- **Pod Name Synchronization**: Fixed critical issue where database stored outdated pod names after Kubernetes rolling updates

**Phase 5: Advanced Service Control Features (Completed - August 27, 2025):**

- **Real-time Log Streaming**: Socket.IO integration for live Kubernetes pod log monitoring with automatic pod discovery
- **Retry Provisioning System**: Complete retry functionality for failed service deployments with cleanup and redeploy
- **Restart Functionality**: Kubernetes rolling restart with pod name synchronization and minimal downtime
- **STOP/START Functionality**: Complete service pause/resume capabilities with Kubernetes scaling (0↔1 replicas)
- **Dual Endpoint Strategy**: Both instance-level and subscription-level endpoints for optimal UX
- **Database Schema Enhancement**: Added RESTARTING, STOPPING, and STARTING status values to InstanceStatus enum
- **Comprehensive Testing**: Full test suites for all new functionality with workflow validation

**Phase 6: Auto-Renewal System (Completed - August 30, 2025):**

- **Automated Billing System**: Complete auto-renewal processing with scheduled jobs (5 cron jobs)
- **Grace Period Management**: Configurable grace periods (1-30 days) with environment variable control
- **Notification System**: Comprehensive notification system with 6 notification types
- **Admin Billing Interface**: 9 comprehensive admin endpoints for billing management
- **Environment Configuration**: Complete control via .env variables for all billing settings
- **Enhanced Upgrade System**: Complete rollback procedures for failed upgrades
- **Admin Subscription Update**: Free editing of any subscription field with comprehensive validation
- **User Management Enhancement**: Credit balance and subscription count in admin user list
- **Auto-Renew Toggle**: User control over subscription renewal with billing transparency
- **Access Control Fix**: Resolved admin upgrade authorization issue in Kubernetes updates

**Phase 6.1: Auto-Renewal System Enhancements (Just Completed - August 30, 2025):**

- **EXPIRED Status Implementation**: Changed failed renewals from SUSPENDED to EXPIRED status across all system components
- **Subscription Reactivation System**: Automatic reactivation of expired subscriptions instead of creating duplicates
- **Billing Statistics Fix**: Corrected overdue subscription detection to show all overdue subscriptions (not just today's)
- **Admin Endpoint Migration**: Updated admin billing endpoints from `/suspend/` to `/expire/` with proper validation
- **One-Subscription-Per-Service Policy**: Enforced single subscription per user per service with intelligent handling
- **Smart Subscription Logic**: Handles ACTIVE (prevent duplicate), EXPIRED (reactivate), CANCELLED (allow new)
- **Complete Testing Updates**: Updated all REST test files to reflect new expire functionality

### 🔄 Current State

- **Environment**: Development setup with local PostgreSQL database and K3s cluster integration
- **Database**: Enhanced schema with expanded InstanceStatus enum and custom transaction IDs
- **Core Services**: All services modernized with const-based architecture and comprehensive testing
- **Payment Integration**: Midtrans fully operational with webhook processing and custom transaction IDs
- **Wallet System**: Production-ready with comprehensive error handling
- **Subscription System**: Complete user and admin subscription management with advanced features, real-time metrics, and intelligent reactivation
- **Kubernetes Integration**: Full service provisioning and instance management with advanced control features
- **Service Control**: Complete STOP/START/RESTART/RETRY functionality with dual endpoint strategy
- **Real-time Features**: Socket.IO log streaming and metrics polling capabilities
- **Auto-Renewal System**: Complete automated billing with EXPIRED status handling and configurable grace periods
- **Admin Tools**: Comprehensive admin management for subscriptions, billing, and user management with expire functionality
- **Architecture**: Modernized codebase with consistent const-based patterns
- **Transaction System**: Custom TXMP-XXX ID format with PostgreSQL sequence auto-increment
- **Environment Configuration**: Complete control via .env variables for all system settings
- **Subscription Management**: Intelligent one-subscription-per-service policy with automatic reactivation
- **Google OAuth Integration**: Complete NextAuth-compatible authentication with official Google library
- **Welcome Bonus System**: Coupon-based promotional system with admin control and multiple bonus support
- **Support Ticket System**: Complete customer support functionality with three-status workflow and image attachments
- **Progress**: 100% complete - All planned platform features implemented including Google OAuth, welcome bonus system, and support tickets

**Phase 8: Google OAuth Integration & Welcome Bonus System (Just Completed - August 31, 2025):**

- **Google OAuth Integration**: Complete NextAuth-compatible Google OAuth system
- **User Model Enhancement**: Added googleId, isGoogleUser, and emailVerified fields
- **Authentication Endpoints**: Google login, account linking, and unlinking capabilities
- **Welcome Bonus System**: Coupon-based automatic promotional system
- **WELCOME_BONUS Coupon Type**: New coupon type for automatic application during registration
- **Multiple Bonus Support**: System applies all active welcome bonus coupons to new users
- **Admin-Controlled Bonuses**: Full management through existing coupon admin system
- **Graceful Fallback**: Registration continues normally when no bonuses available
- **Comprehensive Testing**: Complete test suites for both Google OAuth and welcome bonus systems
- **Documentation**: Full documentation for both systems with implementation guides

**Phase 9: Support Ticket System (Just Completed - August 31, 2025):**

- **Support Ticket System**: Complete customer support system with comprehensive functionality
- **Database Schema**: Added Ticket, TicketMessage, and TicketAttachment models with auto-increment ticket numbers
- **Three-Status Workflow**: OPEN (new tickets) → IN_PROGRESS (admin responds) → CLOSED (final state)
- **User Functionality**: Create tickets, add messages with attachments, close own tickets (no reopen capability)
- **Admin Management**: Full admin control with bulk operations, statistics, and complete lifecycle management
- **Image Upload System**: Multi-file support with comprehensive validation and secure storage
- **Auto-Increment Tickets**: PostgreSQL sequence-based numbering with formatted display (#001, #002, etc.)
- **Automatic Status Management**: Tickets automatically change to IN_PROGRESS when admin responds
- **Comprehensive Testing**: Complete REST test suites with 35+ scenarios for both user and admin endpoints

## Next Steps

### Future Enhancements (Phase 9+)

1. **Domain Management**: Custom domain and SSL certificate management
2. **Auto-scaling**: Dynamic resource scaling based on usage patterns
3. **Advanced Monitoring**: Enhanced metrics collection and alerting
4. **Multi-region Support**: Geographic distribution of services
5. **Service Templates**: User-defined service configurations and templates
6. **Email/SMS Integration**: Real notification delivery (currently logging only)
7. **Advanced Analytics**: Revenue analytics and user behavior tracking

### Optional Enhancements

- **Admin Dashboard**: Management interfaces and analytics
- **Advanced Multi-tenancy**: Enhanced tenant isolation and management
- **Service Mesh Integration**: Istio/Linkerd for advanced networking
- **Backup & Recovery**: Automated backup systems for user data
- **CI/CD Integration**: Automated deployment pipelines for user services

## Key Decisions Made

- **Database**: PostgreSQL chosen for reliability and ACID compliance
- **ORM**: Prisma selected for type safety and developer experience
- **Authentication**: JWT with refresh tokens for security and scalability
- **K8s Client**: Official Kubernetes JavaScript client for cluster integration
- **Architecture**: Clean separation of controllers, services, and utilities
- **Currency Storage**: Int fields for IDR to avoid decimal precision issues
- **Service Control**: Dual endpoint strategy for different user types (instance vs subscription level)
- **Real-time Communication**: Socket.IO for log streaming and live updates
- **Auto-Renewal System**: Scheduled jobs with configurable grace periods and EXPIRED status
- **Environment Configuration**: Complete system control via .env variables
- **Subscription Policy**: One subscription per user per service with intelligent reactivation
- **Status Management**: EXPIRED status for failed renewals instead of SUSPENDED

## Recent Implementation History

### Phase 8: Google OAuth Integration & Welcome Bonus System (Just Completed - August 31, 2025)

#### Google OAuth Integration Implementation

- **Dependencies**: Added `google-auth-library` for official Google token verification
- **Database Schema**: Enhanced User model with Google OAuth fields:
  - `googleId` (unique Google user ID)
  - `isGoogleUser` (flag for Google OAuth users)
  - `emailVerified` (email verification status)
  - Made `password` optional for Google-only users
- **Configuration**: [`src/config/google.js`](src/config/google.js:1) - Google OAuth2 client and token verification
- **Service Integration**: [`src/services/auth.service.js`](src/services/auth.service.js:1) - Enhanced with Google OAuth methods:
  - `googleLogin()` - Complete Google OAuth login flow
  - `linkGoogleAccount()` - Link Google account to existing user
  - `unlinkGoogleAccount()` - Safely unlink Google account
- **API Endpoints**: [`src/controllers/auth.controller.js`](src/controllers/auth.controller.js:1) - Google OAuth controllers
- **Routes**: [`src/routes/auth.routes.js`](src/routes/auth.routes.js:1) - Added Google OAuth routes:
  - `POST /api/auth/google/login` - Google OAuth login
  - `POST /api/auth/google/link` - Link Google account (protected)
  - `POST /api/auth/google/unlink` - Unlink Google account (protected)
- **Validation**: [`src/validations/auth.validation.js`](src/validations/auth.validation.js:1) - Google OAuth validation schemas
- **Testing**: [`rest/auth-google.rest`](rest/auth-google.rest:1) - Comprehensive Google OAuth test suite
- **Documentation**: [`GOOGLE-OAUTH-INTEGRATION.md`](GOOGLE-OAUTH-INTEGRATION.md:1) - Complete implementation guide

#### Welcome Bonus System Implementation

- **Database Schema**: Added `WELCOME_BONUS` to CouponType enum in Prisma schema
- **Service Logic**: [`src/services/welcomeBonus.service.js`](src/services/welcomeBonus.service.js:1) - Welcome bonus application logic:
  - `applyWelcomeBonuses()` - Main function to apply all eligible welcome bonuses
  - `getWelcomeBonusStats()` - Statistics and analytics for welcome bonuses
- **Coupon Service Enhancement**: [`src/services/coupon.service.js`](src/services/coupon.service.js:1) - Updated to handle WELCOME_BONUS type
- **Registration Integration**: [`src/services/auth.service.js`](src/services/auth.service.js:1) - Integrated into both regular and Google OAuth registration
- **Validation Updates**: [`src/validations/coupon.validation.js`](src/validations/coupon.validation.js:1) - Added WELCOME_BONUS type support
- **Admin Management**: Uses existing coupon admin system for complete welcome bonus management
- **Testing**: [`rest/welcome-bonus.rest`](rest/welcome-bonus.rest:1) - Comprehensive test suite with 30+ test scenarios
- **Seed Data**: [`prisma/seed-welcome-bonus.js`](prisma/seed-welcome-bonus.js:1) - Sample welcome bonus coupons
- **Documentation**: [`WELCOME-BONUS-SYSTEM.md`](WELCOME-BONUS-SYSTEM.md:1) - Complete system documentation

#### Key Features Implemented

1. **Google OAuth Integration**:

   - NextAuth-compatible backend integration
   - Official Google token verification
   - Account linking and unlinking
   - Smart user management (create new or link existing)
   - Email verification from Google
   - Profile synchronization on login

2. **Welcome Bonus System**:
   - Coupon-based promotional system
   - Multiple coupon application (users get all eligible bonuses)
   - Admin-controlled via existing coupon system
   - Automatic application during registration
   - Graceful fallback when no bonuses available
   - Complete audit trail through coupon redemption system

#### Business Logic Enhancements

1. **Authentication Flow**:

   - **Google OAuth Login**: Verify token → Create/find user → Apply welcome bonuses → Return JWT tokens
   - **Account Linking**: Verify email match → Link Google account → Update user profile
   - **Account Unlinking**: Verify password exists → Unlink Google account → Maintain access

2. **Welcome Bonus Flow**:
   - **Registration**: User created → Find active WELCOME_BONUS coupons → Apply all eligible → Update balance
   - **Admin Control**: Create/disable coupons → Set amounts/limits → Control timing
   - **Multiple Bonuses**: Apply all active welcome bonus coupons to maximize user value

#### Integration Points

- **Google OAuth**: Integrated into both regular and Google OAuth registration flows
- **Welcome Bonuses**: Applied automatically during user creation in both authentication methods
- **Existing Systems**: Seamless integration with wallet, credit, and transaction systems
- **Admin Management**: Uses existing coupon admin endpoints for welcome bonus management

### Phase 6.1: Auto-Renewal System Enhancements (Previously Completed - August 30, 2025)

#### EXPIRED Status Implementation

- **Location**: [`src/services/billing.service.js`](src/services/billing.service.js:1) - Core billing service with EXPIRED status
- **Changes Made**:
  - **Function Rename**: `suspendSubscription()` → `expireSubscription()` with EXPIRED status
  - **Status Update**: Changed subscription status from "SUSPENDED" to "EXPIRED" on renewal failure
  - **Log Messages**: Updated all log messages to use "expired" terminology
  - **Result Tracking**: Updated grace period processing to track `expired` instead of `suspended` count
- **Admin Controller**: [`src/controllers/admin/billing.controller.js`](src/controllers/admin/billing.controller.js:1) - Updated admin expire functionality
- **Admin Routes**: [`src/routes/admin/billing.routes.js`](src/routes/admin/billing.routes.js:1) - Changed `/suspend/` to `/expire/` endpoints
- **Auto-Renewal Job**: [`src/jobs/auto-renewal.job.js`](src/jobs/auto-renewal.job.js:1) - Updated log messages for expired subscriptions
- **Testing**: [`rest/admin/billing.rest`](rest/admin/billing.rest:1) - Complete test suite updated for expire functionality

#### Billing Statistics Fix

- **Problem**: Billing statistics only counted subscriptions due "today", missing overdue subscriptions
- **Location**: [`src/services/billing.service.js:428-437`](src/services/billing.service.js:428) - Fixed billing statistics query
- **Solution**: Changed query from date range (today only) to `nextBilling <= now` (all overdue)
- **Field Rename**: `subscriptionsDueToday` → `subscriptionsDueForRenewal` for accuracy
- **Impact**: Now correctly detects and counts all overdue subscriptions for processing

#### Subscription Reactivation System Implementation

- **Location**: [`src/services/subscription.service.js:56-205`](src/services/subscription.service.js:56) - Enhanced subscription creation logic
- **Features**:
  - **Smart Detection**: Checks for existing subscriptions by user + service combination
  - **Status-Based Logic**:
    - **ACTIVE/PENDING**: Prevents duplicate subscriptions (existing behavior)
    - **EXPIRED**: Automatically reactivates existing subscription instead of creating new one
    - **CANCELLED**: Allows creating new subscription (user chose to cancel)
  - **Reactivation Process**:
    - Updates existing subscription with new billing dates (1 month from now)
    - Changes status from EXPIRED to ACTIVE
    - Processes payment and credit deduction
    - Triggers Kubernetes service provisioning
    - Resets failed charges and grace period
    - Supports plan changes during reactivation
- **Admin Function**: [`src/services/subscription.service.js:1543-1575`](src/services/subscription.service.js:1543) - Admin subscription creation with expired detection
- **Audit Trail**: Complete logging with `isReactivation: true` flag for transaction tracking

#### Key Business Logic Changes

1. **Auto-Renewal Failure Handling**:

   - **Before**: Failed renewal → SUSPENDED status
   - **After**: Failed renewal → EXPIRED status

2. **Subscription Creation Logic**:

   - **Before**: Always creates new subscription record
   - **After**: Reactivates existing EXPIRED subscription if found

3. **One-Subscription-Per-Service Policy**:
   - **Enforced**: Users can only have one subscription per service
   - **Smart Handling**: Prevents duplicates while allowing seamless reactivation

#### Testing and Validation

- **Billing Statistics**: Fixed overdue subscription detection and counting
- **Admin Endpoints**: Complete migration from suspend to expire functionality
- **REST Tests**: Updated all test files to reflect new expire endpoints and behavior
- **End-to-End Flow**: Verified subscription expiration → reactivation → provisioning workflow
- **Edge Cases**: Handled various subscription states (ACTIVE, EXPIRED, CANCELLED) appropriately

### Phase 5: Advanced Service Control Features (Previously Completed - August 27, 2025)

#### Real-time Log Streaming Implementation

- **Location**: [`src/config/socket.js`](src/config/socket.js:1) - Socket.IO server configuration and log streaming logic
- **Features**: Live Kubernetes pod log streaming with automatic pod discovery and JWT authentication
- **Architecture**: Namespace-based Socket.IO rooms (`/k8s-logs`) with automatic cleanup and error handling
- **Integration**: Seamless integration with existing authentication system and Kubernetes helper utilities
- **Testing**: [`public/test-logs.html`](public/test-logs.html:1) - Complete test interface for log streaming functionality

#### Retry Provisioning System Implementation

- **Location**: [`src/controllers/subscription.controller.js:422-520`](src/controllers/subscription.controller.js:422) - Retry provisioning endpoint
- **Features**: Complete retry system for failed service deployments with automatic cleanup and redeploy
- **Business Logic**: Only works for ERROR or TERMINATED instances with comprehensive validation
- **Integration**: Uses existing provisioning service with enhanced error handling and status management
- **Testing**: [`rest/subscription.rest:459-555`](rest/subscription.rest:459) - Comprehensive test cases for retry functionality

#### Restart Functionality Implementation

- **Location**: [`src/services/k8s/provisioning.service.js:796-1055`](src/services/k8s/provisioning.service.js:796) - Complete restart logic
- **Features**: Kubernetes rolling restart with pod name synchronization and minimal downtime
- **Architecture**: Uses deployment annotation updates to trigger rolling restarts with proper readiness checks
- **Dual Endpoints**: Both instance-level (`PUT /api/instances/:id/restart`) and subscription-level (`POST /api/subscriptions/:id/restart`)
- **Testing**: [`rest/instance.rest:200-350`](rest/instance.rest:200) and [`rest/subscription.rest:557-772`](rest/subscription.rest:557) - Complete test suites

#### STOP/START Functionality Implementation

- **Location**: [`src/services/k8s/provisioning.service.js:1062-1395`](src/services/k8s/provisioning.service.js:1062) - Complete STOP/START logic
- **Features**: Service pause/resume capabilities using Kubernetes deployment scaling (0↔1 replicas)
- **Architecture**: Proper status lifecycle management (RUNNING→STOPPING→STOPPED and STOPPED→STARTING→RUNNING)
- **Dual Endpoints**: Both instance-level and subscription-level endpoints for optimal user experience
- **Data Preservation**: All data and configuration preserved during stop/start cycle
- **Testing**: [`rest/instance.rest:350-500`](rest/instance.rest:350) and [`rest/subscription.rest:773-1000`](rest/subscription.rest:773) - Comprehensive test suites

#### Database Schema Enhancement

- **Location**: [`prisma/schema.prisma:283-293`](prisma/schema.prisma:283) - Enhanced InstanceStatus enum
- **Enhancement**: Added RESTARTING, STOPPING, and STARTING status values to support advanced service control
- **Migration**: Successfully applied with `npx prisma db push` for immediate schema updates
- **Impact**: Enables proper status tracking for all service lifecycle operations

#### Critical Issues Resolved During Implementation

- **Socket.IO Integration**: Resolved import errors and separated Socket.IO setup into dedicated config module
- **Kubernetes Log Streaming**: Fixed pod discovery using correct label selectors from k8s-helper utility
- **Container Name Resolution**: Resolved HTTP 400 errors by explicitly specifying container names from service slugs
- **Log Output Formatting**: Implemented log parsing to remove verbose timestamps and ANSI color codes
- **Database Schema Alignment**: Fixed Prisma queries to match actual schema relationships and added missing enum values
- **Kubernetes Patch Error**: Fixed Content-Type header issue for proper Kubernetes API communication
- **Status Lifecycle Management**: Implemented proper status transitions for all service control operations

#### End-to-End Integration

- **Service Control Integration**: Complete integration of STOP/START/RESTART/RETRY with existing subscription system
- **Real-time Monitoring**: Socket.IO log streaming integrated with service instance management
- **Dual UX Strategy**: Both technical (instance-level) and user-friendly (subscription-level) endpoints
- **Comprehensive Testing**: Complete test coverage for all new functionality with workflow validation
- **Production Readiness**: Robust error handling, status management, and resource cleanup

### Phase 4.5: Pod Name Synchronization & Metrics Enhancement (Previously Completed - August 26, 2025)

#### Pod Name Synchronization Critical Fix

- **Problem**: When subscription upgrades triggered Kubernetes rolling updates, new pods got different names but database stored old pod names
- **Root Cause**: Pod selection logic filtered for "Running" pods only, missing newly created pods in "Creating" or "Pending" state
- **Location**: [`src/services/k8s/provisioning.service.js:439-450`](src/services/k8s/provisioning.service.js:439) - Enhanced updateServiceInstance method
- **Solution Applied**:
  1. **Status-Agnostic Selection**: Removed filtering for "Running" pods only
  2. **Timestamp-Based Selection**: Always selects newest pod by creation timestamp regardless of status
  3. **Smart Timing**: Added 3-second delay after deployment ready to allow new pod creation
  4. **Database Sync**: Automatically updates pod name in database after subscription upgrades
- **Maintenance Function**: [`src/services/k8s/provisioning.service.js:738-748`](src/services/k8s/provisioning.service.js:738) - refreshInstancePodName for manual synchronization
- **Result**: Database pod names now always reflect current Kubernetes pod names after rolling updates

#### Subscription Metrics Endpoint Implementation

- **New Endpoint**: `GET /api/subscriptions/:subscriptionId/metrics` - Real-time metrics for frontend polling
- **Controller**: [`src/controllers/subscription.controller.js:316-420`](src/controllers/subscription.controller.js:316) - Complete metrics endpoint with simplified response
- **Route**: [`src/routes/subscription.routes.js:47-51`](src/routes/subscription.routes.js:47) - JWT-authenticated metrics route
- **Features**:
  - **Pre-calculated Percentages**: CPU and memory usage as percentages (usage/limit \* 100)
  - **Simple Units**: CPU in millicores, memory in MB
  - **Clean Structure**: Only essential data for dashboard display
  - **Real-time Ready**: Perfect for 5-10 second polling intervals
  - **Error Handling**: Graceful handling of missing instances or K8s unavailability
- **Response Structure**:
  ```json
  {
    "instanceId": "cmeslquw90007vv4azb9pes44",
    "status": "RUNNING",
    "cpu": { "used": 7, "limit": 500, "percentage": 1 },
    "memory": { "used": 225.93, "limit": 1024, "percentage": 22 },
    "urls": { "public": "https://...", "admin": "https://..." },
    "timestamp": "2025-08-26T14:13:37Z"
  }
  ```
- **Testing**: [`rest/subscription.rest:363-445`](rest/subscription.rest:363) - Comprehensive test suite with polling simulation

### Phase 3.5: Architecture Modernization & Advanced Features (Previously Completed)

#### Class-to-Const Architecture Conversion

- **Scope**: Comprehensive modernization of 9 core files from class-based to const-based architecture
- **Files Converted**:
  - [`src/controllers/subscription.controller.js`](src/controllers/subscription.controller.js:1) - User subscription management with metrics endpoint
  - [`src/controllers/wallet.controller.js`](src/controllers/wallet.controller.js:1) - Wallet and payment operations
  - [`src/controllers/admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:1) - Admin subscription management
  - [`src/services/payment/midtrans.service.js`](src/services/payment/midtrans.service.js:1) - Payment gateway integration
  - [`src/services/catalog.service.js`](src/services/catalog.service.js:1) - Service catalog management
  - [`src/services/credit.service.js`](src/services/credit.service.js:1) - Credit and billing operations
  - [`src/services/quota.service.js`](src/services/quota.service.js:1) - Quota management system
  - [`src/services/transaction.service.js`](src/services/transaction.service.js:1) - Transaction handling
  - [`src/services/subscription.service.js`](src/services/subscription.service.js:1) - Subscription business logic with reactivation
- **Pattern**: Converted from `class ClassName { async method() {} }` to `const methodName = async (params) => {}`
- **Benefits**: Improved consistency, modern JavaScript patterns, better maintainability

#### Enhanced Admin Subscription Features

- **Subscription Expiration**: Added admin endpoint to manually expire subscriptions (updated from suspend)
- **Advanced Force Cancel**: Enhanced force cancel with prorated refund options and immediate termination
- **Flexible Termination**: Admin can choose between immediate termination or natural expiration
- **Instance Management**: Automatic service instance termination on force cancel
- **Audit Trail**: Complete logging of all admin actions with reasons and timestamps

#### Database Schema Improvements

- **Unique Constraint Resolution**: Removed `@@unique([userId, serviceId])` constraint to allow re-subscriptions
- **Migration**: [`prisma/migrations/20250825025300_remove_unique_user_service_constraint`](prisma/migrations/20250825025300_remove_unique_user_service_constraint/migration.sql:1)
- **Business Logic Update**: Application-level validation now checks only active subscriptions
- **Re-subscription Support**: Users can now re-subscribe to services after cancellation (with intelligent reactivation)

#### Custom Transaction ID System Implementation

- **Format**: Implemented TXMP-XXX format (e.g., TXMP-101, TXMP-102) with auto-increment
- **Database Migration**: [`prisma/migrations/20250825031600_custom_transaction_id`](prisma/migrations/20250825031600_custom_transaction_id/migration.sql:1)
- **PostgreSQL Sequence**: Created `transaction_id_seq` starting from 101 for reliable auto-increment
- **Utility Service**: [`src/utils/transactionId.js`](src/utils/transactionId.js:1) with generation, validation, and extraction functions
- **Schema Update**: Added `customId String @unique` field to Transaction model
- **Service Integration**: Updated all transaction creation across credit, payment, and admin services
- **Testing**: Verified sequential increment and format validation (TXMP-105, TXMP-106, etc.)
