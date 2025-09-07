import prisma from "../utils/prisma.js";
import { getFileInfo, deleteFile } from "../utils/upload.js";
import logger from "../utils/logger.js";

/**
 * Create a new support ticket
 */
const createTicket = async (userId, ticketData, files = []) => {
  try {
    const { subject, description } = ticketData;

    // Create ticket with attachments in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the ticket
      const ticket = await tx.ticket.create({
        data: {
          subject,
          description,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create attachments if files are provided
      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileInfo = getFileInfo(file);
          const attachment = await tx.ticketAttachment.create({
            data: {
              ...fileInfo,
              ticketId: ticket.id,
              uploadedBy: userId,
            },
          });
          attachments.push(attachment);
        }
      }

      return {
        ...ticket,
        attachments,
      };
    });

    logger.info(`Ticket created: #${result.ticketNumber} by user ${userId}`);
    return result;
  } catch (error) {
    logger.error("Error creating ticket:", error);

    // Clean up uploaded files if transaction failed
    if (files && files.length > 0) {
      files.forEach((file) => {
        deleteFile(file.path);
      });
    }

    throw error;
  }
};

/**
 * Get user's tickets with pagination
 */
const getUserTickets = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(status && { status }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
              attachments: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting user tickets:", error);
    throw error;
  }
};

/**
 * Get all tickets (admin only) with pagination and filtering
 */
const getAllTickets = async (options = {}) => {
  try {
    const { page = 1, limit = 10, status, userId } = options;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(userId && { userId }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
              attachments: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting all tickets:", error);
    throw error;
  }
};

/**
 * Get ticket by ID with messages and attachments
 */
const getTicketById = async (ticketId, userId = null, isAdmin = false) => {
  try {
    const where = {
      id: ticketId,
      ...(userId && !isAdmin && { userId }), // Non-admin users can only see their own tickets
    };

    const ticket = await prisma.ticket.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            attachments: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        attachments: true,
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    return ticket;
  } catch (error) {
    logger.error("Error getting ticket by ID:", error);
    throw error;
  }
};

/**
 * Add message to ticket
 */
const addMessageToTicket = async (
  ticketId,
  userId,
  messageData,
  files = [],
  isAdmin = false
) => {
  try {
    const { content } = messageData;

    // Verify ticket exists and user has access
    const ticket = await getTicketById(
      ticketId,
      isAdmin ? null : userId,
      isAdmin
    );

    if (!ticket) {
      throw new Error("Ticket not found or access denied");
    }

    // Create message with attachments in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const message = await tx.ticketMessage.create({
        data: {
          content,
          ticketId,
          authorId: userId,
          isAdminReply: isAdmin,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      // Create attachments if files are provided
      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileInfo = getFileInfo(file);
          const attachment = await tx.ticketAttachment.create({
            data: {
              ...fileInfo,
              messageId: message.id,
              uploadedBy: userId,
            },
          });
          attachments.push(attachment);
        }
      }

      // Update ticket's updatedAt timestamp and status if admin is responding
      const updateData = { updatedAt: new Date() };

      // If admin is responding and ticket is OPEN, change status to IN_PROGRESS
      if (isAdmin && ticket.status === "OPEN") {
        updateData.status = "IN_PROGRESS";
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      return {
        ...message,
        attachments,
      };
    });

    logger.info(
      `Message added to ticket #${ticket.ticketNumber} by ${
        isAdmin ? "admin" : "user"
      } ${userId}`
    );
    return result;
  } catch (error) {
    logger.error("Error adding message to ticket:", error);

    // Clean up uploaded files if transaction failed
    if (files && files.length > 0) {
      files.forEach((file) => {
        deleteFile(file.path);
      });
    }

    throw error;
  }
};

/**
 * Close ticket (admin only)
 */
const closeTicket = async (ticketId, adminId) => {
  try {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: adminId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Ticket #${ticket.ticketNumber} closed by admin ${adminId}`);
    return ticket;
  } catch (error) {
    logger.error("Error closing ticket:", error);
    throw error;
  }
};

/**
 * Reopen ticket (admin only)
 */
const reopenTicket = async (ticketId, adminId) => {
  try {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "OPEN",
        closedAt: null,
        closedBy: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Ticket #${ticket.ticketNumber} reopened by admin ${adminId}`);
    return ticket;
  } catch (error) {
    logger.error("Error reopening ticket:", error);
    throw error;
  }
};

/**
 * Get attachment by ID with access control
 */
const getAttachmentById = async (attachmentId, userId, isAdmin = false) => {
  try {
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
      },
      include: {
        ticket: {
          select: {
            id: true,
            userId: true,
            ticketNumber: true,
          },
        },
        message: {
          select: {
            id: true,
            ticket: {
              select: {
                id: true,
                userId: true,
                ticketNumber: true,
              },
            },
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // Check access permissions
    const ticketUserId =
      attachment.ticket?.userId || attachment.message?.ticket?.userId;

    if (!isAdmin && ticketUserId !== userId) {
      throw new Error("Access denied");
    }

    return attachment;
  } catch (error) {
    logger.error("Error getting attachment:", error);
    throw error;
  }
};

/**
 * Get ticket statistics (admin only)
 */
const getTicketStats = async () => {
  try {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      closedTickets,
      recentTickets,
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "CLOSED" } }),
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      closedTickets,
      recentTickets,
    };
  } catch (error) {
    logger.error("Error getting ticket statistics:", error);
    throw error;
  }
};

/**
 * Close ticket by user (users can only close their own tickets, cannot reopen)
 */
const closeTicketByUser = async (ticketId, userId) => {
  try {
    // Check if ticket exists and belongs to user
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId: userId,
      },
    });

    if (!ticket) {
      throw new Error("Ticket not found or access denied");
    }

    // Check if ticket is already closed
    if (ticket.status === "CLOSED") {
      throw new Error("Ticket is already closed");
    }

    // Update ticket status to CLOSED
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: userId,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            messages: true,
            attachments: true,
          },
        },
      },
    });

    logger.info(`Ticket #${ticket.ticketNumber} closed by user ${userId}`);

    return updatedTicket;
  } catch (error) {
    logger.error("Error closing ticket by user:", error);
    throw error;
  }
};

export {
  createTicket,
  getUserTickets,
  getAllTickets,
  getTicketById,
  addMessageToTicket,
  closeTicket,
  reopenTicket,
  getAttachmentById,
  getTicketStats,
  closeTicketByUser,
};
