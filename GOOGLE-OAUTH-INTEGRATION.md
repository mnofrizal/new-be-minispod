# Google OAuth Integration Documentation

## Overview

This document describes the Google OAuth integration implemented in the MinisPod backend API. The integration allows users to authenticate using their Google accounts, either as a standalone login method or linked to existing accounts.

## Features

- **Google OAuth Login**: Users can sign in directly with their Google account
- **Account Linking**: Existing users can link their Google account to their regular account
- **Account Unlinking**: Users can unlink their Google account (with safety checks)
- **Automatic User Creation**: New users are automatically created when logging in with Google for the first time
- **Email Verification**: Google-authenticated users are automatically marked as email verified
- **Profile Synchronization**: User profile information is updated from Google on each login

## Architecture

### Database Schema Changes

The `User` model has been extended with the following fields:

```prisma
model User {
  // ... existing fields
  password     String?  // Made optional for Google OAuth users
  googleId     String?  @unique // Google user ID
  isGoogleUser Boolean  @default(false) // Flag to identify Google OAuth users
  emailVerified Boolean @default(false) // Email verification status
}
```

### Core Components

1. **Google Configuration** ([`src/config/google.js`](src/config/google.js))

   - Google OAuth2 client initialization
   - Token verification utilities
   - Configuration validation

2. **Authentication Service** ([`src/services/auth.service.js`](src/services/auth.service.js))

   - `googleLogin()` - Handle Google OAuth login flow
   - `linkGoogleAccount()` - Link Google account to existing user
   - `unlinkGoogleAccount()` - Unlink Google account with safety checks

3. **Authentication Controller** ([`src/controllers/auth.controller.js`](src/controllers/auth.controller.js))

   - `googleLogin()` - Google OAuth login endpoint
   - `linkGoogleAccount()` - Link Google account endpoint
   - `unlinkGoogleAccount()` - Unlink Google account endpoint

4. **Validation Schemas** ([`src/validations/auth.validation.js`](src/validations/auth.validation.js))

   - `googleLogin` - Validate Google ID token
   - `linkGoogleAccount` - Validate Google ID token for linking

5. **Routes** ([`src/routes/auth.routes.js`](src/routes/auth.routes.js))
   - `POST /api/auth/google/login` - Google OAuth login
   - `POST /api/auth/google/link` - Link Google account (protected)
   - `POST /api/auth/google/unlink` - Unlink Google account (protected)

## API Endpoints

### 1. Google OAuth Login

**Endpoint**: `POST /api/auth/google/login`

**Description**: Authenticate user with Google ID token. Creates new user if doesn't exist, or logs in existing user.

**Request Body**:

```json
{
  "idToken": "google-id-token-from-frontend"
}
```

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "user-id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "USER",
      "avatar": "https://lh3.googleusercontent.com/...",
      "isGoogleUser": true,
      "emailVerified": true,
      "createdAt": "2025-08-31T07:00:00.000Z",
      "updatedAt": "2025-08-31T07:00:00.000Z"
    },
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token-uuid"
  }
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid Google token or deactivated account
- `500 Internal Server Error`: Server error

### 2. Link Google Account

**Endpoint**: `POST /api/auth/google/link`

**Description**: Link Google account to currently authenticated user.

**Headers**:

```
Authorization: Bearer <access-token>
```

**Request Body**:

