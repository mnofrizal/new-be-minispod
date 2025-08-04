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
      createdAt: true,
      updatedAt: true,
    },
  });
};

const updateUserProfile = async (userId, updateData) => {
  const { name, phone, avatar } = updateData;
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name: name.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(avatar && { avatar: avatar.trim() }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
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
      createdAt: true,
      updatedAt: true,
    },
  });
};

export default {
  getProfileById,
  updateUserProfile,
  updateUserAvatar,
};
