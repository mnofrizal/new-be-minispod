import express from "express";
import * as adminTicketController from "../../controllers/admin/ticket.controller.js";
import * as ticketValidation from "../../validations/ticket.validation.js";
import { ticketUpload } from "../../utils/upload.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import Joi from "joi";

const router = express.Router();

// Apply authentication and admin role middleware to all routes
router.use(authenticateToken);
router.use(authorizeRoles("ADMINISTRATOR"));

/**
 * @route   GET /api/admin/tickets/stats
 * @desc    Get comprehensive ticket statistics
 * @access  Private (Admin only)
 */
router.get("/stats", adminTicketController.getTicketStats);

/**
 * @route   GET /api/admin/tickets
 * @desc    Get all tickets with pagination and filtering
 * @access  Private (Admin only)
 */
router.get(
  "/",
  validate(ticketValidation.getAllTickets),
  adminTicketController.getAllTickets
);

/**
 * @route   GET /api/admin/tickets/user/:userId
 * @desc    Get tickets by user ID
 * @access  Private (Admin only)
 */
router.get(
  "/user/:userId",
  validate({
    params: ticketValidation.getTicketById.params.keys({
      userId: ticketValidation.getTicketById.params.extract("id"),
    }),
    query: ticketValidation.getUserTickets.query,
  }),
  adminTicketController.getTicketsByUserId
);

/**
 * @route   GET /api/admin/tickets/:id
 * @desc    Get ticket by ID with full details
 * @access  Private (Admin only)
 */
router.get(
  "/:id",
  validate(ticketValidation.getTicketById),
  adminTicketController.getTicketById
);

/**
 * @route   POST /api/admin/tickets/:id/messages
 * @desc    Add admin response to ticket
 * @access  Private (Admin only)
 */
router.post(
  "/:id/messages",
  ticketUpload.array("attachments", 5), // Allow up to 5 file attachments
  ticketValidation.validateFileUpload,
  validate(ticketValidation.addMessage),
  adminTicketController.addAdminResponse
);

/**
 * @route   PUT /api/admin/tickets/:id/close
 * @desc    Close ticket
 * @access  Private (Admin only)
 */
router.put(
  "/:id/close",
  validate(ticketValidation.updateTicketStatus),
  adminTicketController.closeTicket
);

/**
 * @route   PUT /api/admin/tickets/:id/reopen
 * @desc    Reopen ticket
 * @access  Private (Admin only)
 */
router.put(
  "/:id/reopen",
  validate(ticketValidation.updateTicketStatus),
  adminTicketController.reopenTicket
);

/**
 * @route   PUT /api/admin/tickets/bulk/close
 * @desc    Bulk close tickets
 * @access  Private (Admin only)
 */
router.put(
  "/bulk/close",
  validate({
    body: Joi.object({
      ticketIds: Joi.array().items(Joi.string()).min(1).required(),
    }),
  }),
  adminTicketController.bulkCloseTickets
);

/**
 * @route   GET /api/admin/tickets/attachments/:id
 * @desc    Download any attachment
 * @access  Private (Admin only)
 */
router.get(
  "/attachments/:id",
  validate(ticketValidation.downloadAttachment),
  adminTicketController.downloadAttachment
);

export default router;
