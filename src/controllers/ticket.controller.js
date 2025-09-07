import * as ticketService from "../services/ticket.service.js";
import { formatTicketNumber } from "../validations/ticket.validation.js";
import { fileExists } from "../utils/upload.js";
import sendResponse from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import path from "path";
import fs from "fs";

/**
 * Create a new support ticket
 * POST /api/tickets
 */
const createTicket = async (req, res) => {
  try {
    const { subject, description } = req.body;
    const userId = req.user.userId;
    const files = req.files || [];

    const ticket = await ticketService.createTicket(
      userId,
      { subject, description },
      files
    );

    // Format response with ticket number
    const response = {
      ...ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
    };

    return sendResponse(
      res,
      StatusCodes.CREATED,
      response,
      "Ticket created successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Get user's tickets with pagination
 * GET /api/tickets
 */
const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.userId;
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
      "Tickets retrieved successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Get ticket by ID with messages and attachments
 * GET /api/tickets/:id
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const ticket = await ticketService.getTicketById(id, userId, false);

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
 * Add message to ticket
 * POST /api/tickets/:id/messages
 */
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    const files = req.files || [];

    const message = await ticketService.addMessageToTicket(
      id,
      userId,
      { content },
      files,
      false // isAdmin = false for user controller
    );

    return sendResponse(
      res,
      StatusCodes.CREATED,
      message,
      "Message added successfully"
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
 * Download attachment
 * GET /api/tickets/attachments/:id
 */
const downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const attachment = await ticketService.getAttachmentById(id, userId, false);

    // Check if file exists on disk
    if (!fileExists(attachment.filePath)) {
      return sendResponse(
        res,
        StatusCodes.NOT_FOUND,
        null,
        "File not found on server"
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
          StatusCodes.INTERNAL_SERVER_ERROR,
          null,
          "Error downloading file"
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
 * Get ticket statistics for current user
 * GET /api/tickets/stats
 */
const getUserTicketStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user-specific statistics
    const [totalTickets, openTickets, inProgressTickets, closedTickets] =
      await Promise.all([
        ticketService
          .getUserTickets(userId, { limit: 1 })
          .then((result) => result.pagination.total),
        ticketService
          .getUserTickets(userId, { status: "OPEN", limit: 1 })
          .then((result) => result.pagination.total),
        ticketService
          .getUserTickets(userId, { status: "IN_PROGRESS", limit: 1 })
          .then((result) => result.pagination.total),
        ticketService
          .getUserTickets(userId, { status: "CLOSED", limit: 1 })
          .then((result) => result.pagination.total),
      ]);

    const stats = {
      totalTickets,
      openTickets,
      inProgressTickets,
      closedTickets,
    };

    return sendResponse(
      res,
      StatusCodes.OK,
      stats,
      "User ticket statistics retrieved successfully"
    );
  } catch (error) {
    return sendResponse(res, StatusCodes.BAD_REQUEST, null, error.message);
  }
};

/**
 * Close ticket by user (users can only close, not reopen)
 * PUT /api/tickets/:id/close
 */
const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const ticket = await ticketService.closeTicketByUser(id, userId);

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
      error.message === "Ticket not found or access denied"
        ? StatusCodes.NOT_FOUND
        : error.message === "Ticket is already closed"
        ? StatusCodes.BAD_REQUEST
        : StatusCodes.BAD_REQUEST;
    return sendResponse(res, statusCode, null, error.message);
  }
};

export {
  createTicket,
  getUserTickets,
  getTicketById,
  addMessage,
  downloadAttachment,
  getUserTicketStats,
  closeTicket,
};
