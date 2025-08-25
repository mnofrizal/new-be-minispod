import prisma from "../utils/prisma.js";

/**
 * Get all service categories with optional services
 * @param {Object} options - Query options
 * @param {boolean} options.includeServices - Include services in response
 * @param {boolean} options.onlyActive - Only return active categories
 * @returns {Promise<Array>} Array of service categories
 */
const getServiceCategories = async (options = {}) => {
  const { includeServices = false, onlyActive = true } = options;

  const whereClause = onlyActive
    ? { services: { some: { isActive: true, isPublic: true } } }
    : {};

  return await prisma.serviceCategory.findMany({
    where: whereClause,
    include: {
      services: includeServices
        ? {
            where: { isActive: true, isPublic: true },
            orderBy: [
              { isFeatured: "desc" },
              { sortOrder: "asc" },
              { name: "asc" },
            ],
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              icon: true,
              version: true,
              tags: true,
              isFeatured: true,
              sortOrder: true,
              plans: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  name: true,
                  planType: true,
                  description: true,
                  monthlyPrice: true,
                  // Resource Specifications (key differentiators)
                  cpuMilli: true,
                  memoryMb: true,
                  storageGb: true,
                  bandwidth: true,
                  // Plan Features
                  features: true,
                  maxInstancesPerUser: true,
                  maxDomains: true,
                  // Quota Information
                  totalQuota: true,
                  usedQuota: true,
                  isPopular: true,
                },
              },
            },
          }
        : false,
      _count: {
        select: {
          services: {
            where: { isActive: true, isPublic: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
};

/**
 * Get all services with pagination
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Services with pagination
 */
const getAllServices = async (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        plans: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            planType: true,
            description: true,
            monthlyPrice: true,
            // Resource Specifications (key differentiators)
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            bandwidth: true,
            // Plan Features
            features: true,
            maxInstancesPerUser: true,
            maxDomains: true,
            // Quota Information
            totalQuota: true,
            usedQuota: true,
            isPopular: true,
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.service.count({
      where: {
        isActive: true,
        isPublic: true,
      },
    }),
  ]);

  // Add availability status to plans
  const servicesWithAvailability = services.map((service) => ({
    ...service,
    plans: service.plans.map((plan) => ({
      ...plan,
      availableQuota: plan.totalQuota - plan.usedQuota,
      isAvailable: plan.totalQuota - plan.usedQuota > 0,
      monthlyPrice: parseFloat(plan.monthlyPrice),
    })),
  }));

  return {
    services: servicesWithAvailability,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get services by category slug with pagination
 * @param {string} categorySlug - Category slug
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Category with services and pagination
 */
const getServicesByCategory = async (categorySlug, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const category = await prisma.serviceCategory.findUnique({
    where: { slug: categorySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  });

  if (!category) {
    return null;
  }

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        isPublic: true,
        categoryId: category.id,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        plans: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            planType: true,
            description: true,
            monthlyPrice: true,
            // Resource Specifications (key differentiators)
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            bandwidth: true,
            // Plan Features
            features: true,
            maxInstancesPerUser: true,
            maxDomains: true,
            // Quota Information
            totalQuota: true,
            usedQuota: true,
            isPopular: true,
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.service.count({
      where: {
        isActive: true,
        isPublic: true,
        categoryId: category.id,
      },
    }),
  ]);

  // Add availability status to plans
  const servicesWithAvailability = services.map((service) => ({
    ...service,
    plans: service.plans.map((plan) => ({
      ...plan,
      availableQuota: plan.totalQuota - plan.usedQuota,
      isAvailable: plan.totalQuota - plan.usedQuota > 0,
      monthlyPrice: parseFloat(plan.monthlyPrice),
    })),
  }));

  return {
    ...category,
    services: servicesWithAvailability,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get service details by slug
 * @param {string} serviceSlug - Service slug
 * @returns {Promise<Object>} Service details with plans
 */
const getServiceDetails = async (serviceSlug) => {
  const service = await prisma.service.findUnique({
    where: { slug: serviceSlug, isActive: true, isPublic: true },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      plans: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          planType: true,
          description: true,
          monthlyPrice: true,
          cpuMilli: true,
          memoryMb: true,
          storageGb: true,
          bandwidth: true,
          features: true,
          maxInstancesPerUser: true,
          maxDomains: true,
          isPopular: true,
          totalQuota: true,
          usedQuota: true,
          // Calculate available quota
          _count: {
            select: {
              subscriptions: {
                where: { status: "ACTIVE" },
              },
            },
          },
        },
      },
    },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  // Add calculated available quota to each plan
  service.plans = service.plans.map((plan) => ({
    ...plan,
    availableQuota: plan.totalQuota - plan.usedQuota,
    isAvailable: plan.totalQuota - plan.usedQuota > 0,
    monthlyPrice: parseFloat(plan.monthlyPrice),
  }));

  return service;
};

/**
 * Search services by name, description, or tags
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching services
 */
const searchServices = async (query, options = {}) => {
  const { categoryId, limit = 20, offset = 0 } = options;

  const whereClause = {
    isActive: true,
    isPublic: true,
    AND: [
      categoryId ? { categoryId } : {},
      {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { longDescription: { contains: query, mode: "insensitive" } },
          { tags: { has: query.toLowerCase() } },
        ],
      },
    ],
  };

  const [services, totalCount] = await Promise.all([
    prisma.service.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        plans: {
          where: { isActive: true },
          orderBy: { monthlyPrice: "asc" },
          take: 1, // Get cheapest plan for preview
          select: {
            id: true,
            name: true,
            planType: true,
            description: true,
            monthlyPrice: true,
            // Resource Specifications (key differentiators)
            cpuMilli: true,
            memoryMb: true,
            storageGb: true,
            bandwidth: true,
            // Plan Features
            features: true,
            maxInstancesPerUser: true,
            maxDomains: true,
            // Quota Information
            totalQuota: true,
            usedQuota: true,
            isPopular: true,
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.service.count({ where: whereClause }),
  ]);

  return {
    services,
    totalCount,
    hasMore: offset + limit < totalCount,
  };
};

/**
 * Get featured services
 * @param {number} limit - Number of services to return
 * @returns {Promise<Array>} Array of featured services
 */
const getFeaturedServices = async (limit = 6) => {
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      isPublic: true,
      isFeatured: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      plans: {
        where: { isActive: true },
        orderBy: { monthlyPrice: "asc" },
        take: 1, // Get cheapest plan for display
        select: {
          id: true,
          name: true,
          planType: true,
          description: true,
          monthlyPrice: true,
          // Resource Specifications (key differentiators)
          cpuMilli: true,
          memoryMb: true,
          storageGb: true,
          bandwidth: true,
          // Plan Features
          features: true,
          maxInstancesPerUser: true,
          maxDomains: true,
          // Quota Information
          totalQuota: true,
          usedQuota: true,
          isPopular: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  // Add availability status
  return services.map((service) => ({
    ...service,
    plans: service.plans.map((plan) => ({
      ...plan,
      availableQuota: plan.totalQuota - plan.usedQuota,
      isAvailable: plan.totalQuota - plan.usedQuota > 0,
      monthlyPrice: parseFloat(plan.monthlyPrice),
    })),
  }));
};

/**
 * Get service plans for a specific service
 * @param {string} serviceSlug - Service slug
 * @returns {Promise<Object|null>} Service plans or null if not found
 */
const getServicePlans = async (serviceSlug) => {
  const service = await prisma.service.findUnique({
    where: {
      slug: serviceSlug,
      isActive: true,
      isPublic: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plans: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          planType: true,
          description: true,
          monthlyPrice: true,
          cpuMilli: true,
          memoryMb: true,
          storageGb: true,
          bandwidth: true,
          totalQuota: true,
          usedQuota: true,
          features: true,
          maxInstancesPerUser: true,
          maxDomains: true,
          isPopular: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!service) {
    return null;
  }

  // Add availability status and format plans
  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceSlug: service.slug,
    plans: service.plans.map((plan) => ({
      ...plan,
      availableQuota: plan.totalQuota - plan.usedQuota,
      isAvailable: plan.totalQuota - plan.usedQuota > 0,
      monthlyPrice: parseFloat(plan.monthlyPrice),
    })),
  };
};

/**
 * Get service plan by ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Service plan details
 */
const getServicePlan = async (planId) => {
  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId, isActive: true },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          dockerImage: true,
          defaultPort: true,
          envTemplate: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Service plan not found");
  }

  return {
    ...plan,
    availableQuota: plan.totalQuota - plan.usedQuota,
    isAvailable: plan.totalQuota - plan.usedQuota > 0,
  };
};

/**
 * Check if service plan is available for subscription
 * @param {string} planId - Plan ID
 * @returns {Promise<boolean>} Whether plan is available
 */
const isPlanAvailable = async (planId) => {
  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId, isActive: true },
    select: {
      totalQuota: true,
      usedQuota: true,
    },
  });

  if (!plan) {
    return false;
  }

  return plan.totalQuota - plan.usedQuota > 0;
};

export default {
  getServiceCategories,
  getAllServices,
  getServicesByCategory,
  getServiceDetails,
  searchServices,
  getFeaturedServices,
  getServicePlans,
  getServicePlan,
  isPlanAvailable,
};
