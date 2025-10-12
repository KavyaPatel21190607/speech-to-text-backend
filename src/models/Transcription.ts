import mongoose from "mongoose";

const transcriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // User details stored for easy access
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  originalFilename: {
    type: String,
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  // Audio file data stored as base64 for MongoDB Compass accessibility
  audioData: {
    type: String, // base64 encoded audio data
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // in seconds
    required: true,
  },
  transcription: {
    type: String,
    required: false, // Will be filled after processing
    default: "",
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  language: {
    type: String,
    default: "en",
  },
  status: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing",
  },
  source: {
    type: String,
    enum: ["upload", "recording"],
    required: true,
  },
  metadata: {
    deepgramRequestId: String,
    modelInfo: mongoose.Schema.Types.Mixed, // Allow objects
    processingTime: Number, // in milliseconds
  },
}, {
  timestamps: true,
  collection: 'audio-and-transcription' // Explicitly set collection name
});

// Indexes for better query performance
transcriptionSchema.index({ userId: 1, createdAt: -1 });
transcriptionSchema.index({ userId: 1, status: 1 });
transcriptionSchema.index({ userId: 1, title: "text" }); // Text search on title

export const TranscriptionModel = mongoose.model("Transcription", transcriptionSchema);