```json
{
  "idToken": "google-id-token-from-frontend"
}
```

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Google account linked successfully",
  "data": {
    "user": {
      "id": "user-id",
      "name": "User Name",
      "email": "user@example.com",
      "isGoogleUser": true,
      "emailVerified": true
      // ... other user fields
    }
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid token, account already linked, or email mismatch
- `401 Unauthorized`: Invalid or missing access token
- `500 Internal Server Error`: Server error

### 3. Unlink Google Account

**Endpoint**: `POST /api/auth/google/unlink`

**Description**: Unlink Google account from currently authenticated user.

**Headers**:

```
Authorization: Bearer <access-token>
```

**Response** (Success - 200):

```json
{
  "success": true,
  "message": "Google account unlinked successfully",
  "data": {
    "user": {
      "id": "user-id",
      "name": "User Name",
      "email": "user@example.com",
      "isGoogleUser": false
      // ... other user fields
    }
  }
}
```

**Error Responses**:

- `400 Bad Request`: No Google account linked or cannot unlink (no password set)
- `401 Unauthorized`: Invalid or missing access token
- `500 Internal Server Error`: Server error

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen
6. Add authorized JavaScript origins (your frontend domains)
7. Add authorized redirect URIs (your frontend callback URLs)
8. Copy Client ID and Client Secret to your `.env` file

## Frontend Integration

### NextAuth Configuration

The backend is designed to work with NextAuth.js on the frontend. Here's an example NextAuth configuration:

```javascript
// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        try {
          // Send Google ID token to your backend
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                idToken: account.id_token,
              }),
            }
          );

          const data = await response.json();

          if (data.success) {
            // Store backend tokens in session
            user.backendAccessToken = data.data.accessToken;
            user.backendRefreshToken = data.data.refreshToken;
            return true;
          }
        } catch (error) {
          console.error("Backend authentication failed:", error);
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.backendAccessToken = user.backendAccessToken;
        token.backendRefreshToken = user.backendRefreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.backendAccessToken = token.backendAccessToken;
      session.backendRefreshToken = token.backendRefreshToken;
      return session;
    },
  },
});
```

### Frontend Usage Example

```javascript
// Using the backend access token for API calls
import { useSession } from "next-auth/react";

function MyComponent() {
  const { data: session } = useSession();

  const callBackendAPI = async () => {
    const response = await fetch("/api/some-protected-endpoint", {
      headers: {
        Authorization: `Bearer ${session.backendAccessToken}`,
      },
    });
    return response.json();
  };

  return (
    <div>
      {session && <button onClick={callBackendAPI}>Call Backend API</button>}
    </div>
  );
}
```

## Security Considerations

1. **Token Verification**: All Google ID tokens are verified using Google's official library
2. **Email Matching**: When linking accounts, email addresses must match
3. **Account Safety**: Users cannot unlink Google accounts if they don't have a password set
4. **Unique Constraints**: Google IDs are unique across the system
5. **Account Deactivation**: Deactivated accounts cannot authenticate via Google OAuth

## User Flows

### New User Registration via Google

1. User clicks "Sign in with Google" on frontend
2. Frontend gets Google ID token via NextAuth
3. Frontend sends ID token to `POST /api/auth/google/login`
4. Backend verifies token with Google
5. Backend creates new user with Google information
6. Backend returns JWT tokens
7. User is logged in

### Existing User Login via Google

1. User clicks "Sign in with Google" on frontend
2. Frontend gets Google ID token via NextAuth
3. Frontend sends ID token to `POST /api/auth/google/login`
4. Backend verifies token and finds existing user by Google ID
5. Backend updates user profile from Google
6. Backend returns JWT tokens
7. User is logged in

### Linking Google Account

1. User logs in with regular credentials
2. User goes to account settings
3. User clicks "Link Google Account"
4. Frontend gets Google ID token
5. Frontend sends ID token to `POST /api/auth/google/link` with access token
6. Backend verifies token and email match
7. Backend links Google account to user
8. User can now login with either method

## Testing

Use the provided REST client file [`rest/auth-google.rest`](rest/auth-google.rest) to test all Google OAuth endpoints. The file includes:

- Google OAuth login tests (new and existing users)
- Account linking tests
- Account unlinking tests
- Error handling tests
- Complete integration flow tests

## Error Handling

The integration includes comprehensive error handling for:

- Invalid Google tokens
- Expired tokens
- Email mismatches
- Already linked accounts
- Missing passwords for unlinking
- Network errors
- Database errors

All errors are logged and return appropriate HTTP status codes with descriptive messages.

## Dependencies

- `google-auth-library`: Official Google authentication library
- `jsonwebtoken`: JWT token generation and verification
- `bcryptjs`: Password hashing (for mixed authentication)
- `uuid`: Refresh token generation
- `joi`: Request validation

## Troubleshooting

### Common Issues

1. **"Invalid Google token" error**

   - Check if Google Client ID matches between frontend and backend
   - Verify token hasn't expired
   - Ensure token is being sent correctly from frontend

2. **"Email mismatch" when linking**

   - Google account email must match existing user email
   - Check if user is logged into correct Google account

3. **"Cannot unlink Google account" error**

   - User must set a password before unlinking Google account
   - This prevents users from being locked out of their account

4. **Configuration errors**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Check Google Cloud Console configuration
   - Ensure authorized origins and redirect URIs are configured

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` to see detailed error messages and token verification logs.
