import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const baseDir = "uploads";
  const ticketDir = path.join(baseDir, "tickets");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  if (!fs.existsSync(ticketDir)) {
    fs.mkdirSync(ticketDir, { recursive: true });
  }
};

// Initialize upload directories
createUploadDirs();

// Storage configuration for ticket attachments
const ticketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const uploadPath = path.join("uploads", "tickets", year, month);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed."
      ),
      false
    );
  }
};

// Multer configuration for ticket attachments
const ticketUpload = multer({
  storage: ticketStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // Maximum 5 files per request
  },
});

// Helper function to get file info
const getFileInfo = (file) => {
  return {
    filename: file.originalname,
    storedName: file.filename,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
};

// Helper function to delete file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

// Helper function to validate file exists
const fileExists = (filePath) => {
  return fs.existsSync(filePath);
};

// Helper function to get file stats
const getFileStats = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath);
    }
    return null;
  } catch (error) {
    console.error("Error getting file stats:", error);
    return null;
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to get MIME type from file extension
const getMimeType = (filename) => {
  return mime.lookup(filename) || "application/octet-stream";
};

export {
  ticketUpload,
  getFileInfo,
  deleteFile,
  fileExists,
  getFileStats,
  formatFileSize,
  getMimeType,
};
