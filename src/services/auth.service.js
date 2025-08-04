const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../utils/prisma");

class AuthService {
  async register(userData) {
    const { name, email, phone, password, role = "USER", avatar } = userData;

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
        role,
        avatar,
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

    // Generate JWT token
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user,
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async login(email, password) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async getUserById(userId) {
    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async refreshAccessToken(refreshToken) {
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
    const accessToken = this.generateAccessToken(tokenRecord.userId);

    return {
      accessToken,
      user: {
        id: tokenRecord.user.id,
        name: tokenRecord.user.name,
        email: tokenRecord.user.email,
        role: tokenRecord.user.role,
      },
    };
  }

  async revokeRefreshToken(refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async revokeAllRefreshTokens(userId) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  generateAccessToken(userId) {
    return jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    });
  }

  async generateRefreshToken(userId) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        (parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS) || 7)
    );

    const refreshToken = await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return refreshToken;
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }
}

module.exports = new AuthService();
