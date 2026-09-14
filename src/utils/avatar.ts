/**
 * Utility functions for deterministic and dynamic employee avatars.
 * Provides resilient fallbacks using DiceBear avatar engines and CSS gradient hashes.
 */

// Curated harmonious color palettes for deterministic gradient fallbacks
const GRADIENT_PALETTES = [
  { from: '#4f46e5', to: '#7c3aed', text: '#ffffff' }, // Indigo to Violet
  { from: '#2563eb', to: '#06b6d4', text: '#ffffff' }, // Blue to Cyan
  { from: '#059669', to: '#10b981', text: '#ffffff' }, // Emerald to Green
  { from: '#d97706', to: '#f59e0b', text: '#ffffff' }, // Amber to Yellow
  { from: '#dc2626', to: '#f43f5e', text: '#ffffff' }, // Red to Rose
  { from: '#7c3aed', to: '#ec4899', text: '#ffffff' }, // Violet to Pink
  { from: '#0891b2', to: '#0284c7', text: '#ffffff' }, // Cyan to Sky
  { from: '#475569', to: '#1e293b', text: '#ffffff' }, // Slate dark
];

/**
 * Generate a deterministic hash integer from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Extract clean 1-2 letter initials from a full name or email
 */
export function getInitials(nameOrEmail?: string): string {
  if (!nameOrEmail || !nameOrEmail.trim()) return 'EM';
  const clean = nameOrEmail.trim();

  // If email format, extract local part
  if (clean.includes('@')) {
    const local = clean.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
    const parts = local.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }

  // Name with multiple words
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Get deterministic gradient styling for avatar fallback
 */
export function getGradientPalette(seed: string): { from: string; to: string; text: string; css: string } {
  const hash = hashString(seed || 'default-employee');
  const palette = GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length];
  return {
    ...palette,
    css: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
  };
}

export type DiceBearStyle = 'avataaars' | 'initials' | 'bottts' | 'lorelei' | 'personas';

/**
 * Get a DiceBear avatar URL for consistent, attractive illustrations
 */
export function getDiceBearAvatar(
  seed: string,
  style: DiceBearStyle = 'avataaars'
): string {
  const sanitizedSeed = encodeURIComponent(seed.trim().toLowerCase() || 'employee');
  
  if (style === 'initials') {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${sanitizedSeed}&fontFamily=Inter,sans-serif&fontSize=42&fontWeight=600`;
  }

  // Modern avataaars with soft background tint
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${sanitizedSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50`;
}

/**
 * Smart resolver for avatar image URL with multi-tiered fallback
 */
export function resolveAvatarUrl(
  avatar?: string | { publicUrl?: string; fileName?: string } | null,
  fallbackSeed?: string,
  style: DiceBearStyle = 'avataaars'
): string {
  if (typeof avatar === 'string' && avatar.trim().length > 0) {
    return avatar.trim();
  }
  if (avatar && typeof avatar === 'object' && avatar.publicUrl && avatar.publicUrl.trim().length > 0) {
    return avatar.publicUrl.trim();
  }

  const seed = fallbackSeed || 'default-seed';
  return getDiceBearAvatar(seed, style);
}
