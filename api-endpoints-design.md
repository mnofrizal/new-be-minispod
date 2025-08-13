# API Endpoints Design - Service Catalog Management

## API Structure Overview

API endpoints akan mengikuti pola existing dengan struktur:

- Public endpoints: `/api/catalog/*` (untuk user browsing)
- User endpoints: `/api/user/services/*` (untuk user management)
- Admin endpoints: `/api/admin/services/*` (untuk admin management)

## 1. PUBLIC CATALOG ENDPOINTS

### Service Catalog Browsing (Public Access)

```http
# Get all service categories
GET /api/catalog/categories
Response: {
  success: true,
  data: [
    {
      id: "cat_123",
      name: "Development Tools",
      slug: "dev-tools",
      description: "Automation and development tools",
      icon: "https://...",
      serviceCount: 5
    }
  ]
}

# Get services by category
GET /api/catalog/categories/:categorySlug/services
Query params: ?featured=true&limit=10&offset=0
Response: {
  success: true,
  data: {
    services: [...],
    pagination: { total: 25, page: 1, limit: 10 }
  }
}

# Get service details with plans
GET /api/catalog/services/:serviceSlug
Response: {
  success: true,
  data: {
    id: "svc_123",
    name: "N8N Automation",
    slug: "n8n-automation",
    description: "...",
    longDescription: "...",
    icon: "...",
    version: "latest",
    category: { name: "Development Tools", slug: "dev-tools" },
    plans: [
      {
        id: "plan_123",
        name: "Free",
        planType: "FREE",
        monthlyPrice: 0,
        cpuMilli: 100,
        memoryMb: 128,
        storageGb: 1,
        availableQuota: 15, // Calculated as totalQuota - usedQuota
        totalQuota: 20,
        features: ["Basic automation", "5 workflows"],
        isPopular: false
      },
      {
        id: "plan_124",
        name: "Pro",
        planType: "PRO",
        monthlyPrice: 150000,
        cpuMilli: 500,
        memoryMb: 512,
        storageGb: 5,
        availableQuota: 8, // Calculated as totalQuota - usedQuota
        totalQuota: 10,
        features: ["Advanced automation", "Unlimited workflows", "Custom domains"],
        isPopular: true
      }
    ],
    minRequirements: {
      cpuMilli: 100,
      memoryMb: 128,
      storageGb: 1
    }
  }
}

# Search services
GET /api/catalog/search
Query params: ?q=automation&category=dev-tools&minPrice=0&maxPrice=200000
Response: {
  success: true,
  data: {
    services: [...],
    filters: {
      categories: [...],
      priceRanges: [...],
      features: [...]
    }
  }
}
```

## 2. USER SERVICE MANAGEMENT ENDPOINTS

### User Subscription Management (Requires Authentication)

