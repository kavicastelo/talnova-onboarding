/**
 * High-Performance Client Input Sanitization, Unicode Normalization & Unicode Security Module
 * Protects against Trojan Source Bidi overrides, control character injection, clipboard bombs,
 * homoglyph obfuscation, and input length exhaustion.
 */

/**
 * Strips non-printable ASCII control characters ([\x00-\x08\x0B\x0C\x0E-\x1F\x7F]),
 * while explicitly preserving standard line breaks (\n), carriage returns (\r), and tabs (\t).
 */
export function stripControlCharacters(text: string): string {
  if (!text) return '';
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Strips dangerous Trojan Source Unicode Bidirectional (Bidi) overrides and marks:
 * - \u200E (Left-to-Right Mark)
 * - \u200F (Right-to-Left Mark)
 * - \u202A - \u202E (LRE, RLE, PDF, LRO, RLO)
 * - \u2066 - \u2069 (LRI, RLI, FSI, PDI)
 */
export function stripBidiOverrides(text: string): string {
  if (!text) return '';
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '');
}

/**
 * Applies Unicode Compatibility Decomposition followed by Canonical Composition (NFKC).
 * Normalizes fullwidth characters, composite glyphs, and compatibility homoglyphs into canonical forms.
 */
export function normalizeUnicode(text: string): string {
  if (!text) return '';
  try {
    return text.normalize('NFKC');
  } catch {
    return text;
  }
}

/**
 * Clamps string length to prevent clipboard bombs, denial of service, or huge memory payloads.
 */
export function clampLength(text: string, maxLength: number): string {
  if (!text) return '';
  if (maxLength <= 0) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

/**
 * Universal sanitization pipeline for single-line text inputs.
 * Composes: clampLength(stripBidiOverrides(stripControlCharacters(normalizeUnicode(value))), maxLength).
 */
export function sanitizeInput(value: string, maxLength = 255): string {
  if (typeof value !== 'string') return '';
  return clampLength(
    stripBidiOverrides(stripControlCharacters(normalizeUnicode(value))),
    maxLength
  );
}

/**
 * Universal sanitization pipeline for multi-line textarea inputs (default threshold 5,000 characters).
 */
export function sanitizeTextarea(value: string, maxLength = 5000): string {
  if (typeof value !== 'string') return '';
  return clampLength(
    stripBidiOverrides(stripControlCharacters(normalizeUnicode(value))),
    maxLength
  );
}
