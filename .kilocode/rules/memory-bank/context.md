# Current Context

## Current Work Focus

The backend API has **completed Phase 4: Service Provisioning & Instance Management** with full Kubernetes integration for automated service deployment. The project now has a complete end-to-end platform from user registration to service provisioning with comprehensive subscription management, payment processing, and Kubernetes orchestration.

**Recent Major Updates (August 2025):**

- **Phase 4 Completion**: Full Kubernetes service provisioning and instance management system
- **Production-Ready Deployment**: Robust service deployment with comprehensive error handling
- **Kubernetes Integration**: Complete automation of service lifecycle management
- **End-to-End Testing**: Verified subscription-to-deployment workflow
- **Architecture Modernization**: Completed comprehensive class-to-const conversion across 9 core files
- **Enhanced Admin Features**: Added subscription expiration and advanced force-cancel capabilities
- **Database Schema Improvements**: Resolved unique constraint issues and implemented custom transaction IDs
- **Transaction System Enhancement**: Implemented TXMP-XXX format with PostgreSQL sequence-based auto-increment

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

**Phase 3: Subscription Management API (Just Completed):**

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

**Phase 4: Service Provisioning & Instance Management (Just Completed):**

- **Kubernetes Provisioning Service**: Complete automated service deployment system
- **Service Instance Management**: Full lifecycle management with 6 endpoints
- **Health Monitoring System**: Real-time service health checks and status monitoring
- **Deployment Automation**: Robust Kubernetes resource creation and management
- **Error Handling**: Comprehensive debugging and error recovery mechanisms
- **Resource Cleanup**: Automatic termination on subscription cancellation
- **End-to-End Integration**: Verified subscription-to-deployment workflow
- **Production Readiness**: Battle-tested deployment logic with extensive debugging

### 🔄 Current State

- **Environment**: Development setup with local PostgreSQL database and K3s cluster integration
- **Database**: Enhanced schema with Int currency fields for IDR precision and custom transaction IDs
- **Core Services**: All 6 services modernized with const-based architecture and tested
- **Payment Integration**: Midtrans fully operational with webhook processing and custom transaction IDs
- **Wallet System**: Production-ready with comprehensive error handling
- **Subscription System**: Complete user and admin subscription management with advanced features
- **Kubernetes Integration**: Full service provisioning and instance management operational
- **Architecture**: Modernized codebase with consistent const-based patterns
- **Transaction System**: Custom TXMP-XXX ID format with PostgreSQL sequence auto-increment
- **Progress**: 100% complete - All core platform features implemented

## Next Steps

### Future Enhancements (Phase 5+)

1. **Domain Management**: Custom domain and SSL certificate management
2. **Auto-scaling**: Dynamic resource scaling based on usage patterns
3. **Advanced Monitoring**: Enhanced metrics collection and alerting
4. **Multi-region Support**: Geographic distribution of services

### Optional Enhancements

- **Admin Dashboard**: Management interfaces and analytics
- **Advanced Multi-tenancy**: Enhanced tenant isolation and management
- **Service Mesh Integration**: Istio/Linkerd for advanced networking
- **Backup & Recovery**: Automated backup systems for user data

## Key Decisions Made

- **Database**: PostgreSQL chosen for reliability and ACID compliance
- **ORM**: Prisma selected for type safety and developer experience
- **Authentication**: JWT with refresh tokens for security and scalability
- **K8s Client**: Official Kubernetes JavaScript client for cluster integration
- **Architecture**: Clean separation of controllers, services, and utilities
- **Currency Storage**: Int fields for IDR to avoid decimal precision issues

## Recent Implementation History

### Phase 4: Service Provisioning & Instance Management (Just Completed)

#### Kubernetes Provisioning System Implementation

- **Location**: [`src/services/k8s/provisioning.service.js`](src/services/k8s/provisioning.service.js:1) - Complete service provisioning logic
- **Features**: Automated deployment of N8N, Ghost, PostgreSQL, and other services with full Kubernetes integration
- **Architecture**: Robust error handling, deployment readiness checks, and resource cleanup
- **Integration**: Seamless integration with subscription system for automatic provisioning

#### Service Instance Management API

- **Location**: [`src/controllers/instance.controller.js`](src/controllers/instance.controller.js:1), [`src/routes/instance.routes.js`](src/routes/instance.routes.js:1), [`src/validations/instance.validation.js`](src/validations/instance.validation.js:1)
- **Features**: Complete instance lifecycle management with 6 endpoints
- **API Routes**: All routes under `/api/instances/*` with JWT authentication required
- **Testing**: [`rest/instance.rest`](rest/instance.rest:1) - Comprehensive test cases for all instance operations

