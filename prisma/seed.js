import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Hash passwords for seed users
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@minispod.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@minispod.com",
      phone: "+6281234567890",
      role: "ADMINISTRATOR",
      avatar:
        "https://ui-avatars.com/api/?name=Admin+User&background=0ea5e9&color=fff",
      password: hashedPassword,
      creditBalance: 1000000, // 1 million IDR for testing
    },
  });

  // Create regular users with credit balance
  const user1 = await prisma.user.upsert({
    where: { email: "user1@minispod.com" },
    update: {},
    create: {
      name: "John Doe",
      email: "user1@minispod.com",
      phone: "+6289876543210",
      role: "USER",
      avatar:
        "https://ui-avatars.com/api/?name=John+Doe&background=10b981&color=fff",
      password: hashedPassword,
      creditBalance: 500000, // 500k IDR for testing
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "user2@minispod.com" },
    update: {},
    create: {
      name: "Jane Smith",
      email: "user2@minispod.com",
      phone: "+6281122334455",
      role: "USER",
      avatar:
        "https://ui-avatars.com/api/?name=Jane+Smith&background=f59e0b&color=fff",
      password: hashedPassword,
      creditBalance: 250000, // 250k IDR for testing
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: "user3@minispod.com" },
    update: {},
    create: {
      name: "Bob Johnson",
      email: "user3@minispod.com",
      phone: "+6285566778899",
      role: "USER",
      avatar:
        "https://ui-avatars.com/api/?name=Bob+Johnson&background=8b5cf6&color=fff",
      password: hashedPassword,
      creditBalance: 100000, // 100k IDR for testing
    },
  });

  console.log("👥 Users created successfully!");

  // ============================================================================
  // SERVICE CATALOG SEED DATA
  // ============================================================================

  // Create Service Categories
  const devToolsCategory = await prisma.serviceCategory.upsert({
    where: { slug: "development-tools" },
    update: {},
    create: {
      name: "Development Tools",
      slug: "development-tools",
      description: "Tools for developers and automation",
      sortOrder: 1,
    },
  });

  const cmsCategory = await prisma.serviceCategory.upsert({
    where: { slug: "cms" },
    update: {},
    create: {
      name: "Content Management",
      slug: "cms",
      description: "Content management systems and blogging platforms",
      sortOrder: 2,
    },
  });

  const databaseCategory = await prisma.serviceCategory.upsert({
    where: { slug: "databases" },
    update: {},
    create: {
      name: "Databases",
      slug: "databases",
      description: "Database management systems",
      sortOrder: 3,
    },
  });

  console.log("📂 Service categories created successfully!");

  // Create Services
  const n8nService = await prisma.service.upsert({
    where: { slug: "n8n-automation" },
    update: {},
    create: {
      name: "N8N Automation",
      slug: "n8n-automation",
      description: "Workflow automation tool for connecting apps and services",
      longDescription:
        "N8N is a powerful workflow automation tool that allows you to connect different apps and services to automate repetitive tasks. Build complex workflows with a visual interface.",
      icon: "https://docs.n8n.io/favicon.ico",
      version: "latest",
      dockerImage: "n8nio/n8n:latest",
      defaultPort: 5678,
      categoryId: devToolsCategory.id,
      envTemplate: {
        N8N_BASIC_AUTH_ACTIVE: "true",
        N8N_BASIC_AUTH_USER: "admin",
        N8N_BASIC_AUTH_PASSWORD: "password",
        WEBHOOK_URL: "https://{{subdomain}}.minispod.com",
      },
      tags: ["automation", "workflow", "integration"],
      documentation: "https://docs.n8n.io/",
      isActive: true,
      isPublic: true,
      isFeatured: true,
      sortOrder: 1,
    },
  });

  const ghostService = await prisma.service.upsert({
    where: { slug: "ghost-blog" },
    update: {},
    create: {
      name: "Ghost Blog",
      slug: "ghost-blog",
      description:
        "Modern publishing platform for creating blogs and newsletters",
      longDescription:
        "Ghost is a powerful publishing platform designed for modern creators. Build beautiful blogs, newsletters, and membership sites with ease.",
      icon: "https://ghost.org/favicon.ico",
      version: "5-alpine",
      dockerImage: "ghost:5-alpine",
      defaultPort: 2368,
      categoryId: cmsCategory.id,
      envTemplate: {
        url: "https://{{subdomain}}.minispod.com",
        database__client: "sqlite3",
        database__connection__filename: "/var/lib/ghost/content/data/ghost.db",
        database__useNullAsDefault: "true",
      },
      tags: ["blog", "cms", "publishing"],
      documentation: "https://ghost.org/docs/",
      isActive: true,
      isPublic: true,
      isFeatured: true,
      sortOrder: 1,
    },
  });

  const postgresService = await prisma.service.upsert({
    where: { slug: "postgresql" },
    update: {},
    create: {
      name: "PostgreSQL Database",
      slug: "postgresql",
      description: "Powerful open-source relational database system",
      longDescription:
        "PostgreSQL is a powerful, open source object-relational database system with over 30 years of active development.",
      icon: "https://www.postgresql.org/favicon.ico",
      version: "15-alpine",
      dockerImage: "postgres:15-alpine",
      defaultPort: 5432,
      categoryId: databaseCategory.id,
      envTemplate: {
        POSTGRES_DB: "myapp",
        POSTGRES_USER: "admin",
        POSTGRES_PASSWORD: "password",
      },
      tags: ["database", "postgresql", "sql"],
      documentation: "https://www.postgresql.org/docs/",
      isActive: true,
      isPublic: true,
      isFeatured: false,
      sortOrder: 1,
    },
  });

  console.log("🚀 Services created successfully!");

  // Create Service Plans for N8N
  const n8nFreePlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: n8nService.id, planType: "FREE" },
    },
    update: {},
    create: {
      serviceId: n8nService.id,
      name: "Free",
      planType: "FREE",
      description: "Perfect for trying out N8N automation",
      monthlyPrice: 0,
      cpuMilli: 200,
      memoryMb: 256,
      storageGb: 2,
      bandwidth: 10,
      totalQuota: 10,
      usedQuota: 0,
      features: ["Basic workflows", "5 active workflows", "Community support"],
      maxInstancesPerUser: 1,
      maxDomains: 1,
      isActive: true,
      isPopular: false,
      sortOrder: 1,
    },
  });

  const n8nBasicPlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: n8nService.id, planType: "BASIC" },
    },
    update: {},
    create: {
      serviceId: n8nService.id,
      name: "Basic",
      planType: "BASIC",
      description: "Great for small teams and personal projects",
      monthlyPrice: 50000, // 50k IDR
      cpuMilli: 500,
      memoryMb: 512,
      storageGb: 5,
      bandwidth: 50,
      totalQuota: 50,
      usedQuota: 0,
      features: ["Unlimited workflows", "Email support", "Custom domains"],
      maxInstancesPerUser: 1,
      maxDomains: 3,
      isActive: true,
      isPopular: true,
      sortOrder: 2,
    },
  });

  const n8nProPlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: n8nService.id, planType: "PRO" },
    },
    update: {},
    create: {
      serviceId: n8nService.id,
      name: "Pro",
      planType: "PRO",
      description: "Advanced features for growing businesses",
      monthlyPrice: 150000, // 150k IDR
      cpuMilli: 1000,
      memoryMb: 1024,
      storageGb: 10,
      bandwidth: 100,
      totalQuota: 25,
      usedQuota: 0,
      features: [
        "Priority support",
        "Advanced integrations",
        "Team collaboration",
      ],
      maxInstancesPerUser: 3,
      maxDomains: 10,
      isActive: true,
      isPopular: false,
      sortOrder: 3,
    },
  });

  // Create Service Plans for Ghost
  const ghostFreePlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: ghostService.id, planType: "FREE" },
    },
    update: {},
    create: {
      serviceId: ghostService.id,
      name: "Starter",
      planType: "FREE",
      description: "Perfect for personal blogs",
      monthlyPrice: 0,
      cpuMilli: 150,
      memoryMb: 512,
      storageGb: 5,
      bandwidth: 20,
      totalQuota: 15,
      usedQuota: 0,
      features: ["Basic themes", "Newsletter", "Community support"],
      maxInstancesPerUser: 1,
      maxDomains: 1,
      isActive: true,
      isPopular: false,
      sortOrder: 1,
    },
  });

  const ghostBasicPlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: ghostService.id, planType: "BASIC" },
    },
    update: {},
    create: {
      serviceId: ghostService.id,
      name: "Creator",
      planType: "BASIC",
      description: "For serious content creators",
      monthlyPrice: 75000, // 75k IDR
      cpuMilli: 300,
      memoryMb: 1024,
      storageGb: 10,
      bandwidth: 100,
      totalQuota: 30,
      usedQuota: 0,
      features: ["Premium themes", "Custom domains", "Email support"],
      maxInstancesPerUser: 1,
      maxDomains: 5,
      isActive: true,
      isPopular: true,
      sortOrder: 2,
    },
  });

  // Create Service Plans for PostgreSQL
  const postgresBasicPlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: postgresService.id, planType: "BASIC" },
    },
    update: {},
    create: {
      serviceId: postgresService.id,
      name: "Basic DB",
      planType: "BASIC",
      description: "Small database for development",
      monthlyPrice: 25000, // 25k IDR
      cpuMilli: 100,
      memoryMb: 256,
      storageGb: 10,
      bandwidth: 50,
      totalQuota: 100,
      usedQuota: 0,
      features: ["Daily backups", "SSL connection", "Basic monitoring"],
      maxInstancesPerUser: 2,
      maxDomains: 1,
      isActive: true,
      isPopular: true,
      sortOrder: 1,
    },
  });

  const postgresProPlan = await prisma.servicePlan.upsert({
    where: {
      serviceId_planType: { serviceId: postgresService.id, planType: "PRO" },
    },
    update: {},
    create: {
      serviceId: postgresService.id,
      name: "Production DB",
      planType: "PRO",
      description: "High-performance database for production",
      monthlyPrice: 100000, // 100k IDR
      cpuMilli: 500,
      memoryMb: 1024,
      storageGb: 50,
      bandwidth: 200,
      totalQuota: 50,
      usedQuota: 0,
      features: ["Hourly backups", "Advanced monitoring", "Priority support"],
      maxInstancesPerUser: 5,
      maxDomains: 1,
      isActive: true,
      isPopular: false,
      sortOrder: 2,
    },
  });

  console.log("💰 Service plans created successfully!");

  console.log("✅ Database seeded successfully!");
  console.table([
    {
      email: admin.email,
      role: admin.role,
      password: "password123",
      credit: "1,000,000 IDR",
    },
    {
      email: user1.email,
      role: user1.role,
      password: "password123",
      credit: "500,000 IDR",
    },
    {
      email: user2.email,
      role: user2.role,
      password: "password123",
      credit: "250,000 IDR",
    },
    {
      email: user3.email,
      role: user3.role,
      password: "password123",
      credit: "100,000 IDR",
    },
  ]);

  console.log("\n📊 Service Catalog Summary:");
  console.table([
    {
      category: "Development Tools",
      service: "N8N Automation",
      plans: "Free, Basic, Pro",
    },
    {
      category: "Content Management",
      service: "Ghost Blog",
      plans: "Starter, Creator",
    },
    {
      category: "Databases",
      service: "PostgreSQL",
      plans: "Basic DB, Production DB",
    },
  ]);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
