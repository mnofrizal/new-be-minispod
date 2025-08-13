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

### Kubernetes Integration

- [`src/config/kubernetes.js`](src/config/kubernetes.js:1) - K8s client initialization and management
- [`src/controllers/k8s/`](src/controllers/k8s/) - K8s resource controllers (pods, deployments, nodes, namespaces, ingresses, services)
- [`src/services/k8s/`](src/services/k8s/) - K8s business logic, metrics collection, and network monitoring

### Database Layer

- [`prisma/schema.prisma`](prisma/schema.prisma:1) - Database schema definition
- [`src/utils/prisma.js`](src/utils/prisma.js:1) - Prisma client instance

### Utilities

- [`src/utils/response.js`](src/utils/response.js:1) - Standardized API response formatting
- [`src/utils/logger.js`](src/utils/logger.js:1) - Winston logging configuration

## Key Technical Decisions

### Authentication Architecture

- **JWT Access Tokens**: Short-lived (24h) for API access
- **Refresh Tokens**: Long-lived (7d) stored in database for token renewal
- **Role-based Access**: USER and ADMINISTRATOR roles with middleware enforcement
- **Password Security**: bcrypt with 12 salt rounds

### Database Design

- **User Model**: Core user information with role-based access
- **RefreshToken Model**: Secure token management with expiration
- **Cascade Deletion**: Refresh tokens deleted when user is removed

### Kubernetes Integration

- **Dual Environment Support**: In-cluster config for production, local kubeconfig for development
- **Metrics Collection**: Real-time CPU and memory usage via Kubernetes Metrics API
- **Network Monitoring**: Complete ingress and service monitoring with detailed configuration data
- **Multi-API Support**: CoreV1Api, AppsV1Api, NetworkingV1Api, and MetricsV1beta1Api clients
- **Error Handling**: Graceful degradation when K8s cluster is unavailable
- **Multi-namespace Support**: Cross-namespace resource monitoring

### API Design Patterns

- **Consistent Response Format**: Standardized success/error responses with timestamps
- **HTTP Status Codes**: Proper status code usage throughout
- **Error Handling**: Global error handler with detailed logging
- **Validation**: Joi schemas for request validation

## Component Relationships

### Authentication Flow

1. User registers/logs in → [`auth.controller.js`](src/controllers/auth.controller.js:1)
2. Controller calls → [`auth.service.js`](src/services/auth.service.js:1)
3. Service interacts with → [`prisma.js`](src/utils/prisma.js:1) → PostgreSQL
4. JWT tokens generated and returned

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
