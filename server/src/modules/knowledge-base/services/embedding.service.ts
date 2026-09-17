export class EmbeddingService {
  private static readonly VECTOR_DIM = 128;

  /**
   * Deterministic local hash projection vectorizer.
   * Produces a normalized vector of fixed dimensions (128) based on word tokens and n-grams.
   * Enables 100% offline, local development, and fast zero-cost testing.
   */
  private generateLocalEmbedding(text: string): number[] {
    const vector = new Array(EmbeddingService.VECTOR_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ");
    const words = cleaned.split(/\s+/).filter((w) => w.length > 1);

    if (words.length === 0) {
      return vector;
    }

    // Token frequency and 2-gram hashing
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const index = Math.abs(hash) % EmbeddingService.VECTOR_DIM;
      vector[index] += 1.0;

      // Bigram
      if (i < words.length - 1) {
        const bigram = `${word}_${words[i + 1]}`;
        let biHash = 0;
        for (let j = 0; j < bigram.length; j++) {
          biHash = (biHash << 5) - biHash + bigram.charCodeAt(j);
          biHash |= 0;
        }
        const biIndex = Math.abs(biHash) % EmbeddingService.VECTOR_DIM;
        vector[biIndex] += 1.5;
      }
    }

    // Normalize to unit vector
    let norm = 0;
    for (const val of vector) {
      norm += val * val;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  /**
   * Generate vector embedding using configured provider or local deterministic vectorizer.
   */
  async generateEmbedding(
    text: string,
    providerConfig?: { provider: string; endpoint?: string },
    secrets?: { apiKey?: string; resourceName?: string }
  ): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(EmbeddingService.VECTOR_DIM).fill(0);
    }

    // If external provider is configured and not in test environment, attempt external embedding
    if (
      process.env.NODE_ENV !== "test" &&
      providerConfig?.provider === "openai" &&
      secrets?.apiKey
    ) {
      try {
        const endpoint = (providerConfig.endpoint?.replace(/\/+$/, "") || "https://api.openai.com/v1") + "/embeddings";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.apiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text.slice(0, 8000),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const embedding = data?.data?.[0]?.embedding;
          if (Array.isArray(embedding) && embedding.length > 0) {
            return embedding;
          }
        }
      } catch (err: any) {
        console.warn("[EmbeddingService] Provider embedding failed, falling back to local vectorizer:", err.message);
      }
    }

    // Fallback: fast deterministic local vectorizer
    return this.generateLocalEmbedding(text);
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0;
    }

    const minLen = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default EmbeddingService;
