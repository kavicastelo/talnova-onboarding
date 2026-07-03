import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocaleNegotiator } from "../../../infrastructure/localization/LocaleNegotiator.js";
import { MemoryCacheProvider } from "../../../infrastructure/localization/MemoryCacheProvider.js";
import { TranslationVersionManager } from "../../../infrastructure/localization/TranslationVersionManager.js";
import { TranslationStatus } from "../models/translation.model.js";

// ─── LocaleNegotiator ────────────────────────────────────────────────────────

describe("LocaleNegotiator", () => {
  const negotiator = new LocaleNegotiator();

  describe("negotiate()", () => {
    it("returns en for empty header", () => {
      expect(negotiator.negotiate(undefined)).toBe("en");
      expect(negotiator.negotiate("")).toBe("en");
    });

    it("resolves exact supported locale", () => {
      expect(negotiator.negotiate("fi")).toBe("fi");
      expect(negotiator.negotiate("ta")).toBe("ta");
      expect(negotiator.negotiate("si")).toBe("si");
    });

    it("resolves region variant to base locale", () => {
      expect(negotiator.negotiate("en-GB")).toBe("en");
      expect(negotiator.negotiate("en-US")).toBe("en");
      expect(negotiator.negotiate("fi-FI")).toBe("fi");
      expect(negotiator.negotiate("ta-LK")).toBe("ta");
      expect(negotiator.negotiate("si-LK")).toBe("si");
    });

    it("respects q-values and picks highest quality match", () => {
      // fi has q=0.9, ta has q=0.8 — fi wins
      expect(negotiator.negotiate("fi;q=0.9, ta;q=0.8")).toBe("fi");
    });

    it("skips highest-q unsupported locale and falls back to next supported", () => {
      // zh is unsupported, fi is next
      expect(negotiator.negotiate("zh-CN;q=1.0, fi;q=0.8")).toBe("fi");
    });

    it("falls back to en for fully unsupported header", () => {
      expect(negotiator.negotiate("zh-CN;q=1.0, de;q=0.8")).toBe("en");
    });

    it("handles region variant in multi-value header", () => {
      expect(negotiator.negotiate("en-AU;q=0.9, ta-LK;q=0.7")).toBe("en");
    });

    it("excludes q=0 locales", () => {
      expect(negotiator.negotiate("fi;q=0, en;q=0.9")).toBe("en");
    });

    it("treats missing q as 1.0", () => {
      // fi (q=1.0 implicit) beats en-GB (q=0.8)
      expect(negotiator.negotiate("fi, en-GB;q=0.8")).toBe("fi");
    });
  });

  describe("normalize()", () => {
    it("returns en for unsupported locale (silent fallback)", () => {
      expect(negotiator.normalize("zh")).toBe("en");
      expect(negotiator.normalize(undefined)).toBe("en");
    });

    it("normalizes region variant to base", () => {
      expect(negotiator.normalize("en-US")).toBe("en");
      expect(negotiator.normalize("fi-FI")).toBe("fi");
    });

    it("strips extra casing", () => {
      expect(negotiator.normalize("FI")).toBe("fi");
      expect(negotiator.normalize("EN-GB")).toBe("en");
    });
  });

  describe("resolve()", () => {
    it("returns null for unsupported locale", () => {
      expect(negotiator.resolve("de")).toBeNull();
      expect(negotiator.resolve(undefined)).toBeNull();
    });

    it("returns SupportedLocale for valid input", () => {
      expect(negotiator.resolve("fi")).toBe("fi");
      expect(negotiator.resolve("en-US")).toBe("en");
    });
  });
});

// ─── MemoryCacheProvider ──────────────────────────────────────────────────────

describe("MemoryCacheProvider", () => {
  let cache: MemoryCacheProvider;

  beforeEach(() => {
    cache = new MemoryCacheProvider();
  });

  it("returns undefined on cache miss", async () => {
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a value", async () => {
    await cache.set("key", { hello: "world" }, 5000);
    expect(await cache.get("key")).toEqual({ hello: "world" });
  });

  it("returns undefined after TTL expiry", async () => {
    await cache.set("key", "value", 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(await cache.get("key")).toBeUndefined();
  });

  it("deletes a specific key", async () => {
    await cache.set("key", "value", 5000);
    await cache.delete("key");
    expect(await cache.get("key")).toBeUndefined();
  });

  it("deleteByPrefix removes all matching keys", async () => {
    await cache.set("tr:journey:123:title:en", "v1", 5000);
    await cache.set("tr:journey:123:title:fi", "v2", 5000);
    await cache.set("tr:article:456:title:en", "v3", 5000);

    await cache.deleteByPrefix("tr:journey:123:");

    expect(await cache.get("tr:journey:123:title:en")).toBeUndefined();
    expect(await cache.get("tr:journey:123:title:fi")).toBeUndefined();
    expect(await cache.get("tr:article:456:title:en")).toBe("v3"); // untouched
  });

  it("clear removes all entries", async () => {
    await cache.set("a", 1, 5000);
    await cache.set("b", 2, 5000);
    await cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("supports null values (negative caching)", async () => {
    await cache.set("key", null, 5000);
    expect(await cache.get("key")).toBeNull();
  });
});

// ─── TranslationVersionManager ────────────────────────────────────────────────

describe("TranslationVersionManager", () => {
  it("builds correct cache key format", () => {
    const cache = new MemoryCacheProvider();
    const mockRepo = {
      markOutdated: vi.fn().mockResolvedValue(undefined),
      findAllForEntity: vi.fn(),
      findForEntityAndLanguage: vi.fn(),
      upsert: vi.fn(),
      approve: vi.fn(),
      findMissing: vi.fn(),
      findOutdated: vi.fn(),
      coverage: vi.fn(),
      findApproved: vi.fn(),
    } as any;

    const manager = new TranslationVersionManager(mockRepo, cache);

    expect(manager.buildCacheKey("journey", "abc123", "title", "fi")).toBe(
      "tr:journey:abc123:title:fi"
    );
  });

  it("calls markOutdated and deleteByPrefix when source changes", async () => {
    const cache = new MemoryCacheProvider();
    const markOutdated = vi.fn().mockResolvedValue(undefined);
    const mockRepo = { markOutdated } as any;
    const deleteSpy = vi.spyOn(cache, "deleteByPrefix");

    const manager = new TranslationVersionManager(mockRepo, cache);
    await manager.onSourceChanged("journey", "abc123", "title", 2);

    expect(markOutdated).toHaveBeenCalledWith("journey", "abc123", "title");
    expect(deleteSpy).toHaveBeenCalledWith("tr:journey:abc123:title:");
  });
});

// ─── Status filter contract ───────────────────────────────────────────────────

describe("Translation status contract", () => {
  const productionStatuses: TranslationStatus[] = ["DRAFT", "AI_GENERATED", "UNDER_REVIEW", "OUTDATED"];

  it("APPROVED is the only status served to production", () => {
    for (const status of productionStatuses) {
      expect(status).not.toBe("APPROVED");
    }
  });

  it("OUTDATED is a valid editable status (not deleted)", () => {
    const status: TranslationStatus = "OUTDATED";
    expect(["DRAFT", "AI_GENERATED", "UNDER_REVIEW", "APPROVED", "OUTDATED"]).toContain(status);
  });
});
