import { Request, Response } from "express";
import { UserModel } from "../models/User.js";

export const testConnection = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Test database connection by counting users
    const userCount = await UserModel.countDocuments();
    
    res.status(200).json({
      message: "Database connection successful",
      userCount,
      databaseName: "speech-to-text",
      collectionName: "user-details",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Database connection test failed:", error);
    res.status(500).json({
      message: "Database connection failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};