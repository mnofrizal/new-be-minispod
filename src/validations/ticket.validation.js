import Joi from "joi";

/**
 * Validation schema for creating a new ticket
 */
const createTicket = {
  body: Joi.object({
    subject: Joi.string().min(5).max(200).required().messages({
      "string.min": "Subject must be at least 5 characters long",
      "string.max": "Subject cannot exceed 200 characters",
      "any.required": "Subject is required",
    }),
    description: Joi.string().min(10).max(2000).required().messages({
      "string.min": "Description must be at least 10 characters long",
      "string.max": "Description cannot exceed 2000 characters",
      "any.required": "Description is required",
    }),
  }),
};

/**
 * Validation schema for getting user tickets with pagination
 */
const getUserTickets = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    status: Joi.string()
      .valid("OPEN", "IN_PROGRESS", "CLOSED")
      .optional()
      .messages({
        "any.only": "Status must be OPEN, IN_PROGRESS, or CLOSED",
      }),
  }),
};

/**
 * Validation schema for getting all tickets (admin only)
 */
const getAllTickets = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    status: Joi.string()
      .valid("OPEN", "IN_PROGRESS", "CLOSED")
      .optional()
      .messages({
        "any.only": "Status must be OPEN, IN_PROGRESS, or CLOSED",
      }),
    userId: Joi.string().optional().messages({
      "string.base": "User ID must be a string",
    }),
  }),
};

/**
 * Validation schema for getting ticket by ID
 */
const getTicketById = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.base": "Ticket ID must be a string",
      "any.required": "Ticket ID is required",
    }),
  }),
};

/**
 * Validation schema for adding message to ticket
 */
const addMessage = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.base": "Ticket ID must be a string",
      "any.required": "Ticket ID is required",
    }),
  }),
  body: Joi.object({
    content: Joi.string().min(1).max(2000).required().messages({
      "string.min": "Message content cannot be empty",
      "string.max": "Message content cannot exceed 2000 characters",
      "any.required": "Message content is required",
    }),
  }),
};

/**
 * Validation schema for closing/reopening ticket (admin only)
 */
const updateTicketStatus = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.base": "Ticket ID must be a string",
      "any.required": "Ticket ID is required",
    }),
  }),
};

/**
 * Validation schema for downloading attachment
 */
const downloadAttachment = {
  params: Joi.object({
    id: Joi.string().required().messages({
      "string.base": "Attachment ID must be a string",
      "any.required": "Attachment ID is required",
    }),
  }),
};

/**
 * Custom validation for file uploads
 */
const validateFileUpload = (req, res, next) => {
  // Check if files are present
  if (req.files && req.files.length > 0) {
    // Validate file count
    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 files allowed per upload",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate each file
    for (const file of req.files) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} exceeds 5MB size limit`,
          timestamp: new Date().toISOString(),
        });
      }

      // Check file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} has invalid type. Only images are allowed.`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  next();
};

/**
 * Validation for ticket number format
 */
const validateTicketNumber = (ticketNumber) => {
  const schema = Joi.number().integer().min(1).required().messages({
    "number.base": "Ticket number must be a number",
    "number.integer": "Ticket number must be an integer",
    "number.min": "Ticket number must be at least 1",
    "any.required": "Ticket number is required",
  });

  return schema.validate(ticketNumber);
};

/**
 * Format ticket number for display (#001, #002, etc.)
 */
const formatTicketNumber = (ticketNumber) => {
  return `#${ticketNumber.toString().padStart(3, "0")}`;
};

/**
 * Parse ticket number from formatted string
 */
const parseTicketNumber = (formattedNumber) => {
  if (typeof formattedNumber === "string" && formattedNumber.startsWith("#")) {
    return parseInt(formattedNumber.substring(1), 10);
  }
  return parseInt(formattedNumber, 10);
};

export {
  createTicket,
  getUserTickets,
  getAllTickets,
  getTicketById,
  addMessage,
  updateTicketStatus,
  downloadAttachment,
  validateFileUpload,
  validateTicketNumber,
  formatTicketNumber,
  parseTicketNumber,
};
