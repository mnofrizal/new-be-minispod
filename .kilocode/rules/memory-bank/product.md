# Product Overview

## What This Project Is

This is the **backend API** for a Platform-as-a-Service (PaaS) project called "MinisPod" that enables selling pod services (like N8N, Ghost, etc.) with monthly subscriptions using K3s cluster infrastructure.

## Problems It Solves

1. **Service Management**: Provides a centralized backend to manage containerized services (pods) in a Kubernetes cluster
2. **User Management**: Handles user authentication, authorization, and role-based access control
3. **Subscription Management**: Backend foundation for managing monthly subscription services
4. **Kubernetes Integration**: Abstracts Kubernetes complexity through REST APIs for monitoring and managing cluster resources
5. **Multi-tenant Architecture**: Supports multiple users with different roles (USER, ADMINISTRATOR)

## How It Should Work

### Core Functionality

- **Authentication System**: JWT-based authentication with refresh tokens
- **User Management**: Registration, login, profile management with role-based permissions
- **Kubernetes Monitoring**: Real-time monitoring of pods, deployments, nodes, namespaces, ingresses, and services
- **Network Monitoring**: Complete network infrastructure monitoring with ingress and service configuration details
- **Admin Dashboard Backend**: Provides APIs for administrative operations on K8s resources
- **Metrics Integration**: Resource usage monitoring with CPU and memory metrics

### User Experience Goals

- **Secure Access**: Robust authentication with proper token management
- **Role-based Permissions**: Different access levels for users and administrators
- **Real-time Monitoring**: Live data about cluster resources, network infrastructure, and their health
- **Scalable Architecture**: Built to handle multiple tenants and services
- **Developer-friendly APIs**: Well-structured REST endpoints with proper error handling

## Target Users

1. **End Users (USER role)**: Customers who subscribe to pod services
2. **Administrators (ADMINISTRATOR role)**: System administrators managing the platform
3. **Frontend Applications**: Web/mobile apps that consume these APIs
4. **DevOps Teams**: Teams managing the underlying K3s infrastructure

## Success Metrics

- Secure user authentication and authorization
- Reliable Kubernetes cluster monitoring
- Proper error handling and logging
- Scalable database design for multi-tenancy
- Clean API design following REST principles
