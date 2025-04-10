import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Determine the environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  isDevelopment,
  isProduction,
  // Add logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    enableConsole: true,
    enableFile: false
  }
}; 