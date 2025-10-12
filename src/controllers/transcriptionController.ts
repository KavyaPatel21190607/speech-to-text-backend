import { Response } from "express";
import { TranscriptionModel } from "../models/Transcription.js";
import { UserModel } from "../models/User.js";
import { deepgramService } from "../services/deepgramService.js";
import { getAudioDuration, cleanupFile, validateAudioFile } from "../utils/fileUpload.js";
import { createTranscriptionSchema, updateTranscriptionSchema } from "../shared/schema.js";
import { AuthenticatedRequest } from "../utils/jwt.js";
import fs from "fs";
import bcrypt from "bcryptjs";

// Optimized transcription for recordings using buffer method
const transcribeRecordingOptimized = async (filePath: string, mimeType: string) => {
  console.log("🎤 Using optimized recording transcription");
  const audioBuffer = fs.readFileSync(filePath);
  const result = await deepgramService.transcribeBuffer(audioBuffer, mimeType);
  
  // Keep the file for now (don't clean up immediately for recordings)
  // cleanupFile(filePath);
  
  return result;
};

export const uploadAndTranscribe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let filePath: string | undefined;
  
  try {
    const file = req.file;
    const userId = req.user!.userId;
    
    console.log("📤 Upload request received:", {
      file: file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      } : null,
      body: req.body,
      userId
    });
    
    if (!file) {
      console.log("❌ No file provided");
      res.status(400).json({ 
        success: false,
        message: "No audio file provided" 
      });
      return;
    }

    // Validate file
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      console.log("❌ File validation failed:", validation.error);
      res.status(400).json({ 
        success: false,
        message: validation.error 
      });
      return;
    }

    // Validate request body with defaults
    const bodyValidation = createTranscriptionSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      console.log("❌ Body validation failed:", bodyValidation.error.errors);
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: bodyValidation.error.errors,
      });
      return;
    }

    console.log("✅ Validation passed");
    const { title, source } = bodyValidation.data;
    filePath = file.path;

    console.log(`📁 Processing upload: ${file.originalname} (${file.size} bytes)`);

    // Get user details
    const user = await UserModel.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
      return;
    }

    // Read audio file data and convert to base64 for MongoDB Compass accessibility
    const audioBuffer = fs.readFileSync(filePath);
    const audioData = audioBuffer.toString('base64');

    // Get audio duration
    const duration = await getAudioDuration(filePath);

    // Create initial transcription record with user details and audio data
    const transcription = new TranscriptionModel({
      userId,
      username: user.username,
      email: user.email,
      title,
      originalFilename: file.originalname,
      fileUrl: filePath,
      audioData, // Store audio file in database
      mimeType: file.mimetype,
      fileSize: file.size,
      duration,
      transcription: "", // Will be updated after processing
      source,
      status: "processing",
    });

    await transcription.save();

    // Start transcription process (async)
    // Use different methods based on source type for optimization
    const transcriptionPromise = source === "recording" 
      ? transcribeRecordingOptimized(filePath, file.mimetype)
      : deepgramService.transcribeFile(filePath);
    
    transcriptionPromise
      .then(async (result: any) => {
        // Update transcription with results
        transcription.transcription = result.transcription;
        transcription.confidence = result.confidence;
        transcription.duration = result.duration || duration;
        transcription.status = "completed";
        transcription.metadata = result.metadata;
        
        await transcription.save();
        console.log(`✅ Transcription completed for: ${file.originalname}`);
      })
      .catch(async (error: any) => {
        console.error(`❌ Transcription failed for: ${file.originalname}`, error);
        transcription.status = "failed";
        await transcription.save();
        
        // Clean up file on error
        if (filePath) {
          cleanupFile(filePath);
        }
      });

    res.status(201).json({
      success: true,
      transcriptionId: transcription._id,
      message: "File uploaded successfully. Transcription in progress.",
      transcription: {
        id: transcription._id,
        title: transcription.title,
        status: transcription.status,
        originalFilename: transcription.originalFilename,
        fileSize: transcription.fileSize,
        duration: transcription.duration,
        createdAt: transcription.createdAt,
      },
    });

  } catch (error) {
    console.error("Upload and transcribe error:", error);
    
    // Cleanup file if upload failed
    if (filePath) {
      cleanupFile(filePath);
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to process audio file" 
    });
  }
};

export const getTranscriptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = 1, limit = 10, search, status } = req.query;
    
    // Build query
    const query: any = { userId };
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Get transcriptions with pagination
    const transcriptions = await TranscriptionModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-metadata'); // Exclude large metadata from list view

    // Get total count for pagination
    const total = await TranscriptionModel.countDocuments(query);
    
    res.status(200).json({
      transcriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });

  } catch (error) {
    console.error("Get transcriptions error:", error);
    res.status(500).json({ message: "Failed to fetch transcriptions" });
  }
};

