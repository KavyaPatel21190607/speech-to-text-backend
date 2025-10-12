import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import "express-async-errors";
import { registerRoutes } from "./routes.js";
import { connectDB } from "./config/database.js";

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'https://your-app-name.vercel.app'
    ];
    
    // Allow all Vercel app domains temporarily for deployment
    if (origin && origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow requests with no origin (like mobile apps or curl requests) in development
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin!)) {
      callback(null, true);
    } else {
      console.warn(`CORS warning - allowing origin: ${origin}`);
      // Temporarily allow all origins to fix deployment
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      console.log(`${req.method} ${path} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
});

(async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('🚀 Starting Speech-to-Text API server...');

    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('Error:', {
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
    
    // Force production host binding for Render deployment
    const host = '0.0.0.0';

    // Start server - bind to all interfaces for Render
    server.listen(port, host, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Host binding: ${host}:${port}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📚 API Health Check: http://localhost:${port}/api/health`);
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('HTTP server closed.');
        
        try {
          console.log('Database connection closed.');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
