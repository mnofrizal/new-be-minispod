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
    },
  });

  // Create regular users
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
    },
  });

  console.log("✅ Database seeded successfully!");
  console.table([
    { email: admin.email, role: admin.role, password: "password123" },
    { email: user1.email, role: user1.role, password: "password123" },
    { email: user2.email, role: user2.role, password: "password123" },
    { email: user3.email, role: user3.role, password: "password123" },
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