export const getTranscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    const transcription = await TranscriptionModel.findOne({
      _id: id,
      userId,
    });

    if (!transcription) {
      res.status(404).json({ message: "Transcription not found" });
      return;
    }

    res.status(200).json({ transcription });

  } catch (error) {
    console.error("Get transcription error:", error);
    res.status(500).json({ message: "Failed to fetch transcription" });
  }
};

export const updateTranscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    // Validate request body
    const validation = updateTranscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const transcription = await TranscriptionModel.findOneAndUpdate(
      { _id: id, userId },
      validation.data,
      { new: true }
    );

    if (!transcription) {
      res.status(404).json({ message: "Transcription not found" });
      return;
    }

    res.status(200).json({
      message: "Transcription updated successfully",
      transcription,
    });

  } catch (error) {
    console.error("Update transcription error:", error);
    res.status(500).json({ message: "Failed to update transcription" });
  }
};

export const deleteTranscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { password } = req.body;

    // Verify password is provided
    if (!password) {
      res.status(400).json({ message: "Password is required to delete transcription" });
      return;
    }

    // Get user to verify password
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid password. Deletion cancelled." });
      return;
    }
    
    const transcription = await TranscriptionModel.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!transcription) {
      res.status(404).json({ message: "Transcription not found" });
      return;
    }

    // Cleanup associated file
    cleanupFile(transcription.fileUrl);

    res.status(200).json({ message: "Transcription deleted successfully" });

  } catch (error) {
    console.error("Delete transcription error:", error);
    res.status(500).json({ message: "Failed to delete transcription" });
  }
};

export const getUserStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    // Get various statistics
    const [
      totalTranscriptions,
      completedTranscriptions,
      totalDuration,
      recentTranscriptions,
      weeklyStats
    ] = await Promise.all([
      TranscriptionModel.countDocuments({ userId }),
      TranscriptionModel.countDocuments({ userId, status: "completed" }),
      TranscriptionModel.aggregate([
        { $match: { userId: userId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$duration" } } }
      ]),
      TranscriptionModel.countDocuments({ 
        userId, 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      TranscriptionModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title createdAt duration status')
    ]);

    const totalMinutes = totalDuration[0]?.total || 0;

    res.status(200).json({
      stats: {
        totalTranscriptions,
        completedTranscriptions,
        totalMinutes: Math.round(totalMinutes / 60),
        thisWeek: recentTranscriptions,
      },
      recentTranscriptions: weeklyStats,
    });

  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Failed to fetch user statistics" });
  }
};

export const downloadTranscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { format = 'txt' } = req.query;
    
    const transcription = await TranscriptionModel.findOne({
      _id: id,
      userId,
    });

    if (!transcription) {
      res.status(404).json({ message: "Transcription not found" });
      return;
    }

    if (transcription.status !== "completed") {
      res.status(400).json({ message: "Transcription not yet completed" });
      return;
    }

    // Generate filename
    const filename = `${transcription.title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify({
        title: transcription.title,
        transcription: transcription.transcription,
        duration: transcription.duration,
        confidence: transcription.confidence,
        createdAt: transcription.createdAt,
        metadata: transcription.metadata,
      }, null, 2));
    } else {
      // Default to plain text
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(transcription.transcription);
    }

  } catch (error) {
    console.error("Download transcription error:", error);
    res.status(500).json({ message: "Failed to download transcription" });
  }
};

// Download original audio file
export const downloadAudioFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const transcriptionId = req.params.id;
    const userId = req.user!.userId;

    const transcription = await TranscriptionModel.findOne({
      _id: transcriptionId,
      userId,
    });

    if (!transcription) {
      res.status(404).json({ message: "Transcription not found" });
      return;
    }

    // Check if audio data exists in database
    if (!transcription.audioData) {
      res.status(404).json({ message: "Audio file data not found in database" });
      return;
    }

    // Convert base64 string back to buffer for download
    const audioBuffer = Buffer.from(transcription.audioData, 'base64');

    // Set appropriate headers for audio file download
    res.setHeader('Content-Type', transcription.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${transcription.originalFilename}"`);
    res.setHeader('Content-Length', audioBuffer.length);
    
    // Send the audio data from database
    res.send(audioBuffer);
    
  } catch (error) {
    console.error("Error downloading audio file:", error);
    res.status(500).json({ message: "Failed to download audio file" });
  }
};