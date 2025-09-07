import express from "express";
import * as ticketController from "../controllers/ticket.controller.js";
import * as ticketValidation from "../validations/ticket.validation.js";
import { ticketUpload } from "../utils/upload.js";
import { authenticateToken } from "../middleware/auth.js";
import validate from "../middleware/validate.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/tickets/stats
 * @desc    Get user ticket statistics
 * @access  Private (User)
 */
router.get("/stats", ticketController.getUserTicketStats);

/**
 * @route   GET /api/tickets
 * @desc    Get user's tickets with pagination
 * @access  Private (User)
 */
router.get(
  "/",
  validate(ticketValidation.getUserTickets),
  ticketController.getUserTickets
);

/**
 * @route   POST /api/tickets
 * @desc    Create a new support ticket
 * @access  Private (User)
 */
router.post(
  "/",
  ticketUpload.array("attachments", 5), // Allow up to 5 file attachments
  ticketValidation.validateFileUpload,
  validate(ticketValidation.createTicket),
  ticketController.createTicket
);

/**
 * @route   GET /api/tickets/:id
 * @desc    Get ticket by ID with messages and attachments
 * @access  Private (User - own tickets only)
 */
router.get(
  "/:id",
  validate(ticketValidation.getTicketById),
  ticketController.getTicketById
);

/**
 * @route   POST /api/tickets/:id/messages
 * @desc    Add message to ticket
 * @access  Private (User - own tickets only)
 */
router.post(
  "/:id/messages",
  ticketUpload.array("attachments", 5), // Allow up to 5 file attachments
  ticketValidation.validateFileUpload,
  validate(ticketValidation.addMessage),
  ticketController.addMessage
);

/**
 * @route   PUT /api/tickets/:id/close
 * @desc    Close ticket (users can only close, not reopen)
 * @access  Private (User - own tickets only)
 */
router.put(
  "/:id/close",
  validate(ticketValidation.getTicketById), // Reuse existing ID validation
  ticketController.closeTicket
);

/**
 * @route   GET /api/tickets/attachments/:id
 * @desc    Download attachment
 * @access  Private (User - own ticket attachments only)
 */
router.get(
  "/attachments/:id",
  validate(ticketValidation.downloadAttachment),
  ticketController.downloadAttachment
);

export default router;