```http
# Get user's active subscriptions
GET /api/user/services/subscriptions
Headers: Authorization: Bearer <jwt_token>
Response: {
  success: true,
  data: [
    {
      id: "sub_123",
      service: {
        name: "N8N Automation",
        slug: "n8n-automation",
        icon: "..."
      },
      plan: {
        name: "Basic",
        planType: "BASIC",
        monthlyPrice: 50000
      },
      status: "ACTIVE",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-02-01T00:00:00Z",
      autoRenew: true,
      instances: [
        {
          id: "inst_123",
          name: "My N8N Instance",
          subdomain: "myn8n.minispod.com",
          status: "RUNNING",
          publicUrl: "https://myn8n.minispod.com"
        }
      ]
    }
  ]
}

# Subscribe to a service (with quota check and upgrade detection)
POST /api/user/services/subscribe
Headers: Authorization: Bearer <jwt_token>
Body: {
  serviceId: "svc_123",
  planId: "plan_124",
  instanceName: "My N8N Instance", // Optional, auto-generated if not provided
  customDomain: "myapp.example.com" // Optional
}
Response: {
  success: true,
  data: {
    subscriptionId: "sub_124",
    message: "Service subscribed successfully",
    instance: {
      id: "inst_124",
      subdomain: "myn8n-2.minispod.com",
      status: "PROVISIONING"
    }
  }
}
# Error responses:
# 409 - User already has subscription for this service (must upgrade)
# 422 - No quota available for selected plan
# 400 - Invalid plan or service

# Upgrade existing subscription
PUT /api/user/services/subscriptions/:subscriptionId/upgrade
Headers: Authorization: Bearer <jwt_token>
Body: {
  newPlanId: "plan_125"
}
Response: {
  success: true,
  data: {
    subscriptionId: "sub_124",
    message: "Subscription upgraded successfully",
    oldPlan: { name: "Basic", monthlyPrice: 50000 },
    newPlan: { name: "Pro", monthlyPrice: 150000 },
    effectiveDate: "2024-01-15T00:00:00Z",
    proratedAmount: 75000
  }
}

# Cancel subscription
DELETE /api/user/services/subscriptions/:subscriptionId
Headers: Authorization: Bearer <jwt_token>
Query params: ?immediate=false (default: cancel at end of billing period)
Response: {
  success: true,
  data: {
    message: "Subscription cancelled successfully",
    effectiveDate: "2024-02-01T00:00:00Z", // End of current billing period
    refundAmount: 0 // If immediate=true, calculate prorated refund
  }
}

# Get subscription details
GET /api/user/services/subscriptions/:subscriptionId
Headers: Authorization: Bearer <jwt_token>
Response: {
  success: true,
  data: {
    // Full subscription details with billing history, instances, etc.
  }
}
```

### Service Instance Management

```http
# Get user's service instances
GET /api/user/services/instances
Headers: Authorization: Bearer <jwt_token>
Query params: ?status=RUNNING&service=n8n-automation
Response: {
  success: true,
  data: [
    {
      id: "inst_123",
      name: "My N8N Instance",
      service: { name: "N8N Automation", slug: "n8n-automation" },
      subdomain: "myn8n.minispod.com",
      status: "RUNNING",
      healthStatus: "healthy",
      publicUrl: "https://myn8n.minispod.com",
      adminUrl: "https://myn8n.minispod.com/admin",
      customDomain: null,
      sslEnabled: true,
      resourceUsage: {
        cpuUsage: 45.2,
        memoryUsage: 256.8,
        storageUsage: 1.2
      },
      lastHealthCheck: "2024-01-15T10:30:00Z",
      createdAt: "2024-01-01T00:00:00Z"
    }
  ]
}

# Get instance details
GET /api/user/services/instances/:instanceId
Headers: Authorization: Bearer <jwt_token>
Response: {
  success: true,
  data: {
    // Full instance details with metrics, logs, configuration
  }
}

# Update instance configuration
PUT /api/user/services/instances/:instanceId
Headers: Authorization: Bearer <jwt_token>
Body: {
  name: "Updated Instance Name",
  customDomain: "myapp.example.com",
  envVars: {
    "CUSTOM_VAR": "value"
  }
}
Response: {
  success: true,
  data: {
    message: "Instance updated successfully",
    instance: { /* updated instance data */ }
  }
}

# Start/Stop instance
POST /api/user/services/instances/:instanceId/start
POST /api/user/services/instances/:instanceId/stop
Headers: Authorization: Bearer <jwt_token>
Response: {
  success: true,
  data: {
    message: "Instance started/stopped successfully",
    status: "RUNNING" // or "STOPPED"
  }
}

# Get instance logs (last 100 lines)
GET /api/user/services/instances/:instanceId/logs
Headers: Authorization: Bearer <jwt_token>
Query params: ?lines=100&since=1h
Response: {
  success: true,
  data: {
    logs: [
      {
        timestamp: "2024-01-15T10:30:00Z",
        level: "INFO",
        message: "Application started successfully"
      }
    ]
  }
}
```

