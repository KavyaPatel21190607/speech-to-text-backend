import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-fallback-refresh-secret";

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  tokenVersion?: number; // For token invalidation
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Generate access token (short-lived)
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: "15m", // 15 minutes for better security
    issuer: "speech-to-text-app",
    audience: "speech-to-text-users"
  });
};

// Generate refresh token (longer-lived)
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: "7d", // 7 days
    issuer: "speech-to-text-app",
    audience: "speech-to-text-users"
  });
};

// Legacy function for backward compatibility
export const generateToken = (payload: JWTPayload): string => {
  return generateAccessToken(payload);
};

// Verify access token
export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "speech-to-text-app",
      audience: "speech-to-text-users"
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("Access token verification failed:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: "speech-to-text-app",
      audience: "speech-to-text-users"
    }) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    console.error("Refresh token verification failed:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
};

// Legacy function for backward compatibility
export const verifyToken = (token: string): JWTPayload | null => {
  return verifyAccessToken(token);
};

// Check if token is expired
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// Get token expiration time
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
};

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ 
      message: "Access token required",
      code: "TOKEN_MISSING"
    });
    return;
  }

  // Check if token is expired before verification
  if (isTokenExpired(token)) {
    res.status(401).json({ 
      message: "Token has expired",
      code: "TOKEN_EXPIRED"
    });
    return;
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    res.status(403).json({ 
      message: "Invalid or malformed token",
      code: "TOKEN_INVALID"
    });
    return;
  }

  req.user = decoded;
  next();
};

// Optional authentication (doesn't fail if no token)
export const optionalAuthentication = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (token && !isTokenExpired(token)) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
};

// Validate token format
export const isValidTokenFormat = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  return parts.length === 3; // JWT should have 3 parts
};

// Extract user ID from token without verification (for logging/debugging)
export const extractUserIdFromToken = (token: string): string | null => {
  try {
    const decoded = jwt.decode(token) as any;
    return decoded?.userId || null;
  } catch (error) {
    return null;
  }
};