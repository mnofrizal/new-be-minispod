import prisma from "../utils/prisma.js";

class CatalogService {
  /**
   * Get all service categories with optional services
   * @param {Object} options - Query options
   * @param {boolean} options.includeServices - Include services in response
   * @param {boolean} options.onlyActive - Only return active categories
   * @returns {Promise<Array>} Array of service categories
   */
  async getServiceCategories(options = {}) {
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
                    monthlyPrice: true,
                    description: true,
                    isPopular: true,
                    totalQuota: true,
                    usedQuota: true,
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
  }

  /**
   * Get services by category slug
   * @param {string} categorySlug - Category slug
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Category with services
   */
  async getServicesByCategory(categorySlug, options = {}) {
    const { includePlans = true } = options;

    const category = await prisma.serviceCategory.findUnique({
      where: { slug: categorySlug },
      include: {
        services: {
          where: { isActive: true, isPublic: true },
          include: {
            plans: includePlans
              ? {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    name: true,
                    planType: true,
                    monthlyPrice: true,
                    setupFee: true,
                    description: true,
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
                  },
                }
              : false,
          },
          orderBy: [
            { isFeatured: "desc" },
            { sortOrder: "asc" },
            { name: "asc" },
          ],
        },
      },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  /**
   * Get service details by slug
   * @param {string} serviceSlug - Service slug
   * @returns {Promise<Object>} Service details with plans
   */
  async getServiceDetails(serviceSlug) {
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
            setupFee: true,
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
    }));

    return service;
  }

  /**
   * Search services by name, description, or tags
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching services
   */
  async searchServices(query, options = {}) {
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
              monthlyPrice: true,
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
  }

  /**
   * Get featured services
   * @param {number} limit - Number of services to return
   * @returns {Promise<Array>} Array of featured services
   */
  async getFeaturedServices(limit = 6) {
    return await prisma.service.findMany({
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
          take: 1, // Get cheapest plan
          select: {
            id: true,
            name: true,
            planType: true,
            monthlyPrice: true,
            totalQuota: true,
            usedQuota: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      take: limit,
    });
  }

  /**
   * Get service plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Service plan details
   */
  async getServicePlan(planId) {
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
            minCpuMilli: true,
            minMemoryMb: true,
            minStorageGb: true,
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
  }

  /**
   * Check if service plan is available for subscription
   * @param {string} planId - Plan ID
   * @returns {Promise<boolean>} Whether plan is available
   */
  async isPlanAvailable(planId) {
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
  }
}

export default new CatalogService();
