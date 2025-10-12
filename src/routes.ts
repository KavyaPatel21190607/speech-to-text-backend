import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Router } from "express";
import { register, login, getProfile, logout, logoutAllDevices } from "./controllers/authController.js";
import { 
  uploadAndTranscribe, 
  getTranscriptions, 
  getTranscription, 
  updateTranscription, 
  deleteTranscription, 
  getUserStats, 
  downloadTranscription,
  downloadAudioFile
} from "./controllers/transcriptionController.js";
import { 
  updateProfile, 
  changePassword, 
  deleteAccount, 
  getUserProfile 
} from "./controllers/userController.js";
import { testConnection } from "./controllers/testController.js";
import { authenticateToken } from "./utils/jwt.js";
import { upload } from "./utils/fileUpload.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create API router
  const apiRouter = Router();

  // Health check endpoint
  apiRouter.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      message: "Speech-to-Text API is running!", 
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || 'development',
      features: [
        "JWT Authentication with Refresh Tokens",
        "Audio Upload & Transcription (Deepgram)",
        "User Management & Profile",
        "MongoDB Storage",
        "Rate Limiting & Security",
        "RESTful API Design"
      ],
      endpoints: {
        auth: ["/api/register", "/api/login", "/api/profile"],
        transcriptions: ["/api/transcriptions", "/api/transcriptions/upload"],
        user: ["/api/user/profile", "/api/user/change-password"]
      }
    });
  });

  // Database test endpoint
  apiRouter.get("/test-db", testConnection);

  // Authentication routes
  apiRouter.post("/register", register);
  apiRouter.post("/login", login);
  apiRouter.get("/profile", authenticateToken, getProfile);
  
  // Enhanced auth routes
  apiRouter.post("/auth/logout", authenticateToken, logout);
  apiRouter.post("/auth/logout-all", authenticateToken, logoutAllDevices);

  // User profile management routes
  apiRouter.get("/user/profile", authenticateToken, getUserProfile);
  apiRouter.put("/user/profile", authenticateToken, updateProfile);
  apiRouter.put("/user/change-password", authenticateToken, changePassword);
  apiRouter.delete("/user/account", authenticateToken, deleteAccount);

  // Transcription routes
  apiRouter.post("/transcriptions/upload", authenticateToken, upload.single("audio"), uploadAndTranscribe);
  apiRouter.get("/transcriptions", authenticateToken, getTranscriptions);
  apiRouter.get("/transcriptions/stats", authenticateToken, getUserStats);
  apiRouter.get("/transcriptions/:id", authenticateToken, getTranscription);
  apiRouter.put("/transcriptions/:id", authenticateToken, updateTranscription);
  apiRouter.delete("/transcriptions/:id", authenticateToken, deleteTranscription);
  apiRouter.get("/transcriptions/:id/download", authenticateToken, downloadTranscription);
  apiRouter.get("/transcriptions/:id/audio", authenticateToken, downloadAudioFile);

  // Mount API router with /api prefix
  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
