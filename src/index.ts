import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import morgan from "morgan";
import dotenv from "dotenv";
import "express-async-errors";
import { registerRoutes } from "./routes.js";
import { connectDB } from "./config/database.js";
import { logger } from "./utils/logger.js";

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // 100 requests per window
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per window without delay
  delayMs: 100, // add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // maximum delay of 2 seconds
});

app.use('/api/', limiter);
app.use('/api/', speedLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Custom request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && Object.keys(capturedJsonResponse).length > 0) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 150) logLine = logLine.slice(0, 149) + "…";
      logger.info(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('🚀 Starting Speech-to-Text API server...');

    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      logger.error('Global error handler:', {
        status,
        message,
        stack: err.stack,
        url: _req.url,
        method: _req.method
      });
      
      res.status(status).json({ 
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });

    // 404 handler for undefined routes
    app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        message: `Route ${req.originalUrl} not found`,
        availableRoutes: ['/api/health', '/api/login', '/api/register']
      });
    });

    // Get port from environment or use default 5000
    const port = parseInt(process.env.PORT || "5000", 10);

    // Start server
    server.listen(port, '0.0.0.0', () => {
      logger.info(`✅ Server running on http://0.0.0.0:${port}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📚 API Documentation: http://0.0.0.0:${port}/api/health`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        
        try {
          // Close database connection
          const mongoose = await import('mongoose');
          await mongoose.default.connection.close();
          logger.info('Database connection closed.');
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();
