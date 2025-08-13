# Implementation Roadmap - Service Catalog with Quota System

## Overview

Roadmap ini menjelaskan langkah-langkah implementasi service catalog dengan quota system dan upgrade-only policy untuk PaaS platform MinisPod. Implementasi dibagi menjadi 6 fase dengan prioritas dan dependencies yang jelas.

## Phase 1: Database Schema & Core Models (Week 1-2)

### 1.1 Database Migration

**Priority: Critical**
**Estimated Time: 3-4 days**

```bash
# Tasks:
- Update prisma/schema.prisma with new service catalog models
- Create and run database migrations
- Update seed data with sample services and plans
- Test database constraints and relationships
```

**Files to Create/Modify:**

- `prisma/schema.prisma` - Add all service catalog models
- `prisma/migrations/` - New migration files
- `prisma/seed.js` - Sample data for testing
- `src/utils/prisma.js` - Update if needed for new models

**Deliverables:**

- ✅ Complete database schema with all tables
- ✅ Sample data for N8N, Ghost services with multiple plans
- ✅ Quota system tables with initial quotas
- ✅ Database constraints working properly

### 1.2 Core Service Layer

**Priority: Critical**
**Estimated Time: 2-3 days**

**Files to Create:**

- `src/services/catalog.service.js` - Service catalog business logic
- `src/services/quota.service.js` - Quota management logic
- `src/services/subscription.service.js` - Subscription management
- `src/validations/catalog.validation.js` - Joi validation schemas

**Key Functions to Implement:**

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
  // subscription.service.js
  createSubscription() -
  validateSubscription() -
  checkDuplicateSubscription();
