import { useNavigate, NavigateOptions } from 'react-router-dom';
import { isDemoEnvironment } from '../api/client';

/**
 * Resolves a route path to its demo-aware target when running in demo mode.
 * e.g., `/journeys` -> `/demo/journeys`, `/` -> `/demo`.
 * Preserves external URLs, relative paths (`..`), and already prefixed paths (`/demo/*`).
 */
export function getAppPath(path: string): string {
  if (typeof window === 'undefined') return path;

  const isDemo = isDemoEnvironment();
  if (!isDemo) return path;

  // External URLs or hashes
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('#') || path.startsWith('mailto:')) {
    return path;
  }

  // Already prefixed
  if (path.startsWith('/demo') || path === '/demo') {
    return path;
  }

  // Root redirect
  if (path === '/' || path === '') {
    return '/demo';
  }

  // Absolute path within application
  if (path.startsWith('/')) {
    return `/demo${path}`;
  }

  return path;
}

/**
 * Drop-in wrapper around react-router-dom's useNavigate hook that automatically
 * applies demo path translation when active in the demo environment.
 */
export function useAppNavigate() {
  const navigate = useNavigate();

  return (to: string | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      return navigate(to);
    }
    return navigate(getAppPath(to), options);
  };
}
