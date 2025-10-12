import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

// File filter for audio files
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'audio/flac',
    'video/mp4', // Sometimes audio files have video mime type
    'video/webm'
  ];

  const allowedExtensions = ['.mp3', '.wav', '.webm', '.mp4', '.m4a', '.aac', '.ogg', '.opus', '.flac'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Utility function to get file duration (basic implementation)
export const getAudioDuration = async (filePath: string): Promise<number> => {
  // For now, return 0. In production, you'd use a library like node-ffprobe
  // to get actual audio duration
  try {
    const stats = fs.statSync(filePath);
    // Rough estimation: 1MB ≈ 1 minute of audio (very rough)
    const sizeInMB = stats.size / (1024 * 1024);
    return Math.max(1, Math.round(sizeInMB * 60)); // Minimum 1 second
  } catch (error) {
    console.error("Error getting audio duration:", error);
    return 0;
  }
};

// Utility function to clean up uploaded files
export const cleanupFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error("Error cleaning up file:", error);
  }
};

// Utility function to validate audio file
export const validateAudioFile = (file: Express.Multer.File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: "File size too large. Maximum 50MB allowed." };
  }

  const allowedExtensions = ['.mp3', '.wav', '.webm', '.mp4', '.m4a', '.aac', '.ogg', '.opus', '.flac'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExt)) {
    return { valid: false, error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` };
  }

  return { valid: true };
};