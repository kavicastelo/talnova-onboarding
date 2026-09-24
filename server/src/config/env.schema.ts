import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
  JWT_REFRESH_SECRET: z.string().min(8, "JWT_REFRESH_SECRET must be at least 8 characters"),
  COOKIE_SECRET: z.string().min(8, "COOKIE_SECRET must be at least 8 characters"),
  R2_ENDPOINT: z.string().min(1, "R2_ENDPOINT is required"),
  R2_BUCKET: z.string().min(1, "R2_BUCKET is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_PUBLIC_URL: z.string().min(1, "R2_PUBLIC_URL is required"),
  MAX_UPLOAD_SIZE: z.coerce.number().default(524288000),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),
  SMTP_FROM: z.string().default("noreply@talnova.com"),
  APP_ENV: z.enum(["development", "production", "test", "demo"]).default("development"),
  DEMO_DATABASE_URL: z.string().optional(),
  DEMO_JWT_SECRET: z.string().min(8).optional(),
  DEMO_SESSION_SECRET: z.string().min(8).optional(),
  DEMO_STORAGE_BUCKET: z.string().default("talnova-demo-assets"),
  DEMO_MAX_CONCURRENT_SESSIONS: z.coerce.number().default(1),
  DEMO_SESSION_DURATION_MINUTES: z.coerce.number().default(60),
  DEMO_INACTIVITY_TIMEOUT_MINUTES: z.coerce.number().default(15),
  DEMO_WATERMARK_ENABLED: z.coerce.boolean().default(true),
  DEMO_RESET_CONFIRMATION_KEY: z.string().default("RESET DEMO"),
}).refine(
  (data) => {
    if (data.APP_ENV === "demo" && !data.DEMO_DATABASE_URL) {
      return false;
    }
    return true;
  },
  {
    message: "FATAL: DEMO_DATABASE_URL is strictly required when APP_ENV is 'demo'",
    path: ["DEMO_DATABASE_URL"],
  }
).refine(
  (data) => {
    if (data.DEMO_DATABASE_URL && data.DEMO_DATABASE_URL === data.MONGODB_URI && data.NODE_ENV === "production") {
      return false;
    }
    return true;
  },
  {
    message: "FATAL: DEMO_DATABASE_URL must never be identical to MONGODB_URI in production",
    path: ["DEMO_DATABASE_URL"],
  }
);

export type EnvConfig = z.infer<typeof envSchema>;
