import { createClient } from "@deepgram/sdk";
import fs from "fs";
import { promisify } from "util";

const readFile = promisify(fs.readFile);

export class DeepgramService {
  private deepgram;
  
  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
    }
    this.deepgram = createClient(apiKey);
  }

  async transcribeFile(filePath: string): Promise<{
    transcription: string;
    confidence: number;
    duration: number;
    metadata: any;
  }> {
    try {
      console.log(`🎤 Transcribing file: ${filePath}`);
      
      // Read the audio file
      const audioBuffer = await readFile(filePath);
      
      // Configure transcription options
      const options = {
        model: "nova-2",
        language: "en",
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        diarize: false,
        sentiment: false,
        summarize: false,
      };

      // Send to Deepgram for transcription
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        options
      );

      if (error) {
        throw new Error(`Deepgram API error: ${error.message}`);
      }

      if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error("No transcription results returned from Deepgram");
      }

      const channel = result.results.channels[0];
      const alternative = channel.alternatives[0];
      
      // Extract transcription and metadata
      const transcription = alternative?.transcript || "";
      const confidence = alternative?.confidence || 0;
      const duration = result.metadata?.duration || 0;
      
      const metadata = {
        deepgramRequestId: result.metadata?.request_id,
        modelInfo: result.metadata?.model_info,
        processingTime: (result.metadata as any)?.processing?.total_time || 0,
        language: (result.metadata as any)?.detected_language,
        channels: result.metadata?.channels,
      };

      console.log(`✅ Transcription completed. Length: ${transcription.length} chars`);
      
      return {
        transcription,
        confidence,
        duration,
        metadata,
      };
      
    } catch (error) {
      console.error("❌ Deepgram transcription error:", error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async transcribeBuffer(audioBuffer: Buffer, mimeType: string): Promise<{
    transcription: string;
    confidence: number;
    duration: number;
    metadata: any;
  }> {
    try {
      console.log(`🎤 Transcribing audio buffer (${audioBuffer.length} bytes)`);
      
      // Configure transcription options
      const options = {
        model: "nova-2",
        language: "en",
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        diarize: false,
        sentiment: false,
        summarize: false,
        mimetype: mimeType,
      };

      // Send to Deepgram for transcription
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        options
      );

      if (error) {
        throw new Error(`Deepgram API error: ${error.message}`);
      }

      if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error("No transcription results returned from Deepgram");
      }

      const channel = result.results.channels[0];
      const alternative = channel.alternatives[0];
      
      // Extract transcription and metadata
      const transcription = alternative?.transcript || "";
      const confidence = alternative?.confidence || 0;
      const duration = result.metadata?.duration || 0;
      
      const metadata = {
        deepgramRequestId: result.metadata?.request_id,
        modelInfo: result.metadata?.model_info,
        processingTime: (result.metadata as any)?.processing?.total_time || 0,
        language: (result.metadata as any)?.detected_language,
        channels: result.metadata?.channels,
      };

      console.log(`✅ Transcription completed. Length: ${transcription.length} chars`);
      
      return {
        transcription,
        confidence,
        duration,
        metadata,
      };
      
    } catch (error) {
      console.error("❌ Deepgram transcription error:", error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Method to check if Deepgram service is available
  async healthCheck(): Promise<boolean> {
    try {
      // You can implement a simple health check here
      // For now, we'll just check if the API key is set
      return !!process.env.DEEPGRAM_API_KEY;
    } catch (error) {
      console.error("Deepgram health check failed:", error);
      return false;
    }
  }
}

// Lazy initialization to ensure environment variables are loaded
let deepgramServiceInstance: DeepgramService | null = null;

export const deepgramService = {
  getInstance(): DeepgramService {
    if (!deepgramServiceInstance) {
      deepgramServiceInstance = new DeepgramService();
    }
    return deepgramServiceInstance;
  },
  
  async transcribeFile(filePath: string) {
    return this.getInstance().transcribeFile(filePath);
  },
  
  async transcribeBuffer(buffer: Buffer, filename: string) {
    return this.getInstance().transcribeBuffer(buffer, filename);
  }
};