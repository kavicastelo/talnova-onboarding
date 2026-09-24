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

function resolveDemoDatabaseUrl(env: any): string | undefined {
  if (env.DEMO_DATABASE_URL) return env.DEMO_DATABASE_URL;
  if (!env.MONGODB_URI) return undefined;
  const uri = env.MONGODB_URI;
  if (uri.includes("?")) {
    const [base, query] = uri.split("?");
    const lastSlash = base.lastIndexOf("/");
    const dbName = base.substring(lastSlash + 1);
    const demoDbName = `${dbName}-Demo`;
    return `${base.substring(0, lastSlash + 1)}${demoDbName}?${query}`;
  }
  return `${uri}-Demo`;
}

export const demoConfig = {
  appEnv: parsedEnv.APP_ENV,
  isDemo: parsedEnv.APP_ENV === "demo",
  databaseUrl: resolveDemoDatabaseUrl(parsedEnv),
  jwtSecret: parsedEnv.DEMO_JWT_SECRET || parsedEnv.JWT_SECRET + "-demo",
  sessionSecret: parsedEnv.DEMO_SESSION_SECRET || parsedEnv.COOKIE_SECRET + "-demo",
  storageBucket: parsedEnv.DEMO_STORAGE_BUCKET,
  maxConcurrentSessions: parsedEnv.DEMO_MAX_CONCURRENT_SESSIONS,
  sessionDurationMinutes: parsedEnv.DEMO_SESSION_DURATION_MINUTES,
  inactivityTimeoutMinutes: parsedEnv.DEMO_INACTIVITY_TIMEOUT_MINUTES,
  watermarkEnabled: parsedEnv.DEMO_WATERMARK_ENABLED,
  resetConfirmationKey: parsedEnv.DEMO_RESET_CONFIRMATION_KEY,
};

export const config = {
  app: appConfig,
  db: dbConfig,
  jwt: jwtConfig,
  storage: storageConfig,
  cors: corsConfig,
  email: emailConfig,
  demo: demoConfig,
};

export default config;
