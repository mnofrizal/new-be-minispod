import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/response.js";
import logger from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";

/**
 * Get all services with filtering and pagination
 * GET /api/admin/services
 */
export const getAllServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (category) {
      where.category = {
        slug: category,
      };
    }

    if (status) {
      where.isActive = status === "active";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get services with pagination
    const [services, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          plans: {
            include: {
              _count: {
                select: {
                  subscriptions: true,
                },
              },
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.service.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / take);

    // Enhance services with detailed plan information including utilization
    const servicesWithDetailedPlans = services.map((service) => ({
      ...service,
      plans: service.plans.map((plan) => ({
        ...plan,
        utilization: {
          percentage:
            plan.totalQuota > 0 ? (plan.usedQuota / plan.totalQuota) * 100 : 0,
          available: plan.totalQuota - plan.usedQuota,
        },
      })),
    }));

    logger.info(`Admin retrieved ${services.length} services`, {
      adminId: req.user.id,
      filters: { category, status, search },
      pagination: { page, limit },
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        services: servicesWithDetailedPlans,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
      "Services retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving services:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve services"
    );
  }
};

/**
 * Get service by ID
 * GET /api/admin/services/:id
 */
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        plans: {
          include: {
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    logger.info(`Admin retrieved service details`, {
      adminId: req.user.id,
      serviceId: id,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { service },
      "Service details retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving service details:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service details"
    );
  }
};

/**
 * Create new service
 * POST /api/admin/services
 */
export const createService = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      categoryId,
      dockerImage,
      defaultPort,
      version = "latest",
      longDescription,
      icon,
      envTemplate,
      tags,
      documentation,
      isPublic = true,
      isFeatured = false,
      sortOrder = 0,
      isActive = true,
    } = req.body;

    // Check if slug already exists
    const existingService = await prisma.service.findUnique({
      where: { slug },
    });

    if (existingService) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        null,
        "Service with this slug already exists"
      );
    }

    // Verify category exists
    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service category not found"
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        slug,
        description,
        longDescription,
        icon,
        version,
        dockerImage,
        defaultPort,
        categoryId,
        envTemplate,
        tags,
        documentation,
        isActive,
        isPublic,
        isFeatured,
        sortOrder,
      },
      include: {
        category: true,
      },
    });

    logger.info(`Admin created new service`, {
      adminId: req.user.id,
      serviceId: service.id,
      serviceName: service.name,
    });

    return sendResponse(
      res,
      StatusCodes.CREATED,
      { service },
      "Service created successfully"
    );
  } catch (error) {
    logger.error("Error creating service:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to create service"
    );
  }
};

/**
 * Update service
 * PUT /api/admin/services/:id
 */
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      categoryId,
      dockerImage,
      defaultPort,
      version,
      longDescription,
      icon,
      envTemplate,
      tags,
      documentation,
      isPublic,
      isFeatured,
      sortOrder,
      isActive,
    } = req.body;

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    // Check if slug is being changed and if new slug already exists
    if (slug && slug !== existingService.slug) {
      const slugExists = await prisma.service.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return sendResponse(
          res,
          StatusCodes.CONFLICT,
          null,
          "Service with this slug already exists"
        );
      }
    }

    // Verify category exists if being changed
    if (categoryId && categoryId !== existingService.categoryId) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return sendResponse(
          res,
          StatusCodes.NOT_FOUND,
          null,
          "Service category not found"
        );
      }
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description && { description }),
        ...(longDescription && { longDescription }),
        ...(icon && { icon }),
        ...(categoryId && { categoryId }),
        ...(dockerImage && { dockerImage }),
        ...(defaultPort && { defaultPort }),
        ...(version && { version }),
        ...(envTemplate && { envTemplate }),
        ...(tags && { tags }),
        ...(documentation && { documentation }),
        ...(isPublic !== undefined && { isPublic }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        category: true,
        plans: true,
      },
    });

    logger.info(`Admin updated service`, {
      adminId: req.user.id,
      serviceId: id,
      changes: req.body,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { service },
      "Service updated successfully"
    );
  } catch (error) {
    logger.error("Error updating service:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update service"
    );
  }
};

/**
 * Delete service
 * DELETE /api/admin/services/:id
 */
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Check if service exists
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
            plans: true,
          },
        },
      },
    });

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    // Check if service has active subscriptions
    if (!force && service._count.subscriptions > 0) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        null,
        "Cannot delete service with active subscriptions. Use force=true to override."
      );
    }

    // If force delete, handle cascading deletes
    if (force) {
      await prisma.$transaction(async (tx) => {
        // Delete subscriptions (this will cascade to service instances)
        await tx.subscription.deleteMany({
          where: { serviceId: id },
        });

        // Delete service plans
        await tx.servicePlan.deleteMany({
          where: { serviceId: id },
        });

        // Finally delete the service
        await tx.service.delete({
          where: { id },
        });
      });
    } else {
      // Safe delete - only if no dependencies
      await prisma.service.delete({
        where: { id },
      });
    }

    logger.info(`Admin deleted service`, {
      adminId: req.user.id,
      serviceId: id,
      serviceName: service.name,
      force,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      null,
      "Service deleted successfully"
    );
  } catch (error) {
    logger.error("Error deleting service:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to delete service"
    );
  }
};