#### Kubernetes Helper Utilities

- **Location**: [`src/utils/k8s-helper.js`](src/utils/k8s-helper.js:1) - Core Kubernetes API operations
- **Features**: Robust resource creation, deletion, and status checking with comprehensive error handling
- **Deployment Readiness**: Industry best-practice readiness checks using deployment status conditions
- **Error Recovery**: JSON error parsing and graceful failure handling

#### Kubernetes Templates System

- **Location**: [`src/config/k8s-templates.js`](src/config/k8s-templates.js:1) - Kubernetes manifest generation
- **Features**: Dynamic manifest creation for services with proper resource allocation
- **Configuration**: Health probes, environment variables, and K3s-specific settings
- **Resource Management**: Optimized memory allocation and storage configuration

#### Health Monitoring System

- **Location**: [`src/services/k8s/health.service.js`](src/services/k8s/health.service.js:1), [`src/controllers/admin/health.controller.js`](src/controllers/admin/health.controller.js:1)
- **Features**: Real-time service health monitoring with detailed status reporting
- **API Routes**: Admin-only health monitoring endpoints
- **Testing**: [`rest/admin/health.rest`](rest/admin/health.rest:1) - Health monitoring test cases

#### Critical Issues Resolved During Implementation

- **Kubernetes API Parameter Formatting**: Fixed object parameter format for all API calls
- **Error Structure Parsing**: Implemented JSON parsing for Kubernetes API error responses
- **Invalid Label Values**: Corrected label generation using service.slug instead of service.name
- **StorageClass Configuration**: Updated to "local-path" for K3s compatibility
- **Health Probe Configuration**: Corrected endpoints and timing for n8n services
- **Memory Allocation**: Doubled memory limits to prevent OOMKilled errors
- **Deployment Readiness Logic**: Implemented industry best-practice status condition checking
- **Resource Cleanup Integration**: Unified subscription cancellation with Kubernetes resource termination

#### End-to-End Integration

- **Subscription Integration**: Automatic service provisioning on subscription creation
- **Cancellation Integration**: Immediate resource cleanup on subscription cancellation
- **Admin Controls**: Enhanced admin endpoints with Kubernetes resource management
- **Testing Verification**: Complete end-to-end workflow testing from subscription to deployment

### Phase 3.5: Architecture Modernization & Advanced Features (Previously Completed)

#### Class-to-Const Architecture Conversion

