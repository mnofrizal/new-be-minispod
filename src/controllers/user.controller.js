const prisma = require("../utils/prisma");

class UserController {
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;

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
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: { user },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { name, phone, avatar } = req.body;

      // Validate input
      if (!name && !phone && !avatar) {
        return res.status(400).json({
          success: false,
          message:
            "At least one field (name, phone, or avatar) is required to update",
        });
      }

      // Validate name if provided
      if (name && (typeof name !== "string" || name.trim().length < 2)) {
        return res.status(400).json({
          success: false,
          message: "Name must be at least 2 characters long",
        });
      }

      // Validate phone if provided
      if (phone && typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be a string",
        });
      }

      // Validate avatar if provided
      if (avatar && typeof avatar !== "string") {
        return res.status(400).json({
          success: false,
          message: "Avatar must be a string URL",
        });
      }

      // Update user profile
      const updatedUser = await prisma.user.update({
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

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: { user: updatedUser },
      });
    } catch (error) {
      console.error("Update profile error:", error);

      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async updateAvatar(req, res) {
    try {
      const userId = req.user.userId;
      const { avatar } = req.body;

      if (!avatar || typeof avatar !== "string") {
        return res.status(400).json({
          success: false,
          message: "Avatar URL is required and must be a string",
        });
      }

      const updatedUser = await prisma.user.update({
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

      res.status(200).json({
        success: true,
        message: "Avatar updated successfully",
        data: { user: updatedUser },
      });
    } catch (error) {
      console.error("Update avatar error:", error);

      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = new UserController();
