import * as ticketService from "../../services/ticket.service.js";
import { formatTicketNumber } from "../../validations/ticket.validation.js";
import { fileExists } from "../../utils/upload.js";
import sendResponse from "../../utils/response.js";
import { StatusCodes } from "http-status-codes";
import fs from "fs";

/**
 * Get all tickets with pagination and filtering (admin only)
 * GET /api/admin/tickets
 */
const getAllTickets = async (req, res) => {
  try {
    const { page, limit, status, userId } = req.query;

    const result = await ticketService.getAllTickets({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      userId,
    });

    // Format ticket numbers in response
    const formattedTickets = result.tickets.map((ticket) => ({
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    }));

    const response = {
      ...result,
      tickets: formattedTickets,
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "All tickets retrieved successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Get ticket by ID with full details (admin only)
 * GET /api/admin/tickets/:id
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await ticketService.getTicketById(id, null, true); // isAdmin = true

    // Format ticket number in response
    const response = {
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "Ticket retrieved successfully"
    );
  } catch (error) {
    const statusCode =
      error.message === "Ticket not found"
        ? StatusCodes.NOT_FOUND
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

/**
 * Add admin response to ticket
 * POST /api/admin/tickets/:id/messages
 */
const addAdminResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const adminId = req.user.userId;
    const files = req.files || [];

    const message = await ticketService.addMessageToTicket(
      id,
      adminId,
      { content },
      files,
      true // isAdmin = true for admin controller
    );

    return sendResponse(
      res,
      StatusCodes.CREATED,
      message,
      "Admin response added successfully"
    );
  } catch (error) {
    const statusCode =
      error.message.includes("not found") ||
      error.message.includes("access denied")
        ? StatusCodes.NOT_FOUND
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

/**
 * Close ticket (admin only)
 * PUT /api/admin/tickets/:id/close
 */
const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const ticket = await ticketService.closeTicket(id, adminId);

    // Format ticket number in response
    const response = {
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "Ticket closed successfully"
    );
  } catch (error) {
    const statusCode =
      error.message === "Ticket not found"
        ? StatusCodes.NOT_FOUND
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

/**
 * Reopen ticket (admin only)
 * PUT /api/admin/tickets/:id/reopen
 */
const reopenTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const ticket = await ticketService.reopenTicket(id, adminId);

    // Format ticket number in response
    const response = {
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "Ticket reopened successfully"
    );
  } catch (error) {
    const statusCode =
      error.message === "Ticket not found"
        ? StatusCodes.NOT_FOUND
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

/**
 * Download any attachment (admin only)
 * GET /api/admin/tickets/attachments/:id
 */
const downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const attachment = await ticketService.getAttachmentById(id, adminId, true); // isAdmin = true

    // Check if file exists on disk
    if (!fileExists(attachment.filePath)) {
      return sendResponse(
        res,
        "File not found on server",
        StatusCodes.NOT_FOUND
      );
    }

    // Get file stats
    const stats = fs.statSync(attachment.filePath);

    // Set appropriate headers
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.filename}"`
    );
    res.setHeader(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Stream the file
    const fileStream = fs.createReadStream(attachment.filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("Error streaming file:", error);
      if (!res.headersSent) {
        return sendResponse(
          res,
          "Error downloading file",
          StatusCodes.INTERNAL_SERVER_ERROR
        );
      }
    });
  } catch (error) {
    const statusCode =
      error.message === "Attachment not found" ||
      error.message === "Access denied"
        ? StatusCodes.NOT_FOUND
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

/**
 * Get comprehensive ticket statistics (admin only)
 * GET /api/admin/tickets/stats
 */
const getTicketStats = async (req, res) => {
  try {
    const stats = await ticketService.getTicketStats();
    return sendResponse(
      res,
      StatusCodes.OK,
      stats,
      "Ticket statistics retrieved successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Get tickets by user ID (admin only)
 * GET /api/admin/tickets/user/:userId
 */
const getTicketsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, status } = req.query;

    const result = await ticketService.getUserTickets(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });

    // Format ticket numbers in response
    const formattedTickets = result.tickets.map((ticket) => ({
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    }));

    const response = {
      ...result,
      tickets: formattedTickets,
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "User tickets retrieved successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Bulk close tickets (admin only)
 * PUT /api/admin/tickets/bulk/close
 */
const bulkCloseTickets = async (req, res) => {
  try {
    const { ticketIds } = req.body;
    const adminId = req.user.userId;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return sendResponse(
        res,
        "Ticket IDs array is required",
        StatusCodes.BAD_REQUEST
      );
    }

    const results = [];
    const errors = [];

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        const ticket = await ticketService.closeTicket(ticketId, adminId);
        results.push({
          ticketId,
          ticketNumber: formatTicketNumber(ticket.ticketNumber),
          success: true,
        });
      } catch (error) {
        errors.push({
          ticketId,
          error: error.message,
          success: false,
        });
      }
    }

    const response = {
      processed: ticketIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      response,
      "Bulk close operation completed"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

export {
  getAllTickets,
  getTicketById,
  addAdminResponse,
  closeTicket,
  reopenTicket,
  downloadAttachment,
  getTicketStats,
  getTicketsByUserId,
  bulkCloseTickets,
};
