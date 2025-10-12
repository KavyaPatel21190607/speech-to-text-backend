import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://ku2407u661_db_user:QRIqFxXnFMNgsVj3@cluster0.xmyi9hz.mongodb.net/speech-to-text";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log("✅ MongoDB Disconnected");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error);
  }
};