## 3. ADMIN SERVICE MANAGEMENT ENDPOINTS

### Service Catalog Administration (Admin Only)

```http
# Get all services (admin view with quota info)
GET /api/admin/services
Headers: Authorization: Bearer <admin_jwt_token>
Query params: ?category=dev-tools&status=active&page=1&limit=20
Response: {
  success: true,
  data: {
    services: [
      {
        id: "svc_123",
        name: "N8N Automation",
        slug: "n8n-automation",
        category: { name: "Development Tools" },
        isActive: true,
        isPublic: true,
        totalSubscriptions: 45,
        totalInstances: 52,
        plans: [
          {
            id: "plan_123",
            name: "Free",
            totalQuota: 20,
            availableQuota: 15,
            usedQuota: 5,
            activeSubscriptions: 5
          }
        ],
        createdAt: "2024-01-01T00:00:00Z"
      }
    ],
    pagination: { total: 25, page: 1, limit: 20 }
  }
}

# Create new service
POST /api/admin/services
Headers: Authorization: Bearer <admin_jwt_token>
Body: {
  name: "Ghost Blog",
  slug: "ghost-blog",
  description: "Professional publishing platform",
  longDescription: "...",
  categoryId: "cat_123",
  dockerImage: "ghost:latest",
  defaultPort: 2368,
  minCpuMilli: 200,
  minMemoryMb: 256,
  minStorageGb: 2,
  envTemplate: {
    "NODE_ENV": "production",
    "database__client": "mysql"
  },
  isActive: true,
  isPublic: true
}
Response: {
  success: true,
  data: {
    id: "svc_124",
    message: "Service created successfully"
  }
}

# Update service
PUT /api/admin/services/:serviceId
Headers: Authorization: Bearer <admin_jwt_token>
Body: { /* same as create */ }

# Delete service (soft delete, check for active subscriptions)
DELETE /api/admin/services/:serviceId
Headers: Authorization: Bearer <admin_jwt_token>
Response: {
  success: true,
  data: {
    message: "Service deleted successfully"
  }
}
# Error: 409 if service has active subscriptions
```

### Service Plan Management

```http
# Get plans for a service
GET /api/admin/services/:serviceId/plans
Headers: Authorization: Bearer <admin_jwt_token>
Response: {
  success: true,
  data: [
    {
      id: "plan_123",
      name: "Free",
      planType: "FREE",
      monthlyPrice: 0,
      cpuMilli: 100,
      memoryMb: 128,
      storageGb: 1,
      totalQuota: 20,
      availableQuota: 15, // Calculated as totalQuota - usedQuota
      usedQuota: 5,
      activeSubscriptions: 5,
      isActive: true
    }
  ]
}

# Create service plan
POST /api/admin/services/:serviceId/plans
Headers: Authorization: Bearer <admin_jwt_token>
Body: {
  name: "Enterprise",
  planType: "ENTERPRISE",
  monthlyPrice: 500000,
  cpuMilli: 2000,
  memoryMb: 2048,
  storageGb: 20,
  totalQuota: 5,
  features: ["Dedicated resources", "24/7 support", "Custom domains"],
  maxInstancesPerUser: 3,
  isActive: true
}

# Update plan (including quota adjustments)
PUT /api/admin/services/:serviceId/plans/:planId
Headers: Authorization: Bearer <admin_jwt_token>
Body: {
  totalQuota: 25, // Increase quota
  monthlyPrice: 175000 // Price update
}

# Adjust quota manually
POST /api/admin/services/:serviceId/plans/:planId/quota/adjust
Headers: Authorization: Bearer <admin_jwt_token>
Body: {
  adjustment: 5, // +5 or -5
  reason: "Server capacity increased",
  adminNotes: "Added new server nodes"
}
```

### Quota Management & Monitoring

