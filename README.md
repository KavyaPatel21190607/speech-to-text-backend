# Speech-to-Text Backend API

A production-ready Node.js/Express backend API for the Speech-to-Text application with MongoDB and JWT authentication.

## 🚀 Features

- **JWT Authentication** with access and refresh tokens
- **Audio Upload & Transcription** using Deepgram API
- **User Management** - registration, login, profile management
- **MongoDB Integration** with Mongoose ODM
- **File Upload Handling** with Multer
- **Input Validation** with Zod schemas
- **CORS Configuration** for frontend integration
- **Error Handling** with proper HTTP status codes
- **Production-ready** setup with TypeScript

## 📁 Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Main application entry point
│   ├── routes.ts              # API route definitions
│   ├── config/
│   │   └── database.ts        # MongoDB connection
│   ├── controllers/
│   │   ├── authController.ts  # Authentication endpoints
│   │   ├── userController.ts  # User management
│   │   ├── transcriptionController.ts # Audio & transcription
│   │   └── testController.ts  # Health checks
│   ├── models/
│   │   ├── User.ts           # User MongoDB schema
│   │   └── Transcription.ts  # Transcription MongoDB schema
│   ├── services/
│   │   └── deepgramService.ts # Deepgram API integration
│   ├── utils/
│   │   ├── jwt.ts           # JWT token utilities
│   │   ├── fileUpload.ts    # File upload configuration
│   │   └── logger.ts        # Logging utilities
│   ├── middleware/          # Custom middleware
│   ├── types/              # TypeScript type definitions
│   └── shared/
│       └── schema.ts       # Validation schemas
├── uploads/                # File upload directory
├── .env                    # Environment variables
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js (v18.0.0 or higher)
- npm (v8.0.0 or higher)
- MongoDB Atlas account or local MongoDB
- Deepgram API key

### Installation Steps

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the backend root with:
   ```env
   # MongoDB Connection
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/speech-to-text
   
   # JWT Secrets
   JWT_SECRET=your-super-secure-jwt-access-token-secret
   JWT_REFRESH_SECRET=your-super-secure-jwt-refresh-token-secret
   JWT_ACCESS_TOKEN_EXPIRE=15m
   JWT_REFRESH_TOKEN_EXPIRE=7d
   
   # Deepgram API Key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # CORS Settings
   FRONTEND_URL=http://localhost:3000
   ALLOWED_ORIGINS=http://localhost:3000
   
   # File Upload
   MAX_FILE_SIZE=50MB
   UPLOAD_DIR=uploads
   
   # Security
   BCRYPT_ROUNDS=12
   MAX_LOGIN_ATTEMPTS=5
   ACCOUNT_LOCKOUT_TIME=2h
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/profile` - Get user profile (protected)
- `POST /api/auth/logout` - Logout current session (protected)
- `POST /api/auth/logout-all` - Logout all devices (protected)

### User Management
- `GET /api/user/profile` - Get detailed user profile (protected)
- `PUT /api/user/profile` - Update user profile (protected)
- `PUT /api/user/change-password` - Change password (protected)
- `DELETE /api/user/account` - Delete account (protected)

### Transcriptions
- `POST /api/transcriptions/upload` - Upload and transcribe audio (protected)
- `GET /api/transcriptions` - Get user transcriptions (protected)
- `GET /api/transcriptions/stats` - Get user statistics (protected)
- `GET /api/transcriptions/:id` - Get specific transcription (protected)
- `PUT /api/transcriptions/:id` - Update transcription (protected)
- `DELETE /api/transcriptions/:id` - Delete transcription (protected)
- `GET /api/transcriptions/:id/download` - Download transcription (protected)
- `GET /api/transcriptions/:id/audio` - Download audio file (protected)

### System
- `GET /api/health` - Health check and API information
- `GET /api/test-db` - Database connection test

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication with the following features:

- **Access Tokens**: Short-lived (15 minutes) for API requests
- **Refresh Tokens**: Long-lived (7 days) for obtaining new access tokens
- **Token Validation**: Middleware protection for secure endpoints
- **Account Security**: Login attempt limiting and account lockout

### Usage Example

```javascript
// Login
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password' })
});

const { accessToken, refreshToken, user } = await response.json();

// Use access token for protected requests
const profileResponse = await fetch('/api/profile', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

## 🗃️ Database Schema

### Users Collection (`user-details`)
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  tokenVersion: Number,
  lastLoginAt: Date,
  loginAttempts: Number,
  lockUntil: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Transcriptions Collection (`audio-and-transcription`)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  username: String,
  email: String,
  title: String,
  originalFilename: String,
  fileUrl: String,
  audioData: String (base64),
  mimeType: String,
  fileSize: Number,
  duration: Number,
  transcription: String,
  confidence: Number,
  status: String,
  deepgramData: Object,
  createdAt: Date,
  updatedAt: Date
}
```

## 🎵 Audio Processing

Supported audio formats:
- MP3, WAV, WebM, MP4, M4A, AAC, OGG, Opus, FLAC
- Maximum file size: 50MB
- Processed using Deepgram Speech-to-Text API

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
DEEPGRAM_API_KEY=your-deepgram-api-key
PORT=5000
```

### Build and Start
```bash
npm run build
npm start
```

## 🧪 Development

### Available Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint (currently skipped)
- `npm test` - Run tests (currently skipped)

### Development Tools
- **TypeScript** for type safety
- **tsx** for development with hot reload
- **ESM modules** for modern JavaScript
- **Path aliases** for clean imports

## 📄 API Documentation

Visit `http://localhost:5000/api/health` when the server is running to see:
- API status and version
- Available endpoints
- Feature list
- Environment information

## 🔧 Configuration

### CORS Settings
The API is configured to accept requests from:
- `http://localhost:3000` (Vite dev server)
- `http://localhost:3000` (React dev server)
- Additional origins via `ALLOWED_ORIGINS` environment variable

### Security Features
- CORS protection
- Request size limits (10MB)
- JWT token validation
- Password hashing with bcrypt
- Account lockout on failed attempts

## ⚠️ Important Notes

1. **Environment Variables**: Never commit real secrets to version control
2. **MongoDB Collections**: Ensure collections `user-details` and `audio-and-transcription` exist
3. **Deepgram API**: Required for audio transcription functionality
4. **File Storage**: Uploaded files are stored locally in the `uploads` directory
5. **Frontend Integration**: Designed to work with the React frontend at `http://localhost:3000`

## 🤝 Contributing

1. Ensure all environment variables are set
2. Follow TypeScript best practices
3. Add proper error handling for new endpoints
4. Update API documentation for new features
5. Test with the frontend application

## 📞 Support

For issues or questions:
1. Check the health endpoint: `GET /api/health`
2. Verify database connection: `GET /api/test-db`
3. Check console logs for detailed error information
4. Ensure all environment variables are properly set

## 🎯 Next Steps

1. Add comprehensive API tests
2. Implement request logging with Winston
3. Add rate limiting middleware
4. Set up CI/CD pipeline
5. Add API documentation with Swagger
6. Implement file storage with cloud providers
7. Add monitoring and health checks