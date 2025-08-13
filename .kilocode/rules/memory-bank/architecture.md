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

- [`src/services/catalog.service.js`](src/services/catalog.service.js:1) - Service catalog management and browsing
- [`src/services/quota.service.js`](src/services/quota.service.js:1) - Simplified quota management system
- [`src/services/credit.service.js`](src/services/credit.service.js:1) - Credit balance and wallet management
- [`src/services/subscription.service.js`](src/services/subscription.service.js:1) - Subscription lifecycle management
- [`src/services/transaction.service.js`](src/services/transaction.service.js:1) - Transaction handling and reporting
- [`src/services/payment/midtrans.service.js`](src/services/payment/midtrans.service.js:1) - Midtrans payment integration

### Payment Integration

- [`src/config/midtrans.js`](src/config/midtrans.js:1) - Midtrans payment gateway configuration

### Kubernetes Integration

- [`src/config/kubernetes.js`](src/config/kubernetes.js:1) - K8s client initialization and management
- [`src/controllers/k8s/`](src/controllers/k8s/) - K8s resource controllers (pods, deployments, nodes, namespaces, ingresses, services)
- [`src/services/k8s/`](src/services/k8s/) - K8s business logic, metrics collection, and network monitoring

### Database Layer

- [`prisma/schema.prisma`](prisma/schema.prisma:1) - Complete database schema with service catalog models
- [`src/utils/prisma.js`](src/utils/prisma.js:1) - Prisma client instance
- [`prisma/seed.js`](prisma/seed.js:1) - Comprehensive seed data with service catalog

### Utilities

- [`src/utils/response.js`](src/utils/response.js:1) - Standardized API response formatting
- [`src/utils/logger.js`](src/utils/logger.js:1) - Winston logging configuration

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
- **Transaction Model**: Complete transaction tracking with Midtrans payment methods
- **ServiceInstance Model**: Kubernetes instance management linked to subscriptions

### Database Design

- **User Model**: Enhanced with credit fields (creditBalance, totalTopUp, totalSpent)
- **RefreshToken Model**: Secure token management with expiration
- **Service Catalog Models**: Complete schema for PaaS service management
- **Credit System**: Transaction-based credit management with audit trail
- **Cascade Deletion**: Proper relationship management across all models

### Kubernetes Integration

- **Dual Environment Support**: In-cluster config for production, local kubeconfig for development
- **Metrics Collection**: Real-time CPU and memory usage via Kubernetes Metrics API
- **Network Monitoring**: Complete ingress and service monitoring with detailed configuration data
- **Multi-API Support**: CoreV1Api, AppsV1Api, NetworkingV1Api, and MetricsV1beta1Api clients
- **Error Handling**: Graceful degradation when K8s cluster is unavailable
- **Multi-namespace Support**: Cross-namespace resource monitoring

### Credit-Based Billing System

- **Credit Management**: Real-time balance tracking with transaction history
- **Payment Integration**: Midtrans gateway with multiple payment methods (Bank Transfer, E-Wallet, Credit Card, QRIS)
- **Transaction Types**: TOP_UP, SUBSCRIPTION, UPGRADE, REFUND, ADMIN_ADJUSTMENT
- **Automated Processing**: Webhook handling for payment notifications
- **Audit Trail**: Complete transaction logging with balance snapshots

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
- **Business Logic Separation**: Clean service layer architecture

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

1. User selects plan → Subscription Controller (to be implemented)
2. Validation → [`subscription.service.js`](src/services/subscription.service.js:189) → `validateSubscription()`
3. Credit check → [`credit.service.js`](src/services/credit.service.js:6) → `checkSufficientCredit()`
4. Quota allocation → [`quota.service.js`](src/services/quota.service.js:46) → `allocateQuota()`
5. Credit deduction → [`credit.service.js`](src/services/credit.service.js:25) → `deductCredit()`
6. Subscription created → Database transaction → Success response

### Payment Processing Flow

1. User initiates top-up → Wallet Controller (to be implemented)
2. Controller calls → [`midtrans.service.js`](src/services/payment/midtrans.service.js:15) → `createTopUpTransaction()`
3. Midtrans API → Payment page → User completes payment
4. Webhook notification → [`midtrans.service.js`](src/services/payment/midtrans.service.js:129) → `handleNotification()`
5. Credit added → [`credit.service.js`](src/services/credit.service.js:58) → `addCredit()`

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

### Subscription Management Path

Subscription Routes (to be implemented) → Subscription Controller (to be implemented) → [`subscription.service.js`](src/services/subscription.service.js:15) → [`credit.service.js`](src/services/credit.service.js:25) + [`quota.service.js`](src/services/quota.service.js:46)

### Payment Processing Path

Wallet Routes (to be implemented) → Wallet Controller (to be implemented) → [`midtrans.service.js`](src/services/payment/midtrans.service.js:15) → Midtrans API

### Protected Route Access

[`routes/*`] → [`auth.js`](src/middleware/auth.js:6) → [`auth.service.js`](src/services/auth.service.js:189) → Controller

### K8s Resource Monitoring

[`k8s.routes.js`] → [`k8s.controller.js`] → [`k8s.service.js`] → [`kubernetes.js`](src/config/kubernetes.js:46) → K8s API

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
