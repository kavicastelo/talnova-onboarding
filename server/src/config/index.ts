import dotenv from "dotenv";
import { envSchema } from "./env.schema.js";

// Load environment variables from .env file
dotenv.config();

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error: any) {
  console.error("❌ Invalid environment configuration:");
  if (error.format) {
    console.error(JSON.stringify(error.format(), null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
}

export const appConfig = {
  port: parsedEnv.PORT,
  host: parsedEnv.HOST,
  env: parsedEnv.NODE_ENV,
  logLevel: parsedEnv.LOG_LEVEL,
  isProduction: parsedEnv.NODE_ENV === "production",
  isDevelopment: parsedEnv.NODE_ENV === "development",
  isTest: parsedEnv.NODE_ENV === "test",
};

export const dbConfig = {
  uri: parsedEnv.MONGODB_URI,
};

export const jwtConfig = {
  secret: parsedEnv.JWT_SECRET,
  refreshSecret: parsedEnv.JWT_REFRESH_SECRET,
  cookieSecret: parsedEnv.COOKIE_SECRET,
  accessTokenExpiry: "15m",
  refreshTokenExpiry: "30d",
};

export const storageConfig = {
  endpoint: parsedEnv.R2_ENDPOINT,
  bucket: parsedEnv.R2_BUCKET,
  accessKeyId: parsedEnv.R2_ACCESS_KEY_ID,
  secretAccessKey: parsedEnv.R2_SECRET_ACCESS_KEY,
  publicUrl: parsedEnv.R2_PUBLIC_URL,
  maxUploadSize: parsedEnv.MAX_UPLOAD_SIZE,
};

export const corsConfig = {
  allowedOrigins: parsedEnv.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
};

export const emailConfig = {
  host: parsedEnv.SMTP_HOST,
  port: parsedEnv.SMTP_PORT,
  user: parsedEnv.SMTP_USER,
  pass: parsedEnv.SMTP_PASS,
  from: parsedEnv.SMTP_FROM,
};

export const config = {
  app: appConfig,
  db: dbConfig,
  jwt: jwtConfig,
  storage: storageConfig,
  cors: corsConfig,
  email: emailConfig,
};

export default config;
