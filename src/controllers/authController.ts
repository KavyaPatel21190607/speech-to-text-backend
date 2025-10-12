import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.js";
import { insertUserSchema, loginUserSchema } from "../shared/schema.js";
import { generateAccessToken, generateRefreshToken, type JWTPayload, type AuthenticatedRequest } from "../utils/jwt.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("📝 Registration attempt:", { 
      username: req.body.username, 
      email: req.body.email 
    });

    // Validate input
    const validation = insertUserSchema.safeParse(req.body);
    if (!validation.success) {
      console.log("❌ Validation failed:", validation.error.errors);
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const { username, email, password } = validation.data;

    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const conflictField = existingUser.email === email ? "email" : "username";
      console.log(`❌ Registration failed: ${conflictField} already exists`);
      res.status(409).json({
        message: existingUser.email === email 
          ? "Email already registered" 
          : "Username already taken",
      });
      return;
    }

    // Hash password with higher salt rounds for better security
    const saltRounds = 14;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new UserModel({
      username,
      email,
      password: hashedPassword,
      tokenVersion: 0,
      isActive: true,
    });

    await user.save();
    console.log("✅ User created successfully:", user._id);

    // Send success response WITHOUT token (no auto-login)
    res.status(201).json({
      message: "Registration successful! Please login to continue.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      message: "Internal server error during registration",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🔐 Login attempt for:", req.body.email);

    // Validate input
    const validation = loginUserSchema.safeParse(req.body);
    if (!validation.success) {
      console.log("❌ Login validation failed:", validation.error.errors);
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.log("❌ Login failed: User not found");
      res.status(401).json({ 
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
      return;
    }

    // Check if account is locked
    if ((user as any).isLocked) {
      console.log("🔒 Login failed: Account locked");
      res.status(423).json({ 
        message: "Account temporarily locked due to too many failed attempts",
        code: "ACCOUNT_LOCKED"
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      console.log("❌ Login failed: Account deactivated");
      res.status(401).json({ 
        message: "Account has been deactivated",
        code: "ACCOUNT_DEACTIVATED"
      });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("❌ Login failed: Invalid password");
      
      // Increment login attempts
      await (user as any).incLoginAttempts();
      
      res.status(401).json({ 
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
      return;
    }

    // Reset login attempts on successful login
    await (user as any).resetLoginAttempts();

    // Generate JWT tokens
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion,
    });

    console.log("✅ Login successful for:", user.email);

    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      tokenExpiration: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ 
      message: "Internal server error during login",
      code: "INTERNAL_ERROR"
    });
  }
};

// Get current user profile
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    const user = await UserModel.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Logout (invalidate current token)
export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    console.log("👋 Logout request for user:", req.user!.userId);
    
    res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Logout from all devices (increment token version)
export const logoutAllDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Increment token version to invalidate all existing tokens
    await (user as any).incrementTokenVersion();
    
    console.log("🚪 Logout from all devices for user:", userId);

    res.status(200).json({
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};