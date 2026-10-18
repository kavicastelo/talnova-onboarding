/**
 * Centralized API base URL resolver for the demo application.
 * Ensures deployed demo instances on Netlify, Vercel, or custom domains
 * communicate with the active production backend API rather than failing with 404.
 */
export const getDemoApiBase = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Auto-resolve to production backend on cloud hosting environments
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (
      host.endsWith('netlify.app') ||
      host.endsWith('vercel.app') ||
      host.includes('talnova.io') ||
      host.includes('talnovaonboard.com')
    ) {
      return 'https://onb-api.talnova.io/api/v1';
    }
  }

  return '/api/v1';
};

export const DEMO_API_BASE = getDemoApiBase();
