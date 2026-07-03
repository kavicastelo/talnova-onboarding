import { SupportedLocale } from './localization.config';

/**
 * Intl-based formatting utilities for localized date, number, and relative time display.
 *
 * Uses the native Intl API — no custom formatting logic.
 * All functions are pure and safe to call in any component without hooks.
 */

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format a date according to the user's locale.
 *
 * @example
 *   formatDate(new Date(), 'fi')       → "30.6.2026"
 *   formatDate(new Date(), 'en', 'long') → "June 30, 2026"
 */
export function formatDate(
  date: Date | string | number,
  locale: SupportedLocale,
  style: 'short' | 'medium' | 'long' | 'full' = 'medium'
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(d);
}

/**
 * Format a date and time according to the user's locale.
 */
export function formatDateTime(
  date: Date | string | number,
  locale: SupportedLocale,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style }).format(d);
}

// ─── Number formatting ─────────────────────────────────────────────────────────

/**
 * Format a number according to the user's locale.
 *
 * @example
 *   formatNumber(1234567.89, 'fi') → "1 234 567,89"
 *   formatNumber(1234567.89, 'en') → "1,234,567.89"
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a number as a currency string.
 *
 * @example
 *   formatCurrency(99.99, 'en', 'USD') → "$99.99"
 *   formatCurrency(99.99, 'fi', 'EUR') → "99,99 €"
 */
export function formatCurrency(
  value: number,
  locale: SupportedLocale,
  currency: string
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/**
 * Format a number as a percentage.
 *
 * @example
 *   formatPercent(0.754, 'en') → "75%"
 */
export function formatPercent(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Relative time ────────────────────────────────────────────────────────────

type RelativeTimeUnit =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years';

/**
 * Format a date as a human-readable relative time string.
 *
 * @example
 *   formatRelativeTime(new Date(Date.now() - 60_000), 'en') → "1 minute ago"
 *   formatRelativeTime(new Date(Date.now() - 60_000), 'fi') → "1 minuutti sitten"
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: SupportedLocale
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const pick = (value: number, unit: RelativeTimeUnit) => rtf.format(value, unit);

  if (Math.abs(diffSec) < 60) return pick(diffSec, 'seconds');
  if (Math.abs(diffMin) < 60) return pick(diffMin, 'minutes');
  if (Math.abs(diffHr) < 24) return pick(diffHr, 'hours');
  if (Math.abs(diffDay) < 7) return pick(diffDay, 'days');
  if (Math.abs(diffWeek) < 5) return pick(diffWeek, 'weeks');
  if (Math.abs(diffMonth) < 12) return pick(diffMonth, 'months');
  return pick(diffYear, 'years');
}
