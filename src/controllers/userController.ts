import { Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.js";
import { updateUserSchema, changePasswordSchema, deleteAccountSchema } from "../shared/schema.js";
import { AuthenticatedRequest } from "../utils/jwt.js";
import { TranscriptionModel } from "../models/Transcription.js";
import fs from "fs";

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    // Validate request body
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const updateData = validation.data;

    // Check if email is being updated and if it already exists
    if (updateData.email) {
      const existingUser = await UserModel.findOne({
        email: updateData.email,
        _id: { $ne: userId },
      });

      if (existingUser) {
        res.status(409).json({ message: "Email already in use" });
        return;
      }
    }

    // Check if username is being updated and if it already exists
    if (updateData.username) {
      const existingUser = await UserModel.findOne({
        username: updateData.username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        res.status(409).json({ message: "Username already taken" });
        return;
      }
    }

    // Update user
    const user = await UserModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    console.log(`🔐 Password change request for user ID: ${userId}`);
    
    // Validate request body
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      console.log("❌ Password change validation failed:", validation.error.errors);
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user with password
    const user = await UserModel.findById(userId);
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      res.status(404).json({ message: "User not found" });
      return;
    }

    console.log(`👤 Found user: ${user.username} (${user.email})`);

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      console.log("❌ Current password is incorrect");
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    console.log("✅ Current password verified");

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      console.log("❌ New password is the same as current password");
      res.status(400).json({ message: "New password must be different from current password" });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    console.log("🔒 New password hashed successfully");

    // Update password
    const updateResult = await UserModel.findByIdAndUpdate(
      userId,
      { password: hashedNewPassword },
      { new: true }
    );

    if (!updateResult) {
      console.log("❌ Failed to update password in database");
      res.status(500).json({ message: "Failed to update password" });
      return;
    }

    console.log("✅ Password changed successfully");
    res.status(200).json({ message: "Password changed successfully" });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
};

export const deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    console.log(`🗑️ Delete account request received for user ID: ${userId}`);
    console.log("Request body:", req.body);
    
    // Validate request body
    const validation = deleteAccountSchema.safeParse(req.body);
    if (!validation.success) {
      console.log("❌ Validation failed:", validation.error.errors);
      res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
      return;
    }

    const { password } = validation.data;
    console.log("✅ Password validation passed");

    // Get user with password
    const user = await UserModel.findById(userId);
    if (!user) {
      console.log(`❌ User not found with ID: ${userId}`);
      res.status(404).json({ message: "User not found" });
      return;
    }

    console.log(`👤 Found user: ${user.username} (${user.email})`);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log("❌ Password verification failed");
      res.status(401).json({ message: "Incorrect password" });
      return;
    }

    console.log("✅ Password verified successfully");
    console.log(`🗑️ Starting account deletion for user: ${user.username} (${user.email})`);

    // Step 1: Get all user's transcriptions
    const userTranscriptions = await TranscriptionModel.find({ userId });
    console.log(`📄 Found ${userTranscriptions.length} transcriptions to delete`);

    // Step 2: Delete associated files
    let filesDeleted = 0;
    for (const transcription of userTranscriptions) {
      if (transcription.fileUrl && fs.existsSync(transcription.fileUrl)) {
        try {
          fs.unlinkSync(transcription.fileUrl);
          filesDeleted++;
          console.log(`🗑️ Deleted file: ${transcription.fileUrl}`);
        } catch (fileError) {
          console.error(`❌ Failed to delete file ${transcription.fileUrl}:`, fileError);
          // Continue with deletion even if file deletion fails
        }
      }
    }

    // Step 3: Delete all user's transcriptions from database
    const deletedTranscriptions = await TranscriptionModel.deleteMany({ userId });
    console.log(`📊 Deleted ${deletedTranscriptions.deletedCount} transcriptions from database`);

    // Step 4: Delete user account
    const deletedUser = await UserModel.findByIdAndDelete(userId);
    if (!deletedUser) {
      console.log("❌ Failed to delete user from database");
      res.status(500).json({ message: "Failed to delete user account" });
      return;
    }
    
    console.log(`✅ Successfully deleted user account: ${user.username}`);

    res.status(200).json({ 
      message: "Account deleted successfully",
      details: {
        transcriptionsDeleted: deletedTranscriptions.deletedCount,
        filesDeleted: filesDeleted,
        userDeleted: true
      }
    });

  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
};

export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    const user = await UserModel.findById(userId).select("-password");
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
      },
    });

  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};