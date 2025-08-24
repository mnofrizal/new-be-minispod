# Technologies & Technical Setup

## Core Technologies

### Backend Framework

- **Node.js**: Runtime environment with ES modules support
- **Express.js**: Web application framework for REST API
- **CORS**: Cross-origin resource sharing middleware

### Database & ORM

- **PostgreSQL**: Primary database for user data and application state
- **Prisma**: Type-safe ORM with schema management and migrations
- **Database URL**: Configurable for local development and production

### Authentication & Security

- **JWT (jsonwebtoken)**: Access token generation and verification
- **bcryptjs**: Password hashing with 12 salt rounds
- **UUID**: Refresh token generation
- **Role-based Authorization**: USER and ADMINISTRATOR roles

### Kubernetes Integration

- **@kubernetes/client-node**: Official Kubernetes JavaScript client
- **Metrics API**: Resource usage monitoring (CPU, memory)
- **Multi-environment Support**: In-cluster and local kubeconfig

### Validation & Logging

- **Joi**: Request validation with custom error messages
- **Winston**: Structured logging with timestamps and colors
- **http-status-codes**: Standardized HTTP status code handling

## Development Dependencies

- **nodemon**: Development server with auto-reload
- **prisma**: Database schema management and migrations

## Environment Configuration

### Required Environment Variables

```bash
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
```

## Project Structure

### Directory Organization

```
src/
├── app.js                 # Main application entry point
├── config/               # Configuration files
│   └── kubernetes.js     # K8s client setup
├── controllers/          # Request handlers
│   ├── auth.controller.js
│   ├── user.controller.js
│   └── k8s/             # Kubernetes controllers
├── middleware/          # Express middleware
│   ├── auth.js          # Authentication middleware
│   └── validate.js      # Validation middleware
├── routes/              # Route definitions
│   ├── index.routes.js  # Main router
│   ├── auth.routes.js
│   ├── admin/           # Admin routes
│   └── user/            # User routes
├── services/            # Business logic
│   ├── auth.service.js
│   ├── user.service.js
│   └── k8s/             # Kubernetes services
├── utils/               # Utility functions
│   ├── logger.js        # Winston logger
│   ├── prisma.js        # Prisma client
│   └── response.js      # Response formatter
└── validations/         # Joi schemas
    ├── auth.validation.js
    └── user.validation.js
```

## Development Setup

### Prerequisites

- Node.js (ES modules support)
- PostgreSQL database
- Kubernetes cluster (optional for K8s features)

### Installation & Setup

```bash
# Install dependencies
npm install

# Database setup
npm run db:generate
npm run db:push
npm run db:migrate

# Development server
npm run dev

# Production server
npm start
```

### Database Scripts

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with initial data

## API Testing

### REST Client Files

- `rest/auth.rest` - Authentication endpoints
- `rest/user.rest` - User management endpoints
- `rest/catalog.rest` - Public catalog browsing endpoints
- `rest/wallet.rest` - Wallet management and payment endpoints
- `rest/admin/manage-user.rest` - User management endpoints
- `rest/admin/k8s-pods.rest` - Pod monitoring endpoints
- `rest/admin/k8s-deployments.rest` - Deployment monitoring endpoints
- `rest/admin/k8s-nodes.rest` - Node monitoring endpoints
- `rest/admin/k8s-namespaces.rest` - Namespace monitoring endpoints
- `rest/admin/k8s-ingresses.rest` - Ingress monitoring endpoints
- `rest/admin/k8s-services.rest` - Service monitoring endpoints

### Key Endpoints

#### Authentication & User Management

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/health` - Health check

#### Public Catalog & Wallet Management

- `GET /api/catalog/categories` - List service categories
- `GET /api/catalog/services` - List available services
- `GET /api/catalog/services/:serviceId/plans` - Get service plans
- `GET /api/wallet/info` - Get wallet balance and statistics
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/topup` - Create Midtrans payment transaction
- `GET /api/wallet/payment-methods` - Get available payment methods
- `GET /api/wallet/transactions/:id/status` - Check transaction status
- `POST /api/wallet/transactions/:id/cancel` - Cancel pending transaction
- `POST /api/wallet/webhook/midtrans` - Midtrans payment webhook

#### Kubernetes Monitoring (Admin Only)

- `GET /api/admin/k8s/pods` - List all pods with metrics
- `GET /api/admin/k8s/deployments` - List all deployments
- `GET /api/admin/k8s/nodes` - List all nodes with metrics
- `GET /api/admin/k8s/namespaces` - List all namespaces
- `GET /api/admin/k8s/ingresses` - List all ingresses with network config
- `GET /api/admin/k8s/services` - List all services with network details

## Technical Constraints

### Security

- JWT tokens expire in 24 hours
- Refresh tokens expire in 7 days
- Passwords hashed with bcrypt (12 salt rounds)
- Role-based access control enforced

### Kubernetes Integration

- Supports both in-cluster and local development
- Graceful degradation when K8s unavailable
- Real-time metrics collection for resource monitoring
- Multi-namespace support for resource isolation

### Database

- PostgreSQL for ACID compliance
- Prisma for type-safe database operations
- Automatic cascade deletion for related records
- Unique constraints on email and phone fields
- Enhanced decimal precision (DECIMAL(15,2)) for currency fields
- Complete service catalog schema with credit-based billing

```

```
