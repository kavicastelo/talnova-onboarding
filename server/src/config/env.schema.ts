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
});

export type EnvConfig = z.infer<typeof envSchema>;