```

## Phase 2: Public Catalog API (Week 2-3)

### 2.1 Public Catalog Endpoints

**Priority: High**
**Estimated Time: 3-4 days**

**Files to Create:**

- `src/controllers/catalog.controller.js` - Public catalog endpoints
- `src/routes/catalog.routes.js` - Catalog routes
- `src/middleware/cache.js` - Response caching middleware
- `rest/catalog.rest` - API testing file

**Endpoints to Implement:**

```http
GET /api/catalog/categories
GET /api/catalog/categories/:categorySlug/services
GET /api/catalog/services/:serviceSlug
GET /api/catalog/search
```

**Features:**

- Response caching for better performance
- Real-time quota availability
- Service filtering and search
- Pagination support

### 2.2 Admin Service Management

**Priority: High**
**Estimated Time: 2-3 days**

**Files to Create:**

- `src/controllers/admin/service.controller.js` - Admin service management
- `src/routes/admin/service.routes.js` - Admin service routes
- `rest/admin/services.rest` - Admin API testing

**Endpoints to Implement:**

```http
GET /api/admin/services
POST /api/admin/services
PUT /api/admin/services/:serviceId
DELETE /api/admin/services/:serviceId
GET /api/admin/services/:serviceId/plans
POST /api/admin/services/:serviceId/plans
PUT /api/admin/services/:serviceId/plans/:planId
```

## Phase 3: User Subscription System (Week 3-4)

### 3.1 Basic Subscription Flow

**Priority: Critical**
**Estimated Time: 4-5 days**

**Files to Create:**

- `src/controllers/user/subscription.controller.js` - User subscription management
- `src/routes/user/subscription.routes.js` - User subscription routes
- `src/services/provisioning.service.js` - Basic provisioning logic
- `rest/user/subscriptions.rest` - User API testing

**Core Features:**

- Duplicate subscription detection
- Quota validation before subscription
- Basic subscription creation
- Subscription listing and details

**Business Logic:**

```javascript
// Subscription validation flow
1. Check if user already has subscription for service
2. If exists, return error with upgrade suggestion
3. Check quota availability for selected plan
4. Process payment (mock for now)
5. Create subscription and allocate quota
```

### 3.2 Instance Management

**Priority: High**
**Estimated Time: 3-4 days**

**Files to Create:**

- `src/controllers/user/instance.controller.js` - Instance management
- `src/routes/user/instance.routes.js` - Instance routes
- `src/services/instance.service.js` - Instance business logic

**Features:**

- List user instances
- Instance details with resource usage
- Basic instance configuration updates
- Instance status tracking

## Phase 4: Kubernetes Integration (Week 4-6)

### 4.1 Basic Kubernetes Provisioning

**Priority: Critical**
**Estimated Time: 5-6 days**

**Files to Create:**

- `src/services/k8s/provisioning.service.js` - K8s provisioning logic
- `src/config/k8s-templates.js` - Kubernetes resource templates
- `src/utils/k8s-helper.js` - Kubernetes utility functions

**Integration Points:**

- Extend existing `src/config/kubernetes.js`
- Use existing K8s monitoring services
- Integrate with current pod monitoring

**Core Features:**

```javascript
// Provisioning workflow
1. Create user namespace if not exists
2. Generate unique subdomain
3. Create ConfigMap with environment variables
4. Create PVC for persistent storage
5. Create Deployment with resource limits
6. Create Service for internal networking
7. Create Ingress for external access
8. Wait for pod ready status
9. Update instance status in database
```

### 4.2 Resource Management

**Priority: High**
**Estimated Time: 3-4 days**

**Features:**

- Resource quota enforcement
- Dynamic resource scaling based on plan
- Storage management
- Network configuration

**Integration with Existing K8s Monitoring:**

- Leverage existing pod metrics collection
- Extend current monitoring for user instances
- Resource usage tracking and alerts

## Phase 5: Upgrade System (Week 6-7)

### 5.1 Upgrade Logic Implementation

**Priority: High**
**Estimated Time: 4-5 days**

**Files to Create:**

- `src/services/upgrade.service.js` - Upgrade business logic
- `src/controllers/user/upgrade.controller.js` - Upgrade endpoints

**Core Features:**

```javascript
// Upgrade workflow
1. Validate upgrade path (only to higher tiers)
2. Check new plan quota availability
3. Calculate prorated billing
4. Process payment difference
5. Update Kubernetes resources
6. Release old quota, allocate new quota
7. Update subscription records
8. Handle rollback if needed
```

### 5.2 Billing Integration Preparation

**Priority: Medium**
**Estimated Time: 2-3 days**

**Files to Create:**

- `src/services/billing.service.js` - Basic billing calculations
- `src/utils/pricing.js` - Pricing utilities

**Features:**

- Prorated billing calculations
- Upgrade cost calculations
- Mock payment processing
- Billing history tracking

## Phase 6: Advanced Features (Week 7-8)

### 6.1 Health Monitoring & Alerts

**Priority: Medium**
**Estimated Time: 3-4 days**

**Files to Create:**

- `src/services/health-monitor.service.js` - Health monitoring
- `src/services/alert.service.js` - Alert system
- `src/jobs/health-check.job.js` - Scheduled health checks

**Features:**

- Periodic health checks for all instances
- Resource usage monitoring
- Automated alerts for unhealthy instances
- Integration with existing K8s monitoring

### 6.2 Analytics & Reporting

**Priority: Low**
**Estimated Time: 2-3 days**

**Files to Create:**

- `src/controllers/admin/analytics.controller.js` - Analytics endpoints
- `src/services/analytics.service.js` - Analytics business logic

**Features:**

- Subscription analytics
- Quota utilization reports
- Revenue tracking
- User behavior analytics

## Implementation Guidelines

### 1. Development Standards

**Code Structure:**

```
src/
├── controllers/
│   ├── catalog.controller.js
│   ├── admin/
│   │   ├── service.controller.js
│   │   └── analytics.controller.js
│   └── user/
│       ├── subscription.controller.js
│       ├── instance.controller.js
│       └── upgrade.controller.js
├── services/
│   ├── catalog.service.js
│   ├── quota.service.js
│   ├── subscription.service.js
│   ├── provisioning.service.js
│   ├── upgrade.service.js
│   └── k8s/
│       └── provisioning.service.js
├── routes/
│   ├── catalog.routes.js
│   ├── admin/
│   │   └── service.routes.js
│   └── user/
│       ├── subscription.routes.js
│       └── instance.routes.js
└── validations/
    ├── catalog.validation.js
    └── subscription.validation.js