/**
 * Toggle service status
 * PATCH /api/admin/services/:id/toggle-status
 */
export const toggleServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if service exists
    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        isActive: !service.isActive,
      },
      include: {
        category: true,
      },
    });

    logger.info(`Admin toggled service status`, {
      adminId: req.user.id,
      serviceId: id,
      newStatus: updatedService.isActive,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { service: updatedService },
      `Service ${
        updatedService.isActive ? "activated" : "deactivated"
      } successfully`
    );
  } catch (error) {
    logger.error("Error toggling service status:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to toggle service status"
    );
  }
};

/**
 * Get service statistics
 * GET /api/admin/services/statistics
 */
export const getServiceStatistics = async (req, res) => {
  try {
    const [
      totalServices,
      activeServices,
      totalSubscriptions,
      totalInstances,
      categoryStats,
    ] = await Promise.all([
      prisma.service.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.serviceInstance.count(),
      prisma.serviceCategory.findMany({
        include: {
          _count: {
            select: {
              services: true,
            },
          },
        },
      }),
    ]);

    const statistics = {
      services: {
        total: totalServices,
        active: activeServices,
        inactive: totalServices - activeServices,
      },
      subscriptions: {
        total: totalSubscriptions,
      },
      instances: {
        total: totalInstances,
      },
      categories: categoryStats.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        serviceCount: cat._count.services,
      })),
    };

    logger.info(`Admin retrieved service statistics`, {
      adminId: req.user.id,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { statistics },
      "Service statistics retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving service statistics:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service statistics"
    );
  }
};

/**
 * Get all service plans across all services
 * GET /api/admin/plans
 */