- **Scope**: Comprehensive modernization of 9 core files from class-based to const-based architecture
- **Files Converted**:
  - [`src/controllers/subscription.controller.js`](src/controllers/subscription.controller.js:1) - User subscription management
  - [`src/controllers/wallet.controller.js`](src/controllers/wallet.controller.js:1) - Wallet and payment operations
  - [`src/controllers/admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:1) - Admin subscription management
  - [`src/services/payment/midtrans.service.js`](src/services/payment/midtrans.service.js:1) - Payment gateway integration
  - [`src/services/catalog.service.js`](src/services/catalog.service.js:1) - Service catalog management
  - [`src/services/credit.service.js`](src/services/credit.service.js:1) - Credit and billing operations
  - [`src/services/quota.service.js`](src/services/quota.service.js:1) - Quota management system
  - [`src/services/transaction.service.js`](src/services/transaction.service.js:1) - Transaction handling
  - [`src/services/subscription.service.js`](src/services/subscription.service.js:1) - Subscription business logic
- **Pattern**: Converted from `class ClassName { async method() {} }` to `const methodName = async (params) => {}`
- **Benefits**: Improved consistency, modern JavaScript patterns, better maintainability

#### Enhanced Admin Subscription Features

- **Subscription Expiration**: Added admin endpoint to manually expire subscriptions
- **Advanced Force Cancel**: Enhanced force cancel with prorated refund options and immediate termination
- **Flexible Termination**: Admin can choose between immediate termination or natural expiration
- **Instance Management**: Automatic service instance termination on force cancel
- **Audit Trail**: Complete logging of all admin actions with reasons and timestamps

#### Database Schema Improvements

- **Unique Constraint Resolution**: Removed `@@unique([userId, serviceId])` constraint to allow re-subscriptions
- **Migration**: [`prisma/migrations/20250825025300_remove_unique_user_service_constraint`](prisma/migrations/20250825025300_remove_unique_user_service_constraint/migration.sql:1)
- **Business Logic Update**: Application-level validation now checks only active subscriptions
- **Re-subscription Support**: Users can now re-subscribe to services after cancellation

#### Custom Transaction ID System Implementation

- **Format**: Implemented TXMP-XXX format (e.g., TXMP-101, TXMP-102) with auto-increment
- **Database Migration**: [`prisma/migrations/20250825031600_custom_transaction_id`](prisma/migrations/20250825031600_custom_transaction_id/migration.sql:1)
- **PostgreSQL Sequence**: Created `transaction_id_seq` starting from 101 for reliable auto-increment
- **Utility Service**: [`src/utils/transactionId.js`](src/utils/transactionId.js:1) with generation, validation, and extraction functions
- **Schema Update**: Added `customId String @unique` field to Transaction model
- **Service Integration**: Updated all transaction creation across credit, payment, and admin services
- **Testing**: Verified sequential increment and format validation (TXMP-105, TXMP-106, etc.)

### Phase 3: Subscription Management API Implementation (Previously Completed)

#### User Subscription System Architecture

- **Location**: [`src/controllers/subscription.controller.js`](src/controllers/subscription.controller.js:1), [`src/routes/subscription.routes.js`](src/routes/subscription.routes.js:1), [`src/validations/subscription.validation.js`](src/validations/subscription.validation.js:1)
- **Features**: Complete user subscription management with 6 endpoints covering subscription creation, upgrade, cancellation, and management
- **API Routes**: All routes under `/api/subscriptions/*` with JWT authentication required
- **Testing**: [`rest/subscription.rest`](rest/subscription.rest:1) - 28 comprehensive test cases covering all user scenarios

#### Admin Subscription Management System

- **Location**: [`src/controllers/admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:1), [`src/routes/admin/subscription.routes.js`](src/routes/admin/subscription.routes.js:1), [`src/validations/admin/subscription.validation.js`](src/validations/admin/subscription.validation.js:1)
- **Features**: Complete admin subscription management with 7 endpoints covering user subscription creation, management, refunds, extensions, and upgrades
- **API Routes**: All routes under `/api/admin/subscriptions/*` with ADMINISTRATOR role required
- **Testing**: [`rest/admin/subscription.rest`](rest/admin/subscription.rest:1) - 41 comprehensive test cases covering all admin scenarios

#### Critical Prisma Decimal Arithmetic Bug (Fixed)

- **Issue**: `462,000 + 150,000 = 462,000.150,000` concatenation instead of addition
- **Root Cause**: Prisma Decimal arithmetic causing string concatenation instead of mathematical addition
- **Location**: [`src/services/payment/midtrans.service.js`](src/services/payment/midtrans.service.js:205) - Credit balance updates
- **Solution Applied**:
  1. **Database Migration**: Converted all currency fields from DECIMAL to Int for IDR precision
  2. **Migration**: Applied `20250824161700_change_currency_to_int` migration successfully
  3. **Service Updates**: Updated all services to handle Int currency values
  4. **Data Cleanup**: Created [`scripts/fix-contaminated-balance.js`](scripts/fix-contaminated-balance.js:1) to fix corrupted data
- **Result**: All currency operations now work correctly with proper mathematical addition

#### Subscription Controller Validation Error (Fixed)

- **Issue**: `getValidationStatusCode is not defined` error in subscription controller
- **Root Cause**: Imported validation helper function that didn't exist
- **Location**: [`src/controllers/subscription.controller.js`](src/controllers/subscription.controller.js:1)
- **Solution**: Converted to standalone validation function within controller
- **Result**: All subscription endpoints now validate properly

#### Admin Routes Middleware Error (Fixed)

- **Issue**: `requireAdmin is not defined` import error in admin routes
- **Root Cause**: Attempted to import non-existent middleware function
- **Location**: [`src/routes/admin/subscription.routes.js`](src/routes/admin/subscription.routes.js:1)
- **Solution**: Used existing `authorizeRoles("ADMINISTRATOR")` middleware pattern
- **Result**: All admin routes now properly authenticate and authorize

#### Bonus Subscription System Implementation

- **Feature**: Admin capability to create free subscriptions for users
- **Implementation**: `skipCreditCheck` option in subscription service bypasses credit validation and deduction
- **Audit Trail**: Creates IDR 0 transaction records with custom admin reason for proper tracking
- **Location**: [`src/services/subscription.service.js`](src/services/subscription.service.js:15) - Enhanced createSubscription method
- **Admin Endpoint**: `POST /api/admin/subscriptions` with `skipCreditCheck: true` option

#### Admin Upgrade Subscription System Implementation

- **Feature**: Admin capability to upgrade user subscriptions with bonus upgrade support
- **Implementation**: Enhanced `upgradeSubscription` method with `skipCreditCheck` and `customDescription` options
- **Bonus Upgrades**: Admin can upgrade users without credit validation, creating IDR 0 audit trail
- **Location**: [`src/services/subscription.service.js`](src/services/subscription.service.js:196) - Enhanced upgradeSubscription method
- **Admin Endpoint**: `PUT /api/admin/subscriptions/:subscriptionId/upgrade` with bonus upgrade capability
- **Controller**: [`src/controllers/admin/subscription.controller.js`](src/controllers/admin/subscription.controller.js:650) - upgradeSubscriptionForUser method

#### Subscription Cancellation Policy Update

- **Business Logic Change**: Updated cancellation to disable auto-renew only, keeping service active until end date
- **No Automatic Refunds**: Refunds are now admin-only operations for better financial control
- **User Experience**: Users keep service access for remaining subscription period
- **Location**: [`src/services/subscription.service.js`](src/services/subscription.service.js:407) - cancelSubscription method

#### Comprehensive Business Logic Implementation

- **Upgrade-Only Policy**: Users can only upgrade to higher tier plans, no downgrades
- **Same Service Restriction**: Upgrades must be within the same service category
- **Prorated Billing**: Upgrade costs calculated based on remaining subscription days
- **Quota Management**: Automatic quota allocation/release during subscription changes
- **Transaction Audit**: Complete transaction history for all subscription operations

### Phase 2.2: Wallet Management API Implementation (Previously Completed)

#### Wallet System Architecture

- **Location**: [`src/controllers/wallet.controller.js`](src/controllers/wallet.controller.js:1), [`src/routes/wallet.routes.js`](src/routes/wallet.routes.js:1), [`src/validations/wallet.validation.js`](src/validations/wallet.validation.js:1)
- **Features**: Complete wallet management with 9 endpoints covering credit management, payment processing, and transaction handling
- **API Routes**: All routes under `/api/wallet/*` with JWT authentication required
- **Testing**: [`rest/wallet.rest`](rest/wallet.rest:1) - 28 comprehensive test cases covering all scenarios

#### Midtrans Integration Enhancements

- **Payment Methods**: Full support for Bank Transfer, E-Wallet, Credit Card, QRIS
- **Webhook Processing**: Robust notification handling with proper transaction status updates
- **Error Handling**: Comprehensive error logging and graceful failure handling
- **Transaction Lifecycle**: Complete status tracking from PENDING → COMPLETED/FAILED/CANCELLED

#### Validation System Improvements

- **CUID Support**: Fixed transaction ID validation from UUID to CUID format to match Prisma defaults
- **Comprehensive Schemas**: Joi validation for all wallet endpoints with proper error messages
- **Parameter Validation**: Fixed validation middleware integration with proper object structure

### Pod Service Response Structure (Previously Fixed)

- **Issue**: Pod API was returning duplicate container information
- **Location**: [`src/services/k8s/pod.service.js`](src/services/k8s/pod.service.js:91-130)
- **Solution**: Merged container spec info with metrics into unified structure
- **Result**: Single `containers[]` array with name, image, ready status, and usage metrics
- **Improvement**: Added `metricsTimestamp` and `metricsWindow` at pod level for better data context

### Kubernetes Network Monitoring (Previously Implemented)

#### Ingress Endpoint Implementation

- **Location**: [`src/services/k8s/ingress.service.js`](src/services/k8s/ingress.service.js:1), [`src/controllers/k8s/ingress.controller.js`](src/controllers/k8s/ingress.controller.js:1)
- **Features**: Complete ingress monitoring with rules, hosts, TLS configuration, and backend services
- **API**: `GET /api/admin/k8s/ingresses` - Admin-only endpoint for ingress resource monitoring
- **Testing**: [`rest/admin/k8s-ingresses.rest`](rest/admin/k8s-ingresses.rest:1) - REST client for endpoint testing

#### Service (Network) Endpoint Implementation

- **Location**: [`src/services/k8s/service.service.js`](src/services/k8s/service.service.js:1), [`src/controllers/k8s/service.controller.js`](src/controllers/k8s/service.controller.js:1)
- **Features**: Comprehensive service monitoring with ports, IPs, endpoints, and service types
- **API**: `GET /api/admin/k8s/services` - Admin-only endpoint for Kubernetes Services monitoring
- **Testing**: [`rest/admin/k8s-services.rest`](rest/admin/k8s-services.rest:1) - REST client for endpoint testing

#### Infrastructure Enhancements

- **Kubernetes Config**: Enhanced [`src/config/kubernetes.js`](src/config/kubernetes.js:1) with NetworkingV1Api client
- **Route Integration**: Updated [`src/routes/index.routes.js`](src/routes/index.routes.js:1) with new network endpoints
- **Consistent Architecture**: All new endpoints follow established controller-service-route patterns
