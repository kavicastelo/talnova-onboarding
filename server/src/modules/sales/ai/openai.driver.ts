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

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAISalesDriver implements IAISalesProvider {
  public readonly providerName = "openai";
  public readonly defaultModel: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: OpenAIConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.defaultModel = config.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.baseUrl = (config.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
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
        "OpenAI API key is not configured. Please configure credentials in Sales Integrations."
      );
    }

    const selectedModel = options?.model || this.defaultModel;
    const systemPrompt = [
      systemContext || "You are an intelligent sales CRM assistant.",
      "CRITICAL: You must respond ONLY with a valid, parseable JSON object matching the requested schema. Do not include markdown code block formatting or backticks.",
    ].join("\n\n");

    const requestBody = {
      model: selectedModel,
      messages: [
        { role: "system", "content": systemPrompt },
        { role: "user", "content": prompt },
      ],
      response_format: { type: "json_object" },
      temperature: options?.temperature ?? 0.2,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      throw new AIProviderError(
        this.providerName,
        500,
        `Network failure communicating with OpenAI: ${err.message}`
      );
    }

    if (response.status === 401) {
      throw new ProviderNotConfiguredError(
        this.providerName,
        "Authentication failed. Invalid OpenAI API key provided."
      );
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
        `OpenAI API error (${response.status}): ${JSON.stringify(errorDetails)}`,
        errorDetails
      );
    }

    const data: any = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      throw new AIProviderError(
        this.providerName,
        502,
        "OpenAI returned an empty or malformed message content structure.",
        data
      );
    }

    // Parse JSON
    let parsedJson: any;
    try {
      // Clean possible outer markdown fences if returned
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
        "OpenAI API key is not configured. Please configure credentials in Sales Integrations."
      );
    }

    const selectedModel = options?.model || this.defaultModel;
    const messages: Array<{ role: string; content: string }> = [];
    if (systemContext) {
      messages.push({ role: "system", content: systemContext });
    }
    messages.push({ role: "user", content: prompt });

    const requestBody = {
      model: selectedModel,
      messages,
      temperature: options?.temperature ?? 0.3,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr: any) {
      throw new AIProviderError(
        this.providerName,
        503,
        `Network error communicating with OpenAI: ${networkErr.message}`
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new AIRateLimitError(this.providerName);
      }
      if (response.status === 401) {
        throw new ProviderNotConfiguredError(this.providerName, "Invalid OpenAI API Key");
      }
      throw new AIProviderError(
        this.providerName,
        response.status,
        `OpenAI API error: ${errText}`
      );
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  /**
   * Tests connection, API key validity, and model readiness
   */
  public async testConnection(): Promise<ConnectionTestResult> {
    const validatedAt = new Date().toISOString();
    if (!this.apiKey || !this.apiKey.trim()) {
      return {
        success: false,
        message: "OpenAI API key is missing or not configured.",
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
        message: `Successfully connected to OpenAI (${this.defaultModel}).`,
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
        message: `OpenAI connection test failed: ${err.message}`,
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
