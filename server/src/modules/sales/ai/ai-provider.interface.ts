import { z } from "zod";
import AppError from "../../../common/errors/app-error.js";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
  validatedAt: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class ProviderNotConfiguredError extends AppError {
  constructor(providerName: string, message?: string) {
    super(
      400,
      "PROVIDER_NOT_CONFIGURED",
      message || `AI Provider '${providerName}' is not configured. Missing required API key or credentials.`
    );
    this.name = "ProviderNotConfiguredError";
  }
}

export class AISchemaValidationError extends AppError {
  constructor(providerName: string, validationErrors: any, rawResponse?: string) {
    super(
      502,
      "AI_SCHEMA_VALIDATION_FAILED",
      `AI model output from '${providerName}' failed validation against the requested schema.`,
      { errors: validationErrors, rawResponse }
    );
    this.name = "AISchemaValidationError";
  }
}

export class AIRateLimitError extends AppError {
  constructor(providerName: string, retryAfterSeconds?: number) {
    super(
      429,
      "AI_RATE_LIMIT_EXCEEDED",
      `Rate limit exceeded for AI provider '${providerName}'. Please try again later.`,
      { retryAfterSeconds }
    );
    this.name = "AIRateLimitError";
  }
}

export class AIProviderError extends AppError {
  constructor(providerName: string, statusCode: number, message: string, details?: any) {
    super(
      statusCode || 500,
      "AI_PROVIDER_ERROR",
      `AI Provider '${providerName}' error: ${message}`,
      details
    );
    this.name = "AIProviderError";
  }
}

export interface IAISalesProvider {
  readonly providerName: string;
  readonly defaultModel: string;

  /**
   * Generates a structured response strictly parsed and validated against a Zod schema
   */
  generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemContext?: string,
    options?: GenerateOptions
  ): Promise<T>;

  /**
   * Generates a freeform natural language response for sales chat assistance
   */
  generateChatResponse(
    prompt: string,
    systemContext?: string,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * Tests connection, API key validity, and model readiness
   */
  testConnection(): Promise<ConnectionTestResult>;
}
