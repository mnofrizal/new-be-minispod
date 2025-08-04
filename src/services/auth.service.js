import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import prisma from "../utils/prisma.js";

const register = async (userData) => {
  const { name, email, phone, password, avatar } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      avatar,
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

  // Generate JWT token
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user,
    accessToken,
    refreshToken: refreshToken.token,
  };
};

const login = async (email, password) => {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error("Account is deactivated. Please contact administrator.");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // Generate JWT token
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken: refreshToken.token,
  };
};

const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
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

  if (!user) {
    throw new Error("User not found");
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  return user;
};

const refreshAccessToken = async (refreshToken) => {
  // Find refresh token in database
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new Error("Invalid refresh token");
  }

  // Check if token is expired
  if (new Date() > tokenRecord.expiresAt) {
    await prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });
    throw new Error("Refresh token expired");
  }

  // Generate new access token
  const accessToken = generateAccessToken(tokenRecord.userId);

  return {
    accessToken,
    user: {
      id: tokenRecord.user.id,
      name: tokenRecord.user.name,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
    },
  };
};

const revokeRefreshToken = async (refreshToken) => {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
};

const revokeAllRefreshTokens = async (userId) => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

const generateAccessToken = (userId) => {
  return jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

const generateRefreshToken = async (userId) => {
  const token = uuidv4();
  const expiresAt = new Date();
  // Parse refresh token expiration from env (e.g., "7d" -> 7 days)
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  const days = parseInt(refreshExpiresIn.replace('d', '')) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  const refreshToken = await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return refreshToken;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

export default {
  register,
  login,
  getUserById,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
