import { z } from "zod";
import {
  IAISalesProvider,
  GenerateOptions,
  ConnectionTestResult,
  ProviderNotConfiguredError,
  AISchemaValidationError,
  AIRateLimitError,
  AIProviderError,
} from "./ai-provider.interface.js";

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class GeminiSalesDriver implements IAISalesProvider {
  public readonly providerName = "gemini";
  public readonly defaultModel: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: GeminiConfig = {}) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.defaultModel = config.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
    this.baseUrl = (config.baseUrl || process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  }

  /**
   * Generates a structured response strictly parsed and validated against a Zod schema
   */
  public async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemContext?: string,
    options?: GenerateOptions
  ): Promise<T> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ProviderNotConfiguredError(
        this.providerName,
        "Google Gemini API key is not configured. Please configure credentials in Sales Integrations."
      );
    }

    const selectedModel = options?.model || this.defaultModel;
    const systemPrompt = [
      systemContext || "You are an intelligent sales CRM assistant.",
      "CRITICAL: You must respond ONLY with a valid, parseable JSON object matching the requested schema. Do not include markdown code block formatting or backticks.",
    ].join("\n\n");

    const requestBody: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: options?.temperature ?? 0.2,
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      },
    };

    const targetUrl = `${this.baseUrl}/models/${selectedModel}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      throw new AIProviderError(
        this.providerName,
        500,
        `Network failure communicating with Google Gemini: ${err.message}`
      );
    }

    if (response.status === 400 || response.status === 403) {
      let errPayload: any = null;
      try {
        errPayload = await response.json();
      } catch {
        // no-op
      }
      const errMsg = JSON.stringify(errPayload || "");
      if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("PERMISSION_DENIED")) {
        throw new ProviderNotConfiguredError(
          this.providerName,
          "Authentication failed. Invalid Google Gemini API key or missing permissions."
        );
      }
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      throw new AIRateLimitError(this.providerName, retryAfter);
    }

    if (!response.ok) {
      let errorDetails: any = null;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }
      throw new AIProviderError(
        this.providerName,
        response.status,
        `Google Gemini API error (${response.status}): ${JSON.stringify(errorDetails)}`,
        errorDetails
      );
    }

    const data: any = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent || typeof rawContent !== "string") {
      throw new AIProviderError(
        this.providerName,
        502,
        "Google Gemini returned an empty or malformed candidate part structure.",
        data
      );
    }

    // Parse JSON
    let parsedJson: any;
    try {
      const cleanJson = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      parsedJson = JSON.parse(cleanJson);
    } catch (jsonErr: any) {
      throw new AISchemaValidationError(
        this.providerName,
        [{ message: `Malformed JSON: ${jsonErr.message}` }],
        rawContent
      );
    }

    // Validate with Zod
    const validationResult = schema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AISchemaValidationError(
        this.providerName,
        validationResult.error.errors,
        rawContent
      );
    }

    return validationResult.data;
  }

  /**
   * Generates a freeform natural language response for sales chat assistance
   */
  public async generateChatResponse(
    prompt: string,
    systemContext?: string,
    options?: GenerateOptions
  ): Promise<string> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ProviderNotConfiguredError(
        this.providerName,
        "Google Gemini API key is not configured. Please configure credentials in Sales Integrations."
      );
    }

    const selectedModel = options?.model || this.defaultModel;
    const requestBody: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        ...(options?.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      },
    };

    if (systemContext) {
      requestBody.systemInstruction = {
        parts: [{ text: systemContext }],
      };
    }

    const endpoint = `${this.baseUrl}/models/${selectedModel}:generateContent?key=${this.apiKey}`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr: any) {
      throw new AIProviderError(
        this.providerName,
        503,
        `Network error communicating with Google Gemini: ${networkErr.message}`
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new AIRateLimitError(this.providerName);
      }
      if (response.status === 400 && errText.includes("API_KEY_INVALID")) {
        throw new ProviderNotConfiguredError(this.providerName, "Invalid Google Gemini API Key");
      }
      throw new AIProviderError(
        this.providerName,
        response.status,
        `Gemini API error: ${errText}`
      );
    }

    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  /**
   * Tests connection, API key validity, and model readiness
   */
  public async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();
    if (!this.apiKey || !this.apiKey.trim()) {
      return {
        success: false,
        message: "Google Gemini API key is missing or not configured.",
        validatedAt,
      };
    }

    const startTime = Date.now();
    try {
      const testSchema = z.object({ status: z.string() });
      const result = await this.generateStructuredResponse(
        "Ping. Return status ok.",
        testSchema,
        "System ping test.",
        { maxTokens: 20, temperature: 0 }
      );

      const latencyMs = Date.now() - startTime;
      return {
        success: result.status?.toLowerCase().includes("ok") ?? true,
        message: `Successfully connected to Google Gemini (${this.defaultModel}).`,
        latencyMs,
        details: {
          model: this.defaultModel,
          baseUrl: this.baseUrl,
        },
        validatedAt,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        message: `Google Gemini connection test failed: ${err.message}`,
        latencyMs,
        details: {
          model: this.defaultModel,
          error: err.name,
          details: err.details,
        },
        validatedAt,
      };
    }
  }
}