```

**Testing Strategy:**

- Unit tests for all service functions
- Integration tests for API endpoints
- E2E tests for critical workflows
- Load testing for quota system

### 2. Error Handling Patterns

**Standard Error Codes:**

```javascript
const ERROR_CODES = {
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  DUPLICATE_SUBSCRIPTION: "DUPLICATE_SUBSCRIPTION",
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  INVALID_PLAN: "INVALID_PLAN",
  PROVISIONING_FAILED: "PROVISIONING_FAILED",
  INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
};
```

**Error Response Format:**

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "No available quota for selected plan",
    "details": {
      "planName": "Pro",
      "availableQuota": 0,
      "totalQuota": 10
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 3. Performance Considerations

**Caching Strategy:**

- Redis cache for service catalog data
- Database query optimization
- API response caching for public endpoints

**Database Optimization:**

- Proper indexing for frequently queried fields
- Connection pooling
- Query optimization

**Kubernetes Performance:**

- Resource limits and requests
- Horizontal pod autoscaling
- Efficient resource allocation

## Testing Strategy

### 1. Unit Testing

**Tools:** Jest, Supertest
**Coverage:** All service functions, controllers, utilities
**Target:** 90% code coverage

### 2. Integration Testing

**Focus Areas:**

- API endpoint functionality
- Database operations
- Kubernetes integration
- Quota management workflows

### 3. Load Testing

**Tools:** Artillery, K6
**Scenarios:**

- Concurrent subscription requests
- Quota exhaustion scenarios
- Kubernetes provisioning under load

## Deployment Strategy

### 1. Environment Setup

```bash
# Development
- Local PostgreSQL database
- Local Kubernetes cluster (minikube/kind)
- Mock payment services

# Staging
- Staging database
- Staging K8s cluster
- Test payment integration

# Production
- Production database with replicas
- Production K8s cluster
- Real payment integration
```

### 2. Migration Strategy

```bash
# Phase 1: Database migration
npm run db:migrate

# Phase 2: Deploy new API endpoints
# Phase 3: Enable new features gradually
# Phase 4: Full rollout with monitoring
```

## Risk Mitigation

### 1. Technical Risks

- **Database Migration Issues**: Comprehensive testing, rollback plans
- **Kubernetes Integration**: Gradual rollout, fallback mechanisms
- **Quota Conflicts**: Database transactions, proper locking

### 2. Business Risks

- **Resource Over-allocation**: Conservative quota limits initially
- **User Experience**: Comprehensive testing, user feedback loops
- **Performance Issues**: Load testing, monitoring, scaling plans

## Success Metrics

### 1. Technical Metrics

- API response times < 200ms for catalog endpoints
- 99.9% uptime for provisioning services
- Minimal quota conflicts
- < 5 minute average provisioning time

### 2. Business Metrics

- Successful subscription conversion rate
- Upgrade adoption rate
- Customer satisfaction scores
- Resource utilization efficiency

## Timeline Summary

| Phase   | Duration | Key Deliverables                     |
| ------- | -------- | ------------------------------------ |
| Phase 1 | Week 1-2 | Database schema, core services       |
| Phase 2 | Week 2-3 | Public catalog API, admin management |
| Phase 3 | Week 3-4 | User subscription system             |
| Phase 4 | Week 4-6 | Kubernetes integration               |
| Phase 5 | Week 6-7 | Upgrade system                       |
| Phase 6 | Week 7-8 | Advanced features                    |

**Total Estimated Time: 8 weeks**

## Next Steps

1. **Immediate Actions:**

   - Review and approve this roadmap
   - Set up development environment
   - Begin Phase 1 implementation

2. **Team Coordination:**

   - Assign developers to specific phases
   - Set up regular progress reviews
   - Establish testing protocols

3. **Stakeholder Communication:**
   - Regular progress updates
   - Demo sessions after each phase
   - Feedback collection and incorporation

Roadmap ini memberikan struktur yang jelas untuk implementasi service catalog dengan quota system yang robust dan scalable.
