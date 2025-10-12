import { z } from "zod";

// Enhanced email validation with stricter regex
const emailSchema = z.string()
  .email("Invalid email format")
  .regex(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    "Email must be in valid format (e.g., user@domain.com)"
  )
  .min(5, "Email must be at least 5 characters")
  .max(254, "Email must not exceed 254 characters")
  .toLowerCase();

// Password validation with stronger requirements
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// User schema for validation
export const insertUserSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const updateUserSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores")
    .optional(),
  email: emailSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete account"),
});

// Transcription schema for validation
export const createTranscriptionSchema = z.object({
  title: z.string().min(1).max(200).optional().default("New Transcription"),
  source: z.enum(["upload", "recording"]).optional().default("upload"),
});

export const updateTranscriptionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type DeleteAccount = z.infer<typeof deleteAccountSchema>;
export type CreateTranscription = z.infer<typeof createTranscriptionSchema>;
export type UpdateTranscription = z.infer<typeof updateTranscriptionSchema>;

export interface User {
  _id: string;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transcription {
  _id: string;
  userId: string;
  title: string;
  originalFilename: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  transcription: string;
  confidence: number;
  language: string;
  status: "processing" | "completed" | "failed";
  source: "upload" | "recording";
  metadata?: {
    deepgramRequestId?: string;
    modelInfo?: string;
    processingTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