export const getAllServicePlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      serviceId,
      planType,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (planType) {
      where.planType = planType;
    }

    if (status) {
      where.isActive = status === "active";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { service: { name: { contains: search, mode: "insensitive" } } },
        { service: { slug: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get service plans with pagination
    const [plans, totalCount] = await Promise.all([
      prisma.servicePlan.findMany({
        where,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.servicePlan.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / take);

    // Calculate utilization for each plan
    const plansWithUtilization = plans.map((plan) => ({
      ...plan,
      utilization: {
        percentage:
          plan.totalQuota > 0 ? (plan.usedQuota / plan.totalQuota) * 100 : 0,
        available: plan.totalQuota - plan.usedQuota,
      },
    }));

    logger.info(`Admin retrieved all service plans`, {
      adminId: req.user.id,
      filters: { serviceId, planType, status, search },
      pagination: { page, limit },
      totalCount,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        plans: plansWithUtilization,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
      "All service plans retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving all service plans:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve all service plans"
    );
  }
};

/**
 * Get all plans for a specific service
 * GET /api/admin/services/:serviceId/plans
 */
export const getServicePlans = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    const plans = await prisma.servicePlan.findMany({
      where: { serviceId },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    logger.info(`Admin retrieved service plans`, {
      adminId: req.user.id,
      serviceId,
      planCount: plans.length,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      {
        service,
        plans,
      },
      "Service plans retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving service plans:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service plans"
    );
  }
};

/**
 * Create new service plan for a service
 * POST /api/admin/services/:serviceId/plans
 */
export const createServicePlan = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const {
      name,
      planType,
      description,
      monthlyPrice,
      cpuMilli,
      memoryMb,
      storageGb,
      bandwidth = 0,
      totalQuota,
      features,
      maxInstancesPerUser = 1,
      maxDomains = 1,
      isActive = true,
      isPopular = false,
      sortOrder = 0,
    } = req.body;

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service not found"
      );
    }

    // Check if plan type already exists for this service
    const existingPlan = await prisma.servicePlan.findUnique({
      where: {
        serviceId_planType: { serviceId, planType },
      },
    });

    if (existingPlan) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        null,
        `A ${planType} plan already exists for this service`
      );
    }

    const plan = await prisma.servicePlan.create({
      data: {
        serviceId,
        name,
        planType,
        description,
        monthlyPrice,
        cpuMilli,
        memoryMb,
        storageGb,
        bandwidth,
        totalQuota,
        usedQuota: 0,
        features,
        maxInstancesPerUser,
        maxDomains,
        isActive,
        isPopular,
        sortOrder,
      },
      include: {
        service: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    logger.info(`Admin created new service plan`, {
      adminId: req.user.id,
      planId: plan.id,
      serviceId,
      planType,
    });

    return sendResponse(
      res,
      StatusCodes.CREATED,
      { plan },
      "Service plan created successfully"
    );
  } catch (error) {
    logger.error("Error creating service plan:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to create service plan"
    );
  }
};

/**
 * Get specific service plan
 * GET /api/admin/services/:serviceId/plans/:planId
 */
export const getServicePlan = async (req, res) => {
  try {
    const { serviceId, planId } = req.params;

    const plan = await prisma.servicePlan.findFirst({
      where: {
        id: planId,
        serviceId: serviceId,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    logger.info(`Admin retrieved service plan details`, {
      adminId: req.user.id,
      serviceId,
      planId,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { plan },
      "Service plan details retrieved successfully"
    );
  } catch (error) {
    logger.error("Error retrieving service plan details:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to retrieve service plan details"
    );
  }
};

/**
 * Update service plan
 * PUT /api/admin/services/:serviceId/plans/:planId
 */
export const updateServicePlan = async (req, res) => {
  try {
    const { serviceId, planId } = req.params;
    const {
      name,
      description,
      monthlyPrice,
      cpuMilli,
      memoryMb,
      storageGb,
      bandwidth,
      totalQuota,
      features,
      maxInstancesPerUser,
      maxDomains,
      isActive,
      isPopular,
      sortOrder,
    } = req.body;

    // Check if plan exists and belongs to the service
    const existingPlan = await prisma.servicePlan.findFirst({
      where: {
        id: planId,
        serviceId: serviceId,
      },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    // Validate quota changes
    if (totalQuota !== undefined && totalQuota < existingPlan.usedQuota) {
      return sendResponse(
        res,
        StatusCodes.BAD_REQUEST,
        null,
        `Cannot set total quota (${totalQuota}) below used quota (${existingPlan.usedQuota})`
      );
    }

    const plan = await prisma.servicePlan.update({
      where: { id: planId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(monthlyPrice !== undefined && { monthlyPrice }),
        ...(cpuMilli !== undefined && { cpuMilli }),
        ...(memoryMb !== undefined && { memoryMb }),
        ...(storageGb !== undefined && { storageGb }),
        ...(bandwidth !== undefined && { bandwidth }),
        ...(totalQuota !== undefined && { totalQuota }),
        ...(features && { features }),
        ...(maxInstancesPerUser !== undefined && { maxInstancesPerUser }),
        ...(maxDomains !== undefined && { maxDomains }),
        ...(isActive !== undefined && { isActive }),
        ...(isPopular !== undefined && { isPopular }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        service: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    logger.info(`Admin updated service plan`, {
      adminId: req.user.id,
      serviceId,
      planId,
      changes: req.body,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { plan },
      "Service plan updated successfully"
    );
  } catch (error) {
    logger.error("Error updating service plan:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to update service plan"
    );
  }
};

/**
 * Delete service plan
 * DELETE /api/admin/services/:serviceId/plans/:planId
 */
export const deleteServicePlan = async (req, res) => {
  try {
    const { serviceId, planId } = req.params;
    const { force = false } = req.query;

    // Check if plan exists and belongs to the service
    const plan = await prisma.servicePlan.findFirst({
      where: {
        id: planId,
        serviceId: serviceId,
      },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    // Check if plan has active subscriptions
    if (!force && plan._count.subscriptions > 0) {
      return sendResponse(
        res,
        StatusCodes.CONFLICT,
        null,
        "Cannot delete service plan with active subscriptions. Use force=true to override."
      );
    }

    // If force delete, handle cascading deletes
    if (force) {
      await prisma.$transaction(async (tx) => {
        // Delete subscriptions first
        await tx.subscription.deleteMany({
          where: { planId },
        });

        // Delete the plan
        await tx.servicePlan.delete({
          where: { id: planId },
        });
      });
    } else {
      // Safe delete - only if no dependencies
      await prisma.servicePlan.delete({
        where: { id: planId },
      });
    }

    logger.info(`Admin deleted service plan`, {
      adminId: req.user.id,
      serviceId,
      planId,
      planName: plan.name,
      force,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      null,
      "Service plan deleted successfully"
    );
  } catch (error) {
    logger.error("Error deleting service plan:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to delete service plan"
    );
  }
};

/**
 * Toggle service plan status
 * PATCH /api/admin/services/:serviceId/plans/:planId/toggle-status
 */
export const toggleServicePlanStatus = async (req, res) => {
  try {
    const { serviceId, planId } = req.params;

    // Check if plan exists and belongs to the service
    const plan = await prisma.servicePlan.findFirst({
      where: {
        id: planId,
        serviceId: serviceId,
      },
    });

    if (!plan) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "Service plan not found"
      );
    }

    const updatedPlan = await prisma.servicePlan.update({
      where: { id: planId },
      data: {
        isActive: !plan.isActive,
      },
      include: {
        service: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    logger.info(`Admin toggled service plan status`, {
      adminId: req.user.id,
      serviceId,
      planId,
      newStatus: updatedPlan.isActive,
    });

    return sendResponse(
      res,
      StatusCodes.OK,
      { plan: updatedPlan },
      `Service plan ${
        updatedPlan.isActive ? "activated" : "deactivated"
      } successfully`
    );
  } catch (error) {
    logger.error("Error toggling service plan status:", error);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      null,
      "Failed to toggle service plan status"
    );
  }
};
