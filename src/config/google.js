import { OAuth2Client } from "google-auth-library";
import logger from "../utils/logger.js";

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * Verify Google ID token and extract user information
 * @param {string} idToken - Google ID token from frontend
 * @returns {Promise<Object>} User information from Google
 */
const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("Invalid Google token payload");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    logger.error("Google token verification failed:", error);
    throw new Error("Invalid Google token");
  }
};

/**
 * Check if Google OAuth is properly configured
 * @returns {boolean} Configuration status
 */
const isGoogleOAuthConfigured = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn(
      "Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET"
    );
    return false;
  }

  if (
    clientId.includes("your-google-client-id") ||
    clientSecret.includes("your-google-client-secret")
  ) {
    logger.warn("Google OAuth not configured - using placeholder values");
    return false;
  }

  return true;
};

export default {
  googleClient,
  verifyGoogleToken,
  isGoogleOAuthConfigured,
};
