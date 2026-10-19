import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import mongoose from "mongoose";
import {
  OpenAISalesDriver,
  GeminiSalesDriver,
  MockAISalesDriver,
  AIClientFactory,
  ProviderNotConfiguredError,
  AISchemaValidationError,
  AIRateLimitError,
  AIProviderError,
} from "../modules/sales/ai/index.js";
import SalesIntegration from "../modules/sales/models/sales-integration.model.js";
import { encryptSecret } from "../utils/crypto.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";

describe("AI-001: AI Provider Adapters (OpenAI & Gemini) with Zod Parsing", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(() => {
    AIClientFactory.clearCache();
    AIClientFactory.getMockDriver().reset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("1. Typed Error Handling & Missing Key Guards", () => {
    it("should throw ProviderNotConfiguredError when OpenAI driver has no API key", async () => {
      const driver = new OpenAISalesDriver({ apiKey: "" });
      const schema = z.object({ answer: z.string() });

      await expect(
        driver.generateStructuredResponse("Test prompt", schema)
      ).rejects.toThrow(ProviderNotConfiguredError);

      try {
        await driver.generateStructuredResponse("Test prompt", schema);
      } catch (err: any) {
        expect(err.name).toBe("ProviderNotConfiguredError");
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe("PROVIDER_NOT_CONFIGURED");
        expect(err.message).toContain("OpenAI API key is not configured");
      }
    });

    it("should throw ProviderNotConfiguredError when Gemini driver has no API key", async () => {
      const driver = new GeminiSalesDriver({ apiKey: "" });
      const schema = z.object({ answer: z.string() });

      await expect(
        driver.generateStructuredResponse("Test prompt", schema)
      ).rejects.toThrow(ProviderNotConfiguredError);

      try {
        await driver.generateStructuredResponse("Test prompt", schema);
      } catch (err: any) {
        expect(err.name).toBe("ProviderNotConfiguredError");
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe("PROVIDER_NOT_CONFIGURED");
        expect(err.message).toContain("Google Gemini API key is not configured");
      }
    });

    it("should return false connection result when testConnection called on unconfigured driver", async () => {
      const openAiDriver = new OpenAISalesDriver({ apiKey: "" });
      const openAiResult = await openAiDriver.testConnection();
      expect(openAiResult.success).toBe(false);
      expect(openAiResult.message).toContain("OpenAI API key is missing");

      const geminiDriver = new GeminiSalesDriver({ apiKey: "" });
      const geminiResult = await geminiDriver.testConnection();
      expect(geminiResult.success).toBe(false);
      expect(geminiResult.message).toContain("Google Gemini API key is missing");
    });
  });

  describe("2. OpenAI Driver: Structured Output & Zod Validation", () => {
    it("should successfully generate and validate structured JSON response", async () => {
      const mockLeadAnalysisSchema = z.object({
        sentiment: z.enum(["positive", "neutral", "negative"]),
        score: z.number().min(0).max(100),
        recommendedAction: z.string(),
        keyPoints: z.array(z.string()),
      });

      const mockPayload = {
        sentiment: "positive",
        score: 85,
        recommendedAction: "Schedule enterprise discovery call within 24h",
        keyPoints: ["Budget approved for Q4", "Looking to migrate from legacy CRM"],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify(mockPayload),
              },
            },
          ],
        }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test-mock-key-12345" });
      const result = await driver.generateStructuredResponse(
        "Analyze lead notes: Budget approved for Q4",
        mockLeadAnalysisSchema,
        "You are an expert sales analyst."
      );

      expect(result).toEqual(mockPayload);
      expect(result.sentiment).toBe("positive");
      expect(result.score).toBe(85);
      expect(result.keyPoints).toHaveLength(2);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("https://api.openai.com/v1/chat/completions");
      expect(init.headers.Authorization).toBe("Bearer sk-test-mock-key-12345");
      const body = JSON.parse(init.body);
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.model).toBe("gpt-4o-mini");
    });

    it("should strip markdown fences from response and validate schema", async () => {
      const schema = z.object({ status: z.string(), count: z.number() });
      const mockPayload = { status: "active", count: 42 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: `\`\`\`json\n${JSON.stringify(mockPayload)}\n\`\`\``,
              },
            },
          ],
        }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test" });
      const result = await driver.generateStructuredResponse("Get stats", schema);
      expect(result).toEqual(mockPayload);
    });

    it("should throw AISchemaValidationError when JSON structure does not match schema", async () => {
      const schema = z.object({
        requiredField: z.string(),
        numericScore: z.number(),
      });

      // Missing numericScore
      const invalidPayload = { requiredField: "hello" };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(invalidPayload),
              },
            },
          ],
        }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test" });
      await expect(
        driver.generateStructuredResponse("Get data", schema)
      ).rejects.toThrow(AISchemaValidationError);
    });

    it("should throw AISchemaValidationError when output is not valid JSON", async () => {
      const schema = z.object({ answer: z.string() });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [
            {
              message: {
                content: "I cannot answer in JSON format.",
              },
            },
          ],
        }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test" });
      await expect(
        driver.generateStructuredResponse("Get data", schema)
      ).rejects.toThrow(AISchemaValidationError);
    });

    it("should throw AIRateLimitError on HTTP 429 response", async () => {
      const schema = z.object({ answer: z.string() });
      const headers = new Headers();
      headers.set("retry-after", "15");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ error: { message: "Rate limit reached" } }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test" });
      await expect(
        driver.generateStructuredResponse("Get data", schema)
      ).rejects.toThrow(AIRateLimitError);
    });

    it("should throw AIProviderError on HTTP 500 error", async () => {
      const schema = z.object({ answer: z.string() });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: "Internal server error" } }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-test" });
      await expect(
        driver.generateStructuredResponse("Get data", schema)
      ).rejects.toThrow(AIProviderError);
    });

    it("should successfully test connection when ping succeeds", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ status: "ok" }) } }],
        }),
      });

      const driver = new OpenAISalesDriver({ apiKey: "sk-valid-key" });
      const result = await driver.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully connected to OpenAI");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("3. Google Gemini Driver: Structured Output & Zod Validation", () => {
    it("should successfully generate structured response using responseMimeType json", async () => {
      const mockDealRiskSchema = z.object({
        riskLevel: z.enum(["low", "medium", "high", "critical"]),
        objections: z.array(z.string()),
        winProbability: z.number().min(0).max(1),
        suggestedNextStep: z.string(),
      });

      const mockPayload = {
        riskLevel: "medium",
        objections: ["Pricing higher than competitor", "Needs security questionnaire"],
        winProbability: 0.65,
        suggestedNextStep: "Send SOC2 compliance package and offer 5% multi-year discount",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify(mockPayload),
                  },
                ],
              },
            },
          ],
        }),
      });

      const driver = new GeminiSalesDriver({
        apiKey: "AIzaSyMockKeyForGeminiTesting12345",
        model: "gemini-1.5-flash",
      });

      const result = await driver.generateStructuredResponse(
        "Evaluate deal risk for Deal: Enterprise Corp",
        mockDealRiskSchema,
        "You are an expert sales risk analyst."
      );

      expect(result).toEqual(mockPayload);
      expect(result.riskLevel).toBe("medium");
      expect(result.winProbability).toBe(0.65);
      expect(result.objections).toHaveLength(2);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(url).toContain("gemini-1.5-flash:generateContent");
      expect(url).toContain("key=AIzaSyMockKeyForGeminiTesting12345");
      const body = JSON.parse(init.body);
      expect(body.generationConfig.responseMimeType).toBe("application/json");
    });

    it("should throw ProviderNotConfiguredError when Gemini returns API_KEY_INVALID", async () => {
      const schema = z.object({ status: z.string() });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({
          error: {
            message: "API_KEY_INVALID: Key not valid.",
            status: "INVALID_ARGUMENT",
          },
        }),
      });

      const driver = new GeminiSalesDriver({ apiKey: "bad-key-xyz" });
      await expect(
        driver.generateStructuredResponse("Test", schema)
      ).rejects.toThrow(ProviderNotConfiguredError);
    });

    it("should throw AIRateLimitError when Gemini returns 429", async () => {
      const schema = z.object({ status: z.string() });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => ({
          error: {
            message: "Quota exceeded.",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
      });

      const driver = new GeminiSalesDriver({ apiKey: "valid-key-xyz" });
      await expect(
        driver.generateStructuredResponse("Test", schema)
      ).rejects.toThrow(AIRateLimitError);
    });

    it("should successfully test connection when ping succeeds", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ status: "ok" }) }] } }],
        }),
      });

      const driver = new GeminiSalesDriver({ apiKey: "AIzaValidGeminiKey123" });
      const result = await driver.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully connected to Google Gemini");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("4. Mock AI Driver: Deterministic Testing & Schema Adherence", () => {
    it("should return enqueued responses in FIFO order and validate against schema", async () => {
      const mockDriver = new MockAISalesDriver();
      const schema = z.object({
        action: z.string(),
        confidence: z.number(),
      });

      const response1 = { action: "call", confidence: 0.9 };
      const response2 = { action: "email", confidence: 0.75 };

      mockDriver.enqueueResponse(response1);
      mockDriver.enqueueResponse(response2);

      const res1 = await mockDriver.generateStructuredResponse("First", schema);
      const res2 = await mockDriver.generateStructuredResponse("Second", schema);

      expect(res1).toEqual(response1);
      expect(res2).toEqual(response2);

      const history = mockDriver.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe("First");
      expect(history[1].prompt).toBe("Second");
    });

    it("should throw AISchemaValidationError when enqueued response violates schema", async () => {
      const mockDriver = new MockAISalesDriver();
      const schema = z.object({
        mustBeNumber: z.number(),
      });

      mockDriver.enqueueResponse({ mustBeNumber: "not-a-number" as any });

      await expect(
        mockDriver.generateStructuredResponse("Bad data", schema)
      ).rejects.toThrow(AISchemaValidationError);
    });

    it("should support custom handlers and simulated failures", async () => {
      const mockDriver = new MockAISalesDriver();
      const schema = z.object({ result: z.string() });

      mockDriver.setCustomHandler((prompt) => ({
        result: `Echo: ${prompt}`,
      }));

      const res = await mockDriver.generateStructuredResponse("Hello", schema);
      expect(res.result).toBe("Echo: Hello");

      // Simulate failure
      mockDriver.setSimulatedError(new AIRateLimitError("mock", 30));
      await expect(
        mockDriver.generateStructuredResponse("Fail", schema)
      ).rejects.toThrow(AIRateLimitError);

      // Reset
      mockDriver.reset();
      const conn = await mockDriver.testConnection();
      expect(conn.success).toBe(true);
      expect(mockDriver.getCallHistory()).toHaveLength(0);
    });
  });

  describe("5. AI Client Factory: Multi-Provider Resolution & Caching", () => {
    it("should return cached provider instances when config is not overridden", async () => {
      const mock1 = await AIClientFactory.getProvider("mock");
      const mock2 = await AIClientFactory.getProvider("mock");
      expect(mock1).toBe(mock2);

      const openai1 = await AIClientFactory.getProvider("openai", {
        secrets: { apiKey: "sk-test-key-cache" },
      });
      const openai2 = await AIClientFactory.getProvider("openai", {
        secrets: { apiKey: "sk-test-key-cache" },
      });
      expect(openai1.providerName).toBe("openai");
      expect(openai2.providerName).toBe("openai");
    });

    it("should return Mock driver when SALES_AI_DRIVER is mock", async () => {
      process.env.SALES_AI_DRIVER = "mock";
      const active = await AIClientFactory.getActiveProvider();
      expect(active.providerName).toBe("mock");
    });

    it("should resolve active database integration when connected to MongoDB", async () => {
      // Create an active sales integration document in MongoDB
      const testApiKey = "sk-db-configured-openai-key";
      const encryptedKey = encryptSecret(testApiKey);

      await SalesIntegration.deleteMany({ category: "ai" });
      const integration = await SalesIntegration.create({
        category: "ai",
        provider: "openai",
        name: "Production OpenAI Integration",
        enabled: true,
        status: "valid",
        publicConfig: {
          model: "gpt-4o",
        },
        encryptedSecrets: new Map([["apiKey", encryptedKey]]),
      });

      // Clear cached instance
      AIClientFactory.clearCache();
      delete process.env.SALES_AI_DRIVER;

      const active = await AIClientFactory.getActiveProvider();
      expect(active.providerName).toBe("openai");
      expect(active.defaultModel).toBe("gpt-4o");

      // Cleanup
      await SalesIntegration.deleteOne({ _id: integration._id });
    });

    it("should switch to Google Gemini when Gemini integration is enabled in MongoDB", async () => {
      const testApiKey = "AIzaSyDatabaseGeminiSecret12345";
      const encryptedKey = encryptSecret(testApiKey);

      await SalesIntegration.deleteMany({ category: "ai" });
      const integration = await SalesIntegration.create({
        category: "ai",
        provider: "gemini",
        name: "Google Gemini 2.0 Integration",
        enabled: true,
        status: "valid",
        publicConfig: {
          model: "gemini-2.0-flash",
        },
        encryptedSecrets: new Map([["apiKey", encryptedKey]]),
      });

      AIClientFactory.clearCache();
      delete process.env.SALES_AI_DRIVER;

      const active = await AIClientFactory.getActiveProvider();
      expect(active.providerName).toBe("gemini");
      expect(active.defaultModel).toBe("gemini-2.0-flash");

      // Cleanup
      await SalesIntegration.deleteOne({ _id: integration._id });
    });
  });
});
