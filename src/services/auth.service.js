import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import prisma from "../utils/prisma.js";
import googleConfig from "../config/google.js";
import welcomeBonusService from "./welcomeBonus.service.js";

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

  // Apply welcome bonus coupons (if any available)
  try {
    const welcomeBonusResult = await welcomeBonusService.applyWelcomeBonuses(
      user.id
    );
    if (welcomeBonusResult.totalCreditAdded > 0) {
      // Refresh user data to get updated credit balance
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          isGoogleUser: true,
          emailVerified: true,
          creditBalance: true,
          totalTopUp: true,
          totalSpent: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      user = updatedUser;
    }
  } catch (error) {
    // Log error but don't fail registration
    console.error("Welcome bonus application failed:", error);
  }

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

const logout = async (refreshToken) => {
  // Only revoke refresh token if provided
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
  // If no refresh token provided, logout is still successful (client-side token removal)
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
  const days = parseInt(refreshExpiresIn.replace("d", "")) || 7;
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

const googleLogin = async (idToken) => {
  // Verify Google token and extract user info
  const googleUserInfo = await googleConfig.verifyGoogleToken(idToken);

  // Check if user already exists with this Google ID
  let user = await prisma.user.findUnique({
    where: { googleId: googleUserInfo.googleId },
  });

  if (user) {
    // User exists, check if account is active
    if (!user.isActive) {
      throw new Error("Account is deactivated. Please contact administrator.");
    }

    // Update user info from Google (in case profile changed)
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: googleUserInfo.name,
        avatar: googleUserInfo.avatar,
        emailVerified: googleUserInfo.emailVerified,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        isGoogleUser: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } else {
    // Check if user exists with same email (regular account)
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUserInfo.email },
    });

    if (existingUser) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleId: googleUserInfo.googleId,
          isGoogleUser: true,
          emailVerified: googleUserInfo.emailVerified,
          avatar: googleUserInfo.avatar || existingUser.avatar,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          isGoogleUser: true,
          emailVerified: true,
          creditBalance: true,
          totalTopUp: true,
          totalSpent: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Create new user from Google account
      user = await prisma.user.create({
        data: {
          name: googleUserInfo.name,
          email: googleUserInfo.email,
          googleId: googleUserInfo.googleId,
          isGoogleUser: true,
          emailVerified: googleUserInfo.emailVerified,
          avatar: googleUserInfo.avatar,
          password: null, // No password for Google users
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatar: true,
          isActive: true,
          isGoogleUser: true,
          emailVerified: true,
          creditBalance: true,
          totalTopUp: true,
          totalSpent: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Apply welcome bonus coupons for new Google users
      try {
        const welcomeBonusResult =
          await welcomeBonusService.applyWelcomeBonuses(user.id);
        if (welcomeBonusResult.totalCreditAdded > 0) {
          // Refresh user data to get updated credit balance
          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              avatar: true,
              isActive: true,
              isGoogleUser: true,
              emailVerified: true,
              creditBalance: true,
              totalTopUp: true,
              totalSpent: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          user = updatedUser;
        }
      } catch (error) {
        // Log error but don't fail registration
        console.error(
          "Welcome bonus application failed for Google user:",
          error
        );
      }
    }
  }

  // Generate JWT tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user,
    accessToken,
    refreshToken: refreshToken.token,
  };
};

const linkGoogleAccount = async (userId, idToken) => {
  // Verify Google token and extract user info
  const googleUserInfo = await googleConfig.verifyGoogleToken(idToken);

  // Check if Google account is already linked to another user
  const existingGoogleUser = await prisma.user.findUnique({
    where: { googleId: googleUserInfo.googleId },
  });

  if (existingGoogleUser && existingGoogleUser.id !== userId) {
    throw new Error("This Google account is already linked to another user");
  }

  // Check if the email matches
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    throw new Error("User not found");
  }

  if (currentUser.email !== googleUserInfo.email) {
    throw new Error("Google account email does not match your account email");
  }

  // Link Google account to current user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      googleId: googleUserInfo.googleId,
      isGoogleUser: true,
      emailVerified: googleUserInfo.emailVerified,
      avatar: googleUserInfo.avatar || currentUser.avatar,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      isGoogleUser: true,
      emailVerified: true,
      creditBalance: true,
      totalTopUp: true,
      totalSpent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

const unlinkGoogleAccount = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isGoogleUser || !user.googleId) {
    throw new Error("No Google account linked to this user");
  }

  // Check if user has a password (can still login without Google)
  if (!user.password) {
    throw new Error(
      "Cannot unlink Google account. Please set a password first to maintain account access."
    );
  }

  // Unlink Google account
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      googleId: null,
      isGoogleUser: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      isActive: true,
      isGoogleUser: true,
      emailVerified: true,
      creditBalance: true,
      totalTopUp: true,
      totalSpent: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export default {
  register,
  login,
  logout,
  getUserById,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  googleLogin,
  linkGoogleAccount,
  unlinkGoogleAccount,
};
