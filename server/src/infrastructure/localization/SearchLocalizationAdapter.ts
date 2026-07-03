import { SupportedLocale } from "../../config/localization.config.js";

/**
 * SearchLocalizationAdapter
 *
 * Interface for multilingual search integration.
 * Implement when adding a search engine (Elasticsearch, Atlas Search, etc.).
 *
 * DO NOT implement here. Interface only.
 */
export interface SearchLocalizationAdapter {
  /**
   * Index a translated document so it can be searched in a given language.
   *
   * @param entityType  The domain model name (e.g. "article", "journey")
   * @param entityId    The domain document ID
   * @param language    The language of the content being indexed
   * @param fields      Key-value pairs of field → translated value
   */
  index(
    entityType: string,
    entityId: string,
    language: SupportedLocale,
    fields: Record<string, string>
  ): Promise<void>;

  /**
   * Search for documents matching a query in a given language.
   *
   * @param entityType  Domain model to search within
   * @param language    Language to search in
   * @param query       The search string
   * @param options     Pagination and filter options
   * @returns           Array of matching entity IDs with relevance scores
   */
  search(
    entityType: string,
    language: SupportedLocale,
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      fields?: string[];
    }
  ): Promise<Array<{ entityId: string; score: number }>>;

  /**
   * Remove a document from the search index.
   * Called when an entity is deleted or archived.
   */
  removeFromIndex(entityType: string, entityId: string, language: SupportedLocale): Promise<void>;
}
