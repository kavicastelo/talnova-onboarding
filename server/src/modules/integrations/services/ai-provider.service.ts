export interface AIProviderConfig {
  provider: string; // openai | azure_openai | anthropic | gemini | custom
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderSecrets {
  apiKey?: string;
  resourceName?: string;
  deploymentName?: string;
}

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AIProviderService {
  /**
   * Test connection to the configured AI provider with credentials
   */
  async testConnection(
    config: AIProviderConfig,
    secrets: AIProviderSecrets
  ): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!secrets.apiKey && config.provider !== "custom") {
        throw new Error("API Key is required to test AI connection.");
      }

      if (config.provider === "openai" || config.provider === "custom") {
        const endpoint = (config.endpoint?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/chat/completions";
        const model = config.model || "gpt-4o-mini";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Provider returned HTTP ${res.status}: ${res.statusText}`);
        }
      } else if (config.provider === "azure_openai") {
        const endpoint = config.endpoint || `https://${secrets.resourceName}.openai.azure.com`;
        const deployment = secrets.deploymentName || config.model || "gpt-4o";
        const url = `${endpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": secrets.apiKey || "",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Azure OpenAI returned HTTP ${res.status}`);
        }
      } else if (config.provider === "anthropic") {
        const url = config.endpoint || "https://api.anthropic.com/v1/messages";
        const model = config.model || "claude-3-5-sonnet-20241022";

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": secrets.apiKey || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: "user", content: "Ping" }],
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Anthropic returned HTTP ${res.status}`);
        }
      } else if (config.provider === "gemini") {
        const model = config.model || "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secrets.apiKey}`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Ping" }] }],
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Google Gemini returned HTTP ${res.status}`);
        }
      } else {
        throw new Error(`Unsupported AI provider: ${config.provider}`);
      }

      return {
        success: true,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.message || "Failed to communicate with AI provider",
      };
    }
  }

  /**
   * Execute chat completion against configured AI provider
   */
  async chatCompletion(
    config: AIProviderConfig,
    secrets: AIProviderSecrets,
    messages: AIChatMessage[]
  ): Promise<string> {
    if (config.provider === "openai" || config.provider === "custom") {
      const endpoint = (config.endpoint?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/chat/completions";
      const model = config.model || "gpt-4o-mini";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature ?? 0.3,
          max_tokens: config.maxTokens ?? 1000,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `OpenAI API failed with status ${res.status}`);
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || "";
    } else if (config.provider === "gemini") {
      const model = config.model || "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secrets.apiKey}`;

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API failed with status ${res.status}`);
      }

      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (config.provider === "anthropic") {
      const url = config.endpoint || "https://api.anthropic.com/v1/messages";
      const model = config.model || "claude-3-5-sonnet-20241022";

      const systemMsg = messages.find((m) => m.role === "system")?.content;
      const userAndAssistant = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": secrets.apiKey || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: systemMsg,
          messages: userAndAssistant,
          max_tokens: config.maxTokens ?? 1000,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Anthropic API failed with status ${res.status}`);
      }

      const data = await res.json();
      return data?.content?.[0]?.text || "";
    }

    throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  /**
   * Synthesize course curriculum and assessment with grounded KB context
   */
  async generateCourseCurriculum(
    config: AIProviderConfig,
    secrets: AIProviderSecrets,
    prompt: string,
    targetRole: string,
    department: string,
    level: string,
    moduleCount: number,
    groundedArticles: any[]
  ): Promise<any[]> {
    const articlesContext = groundedArticles
      .map(
        (art, idx) =>
          `[Document ${idx + 1}: ${art.title}]\nSummary: ${art.summary || "N/A"}\nKey points: ${
            art.content?.blocks?.map((b: any) => b.content).filter(Boolean).join(" ").slice(0, 300) || ""
          }`
      )
      .join("\n\n");

    const systemPrompt = `You are an expert instructional designer creating an enterprise onboarding journey.
Generate an onboarding curriculum with exactly ${moduleCount} modules tailored for a "${targetRole}" in the "${department}" department at "${level}" level.
The curriculum must align with the provided organization knowledge base documents.

Return ONLY a valid JSON array of modules with the following schema, and NO markdown code formatting or extra commentary:
[
  {
    "title": "Module title",
    "description": "Module summary",
    "lessons": [
      {
        "title": "Lesson title",
        "content": "Comprehensive instructional guidance and reading material (at least 2 paragraphs).",
        "durationMinutes": 15,
        "quizQuestions": [
          {
            "questionText": "Multiple choice question testing comprehension",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctOptionIndex": 0,
            "explanation": "Why this answer is correct based on company standards."
          }
        ]
      }
    ]
  }
]`;

    const userPrompt = `Topic: "${prompt}"\n\nGrounding Knowledge Base Articles:\n${articlesContext || "No specific internal documents provided. Base on industry standards for " + targetRole + "."}`;

    const rawResponse = await this.chatCompletion(config, secrets, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    try {
      // Clean up markdown code block delimiters if present
      const cleaned = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback if model did not return clean JSON
    }

    // Default structured representation if JSON parsing failed
    return [
      {
        title: `Module 1: Orientation to ${prompt}`,
        description: `Fundamental guidance and core requirements synthesized for ${targetRole} (${department}).`,
        lessons: [
          {
            title: `Introduction & Policy Context`,
            content: rawResponse.slice(0, 500) || `Instructional guidelines synthesized for ${prompt}.`,
            durationMinutes: 15,
            quizQuestions: [
              {
                questionText: `What is the primary compliance priority for ${prompt}?`,
                options: [
                  "Adhere to organizational policy and complete verified checklist milestones",
                  "Bypass procedures for speed",
                  "Ignore milestone deadlines",
                  "Share company credentials externally"
                ],
                correctOptionIndex: 0,
                explanation: "Compliance with documented company guidelines is mandatory for all team members."
              }
            ]
          }
        ]
      }
    ];
  }
}

export default AIProviderService;
