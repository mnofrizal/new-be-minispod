import prisma from "../utils/prisma.js";

const getProfileById = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const updateUserProfile = async (userId, updateData) => {
  const { name, phone, avatar, role } = updateData;

  if (phone) {
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: phone.trim(),
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new Error("Phone number is already in use");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name: name.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(avatar && { avatar: avatar.trim() }),
      ...(role && { role }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const updateUserAvatar = async (userId, avatar) => {
  return prisma.user.update({
    where: { id: userId },
    data: { avatar: avatar.trim() },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

// Admin functions
const getAllUsers = async ({ page = 1, limit = 10, search, role }) => {
  const skip = (page - 1) * limit;
  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const deleteUser = async (userId) => {
  return prisma.user.delete({
    where: { id: userId },
  });
};

const toggleUserStatus = async (userId, isActive) => {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

const createUser = async (userData) => {
  const { name, email, phone, password, role = "USER", avatar } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Check if phone is already in use
  if (phone) {
    const existingPhoneUser = await prisma.user.findFirst({
      where: { phone: phone.trim() },
    });

    if (existingPhoneUser) {
      throw new Error("Phone number is already in use");
    }
  }

  // Hash password
  const bcrypt = await import("bcryptjs");
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : null,
      password: hashedPassword,
      role,
      avatar: avatar ? avatar.trim() : null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
};

export default {
  getProfileById,
  updateUserProfile,
  updateUserAvatar,
  getAllUsers,
  deleteUser,
  toggleUserStatus,
  createUser,
};