```http
# Get quota overview across all services
GET /api/admin/quota/overview
Headers: Authorization: Bearer <admin_jwt_token>
Response: {
  success: true,
  data: {
    totalQuota: 200,
    usedQuota: 145,
    availableQuota: 55, // Calculated as totalQuota - usedQuota
    utilizationRate: 72.5,
    services: [
      {
        serviceName: "N8N Automation",
        totalQuota: 45,
        usedQuota: 32,
        availableQuota: 13,
        utilizationRate: 71.1
      }
    ]
  }
}

# Get quota usage analytics (simplified)
GET /api/admin/quota/analytics
Headers: Authorization: Bearer <admin_jwt_token>
Query params: ?planId=plan_123&period=30d&limit=50
Response: {
  success: true,
  data: {
    quotaUsage: [
      {
        date: "2024-01-15",
        totalQuota: 20,
        usedQuota: 15,
        utilizationRate: 75.0
      }
    ],
    trends: {
      averageUtilization: 72.5,
      peakUtilization: 85.0,
      growthRate: 5.2
    }
  }
}

# Get subscription analytics
GET /api/admin/analytics/subscriptions
Headers: Authorization: Bearer <admin_jwt_token>
Query params: ?period=30d&groupBy=service
Response: {
  success: true,
  data: {
    totalSubscriptions: 145,
    activeSubscriptions: 132,
    newSubscriptions: 23,
    cancelledSubscriptions: 8,
    revenue: 15750000,
    breakdown: [
      {
        service: "N8N Automation",
        subscriptions: 45,
        revenue: 6750000,
        avgRevenuePerUser: 150000
      }
    ]
  }
}
```

## 4. WEBHOOK ENDPOINTS

### System Integration Webhooks

```http
# Kubernetes event webhook (internal)
POST /api/webhooks/k8s/events
Headers: X-Webhook-Secret: <secret>
Body: {
  eventType: "pod_status_changed",
  instanceId: "inst_123",
  status: "RUNNING",
  healthStatus: "healthy",
  resourceUsage: {
    cpuUsage: 45.2,
    memoryUsage: 256.8
  }
}

# Payment webhook (from payment provider)
POST /api/webhooks/payment/completed
Headers: X-Webhook-Secret: <secret>
Body: {
  subscriptionId: "sub_123",
  amount: 150000,
  currency: "IDR",
  status: "completed",
  transactionId: "txn_123"
}
```

## 5. ERROR HANDLING PATTERNS

### Standard Error Responses

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "No available quota for selected plan",
    "details": {
      "planName": "Pro",
      "availableQuota": 0,
      "totalQuota": 10,
      "waitlistAvailable": true
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

- `QUOTA_EXCEEDED` - No available quota
- `DUPLICATE_SUBSCRIPTION` - User already has subscription for service
- `UPGRADE_REQUIRED` - Must upgrade instead of new subscription
- `INSUFFICIENT_RESOURCES` - Plan resources below service minimum
- `INVALID_PLAN` - Plan not available or inactive
- `PROVISIONING_FAILED` - Kubernetes provisioning failed
- `PAYMENT_REQUIRED` - Payment needed before activation

## 6. RATE LIMITING & SECURITY

### Rate Limits

- Public catalog: 100 requests/minute per IP
- User endpoints: 60 requests/minute per user
- Admin endpoints: 200 requests/minute per admin
- Webhook endpoints: 1000 requests/minute (with secret validation)

### Security Headers

- JWT validation for protected endpoints
- Role-based access control (USER vs ADMINISTRATOR)
- CORS configuration for frontend domains
- Request validation with Joi schemas
- SQL injection protection via Prisma ORM

## Implementation Priority

1. **Phase 1**: Public catalog endpoints (browsing)
2. **Phase 2**: User subscription management (subscribe, upgrade, cancel)
3. **Phase 3**: Instance management (start, stop, configure)
4. **Phase 4**: Admin service management
5. **Phase 5**: Quota management and analytics
6. **Phase 6**: Webhooks and integrations
