/**
 * TranslationProvider
 *
 * Pluggable interface for AI-assisted translation providers.
 *
 * Future concrete implementations can wrap:
 * - OpenAI GPT
 * - DeepL
 * - Azure Cognitive Translator
 * - Google Cloud Translation
 *
 * DO NOT implement any provider here.
 * DO NOT call any external API from this file.
 * Inject a concrete implementation into LocalizationService when ready.
 */
export interface TranslationProvider {
  /**
   * Translate a single text string from one language to another.
   *
   * @param text   Source text to translate
   * @param from   ISO 639-1 source language code (e.g. "en")
   * @param to     ISO 639-1 target language code (e.g. "si")
   * @returns      Translated text
   */
  translate(text: string, from: string, to: string): Promise<string>;

  /**
   * Detect the language of a given text.
   * Useful for validating source content before translation.
   *
   * @param text   Text whose language to detect
   * @returns      ISO 639-1 language code (e.g. "en", "fi")
   */
  detectLanguage(text: string): Promise<string>;

  /**
   * Translate multiple texts in a single provider call.
   * More efficient than calling translate() in a loop.
   *
   * @param items  Array of source texts to translate
   * @param from   Source language code
   * @param to     Target language code
   * @returns      Array of translated strings in the same order as input
   */
  batchTranslate(
    items: Array<{ text: string; field?: string }>,
    from: string,
    to: string
  ): Promise<string[]>;
}
