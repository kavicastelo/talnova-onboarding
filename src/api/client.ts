import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { unpackDemoPayload } from '../utils/payloadShield';
import { secureStorage } from '../utils/secureStorage';

// Config
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
const REQUEST_TIMEOUT = 15000; // 15s timeout

// Standard Error Interface for the UI
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
  raw?: any;
}

// In-Memory Token & Worker Session State (Isolated Closures)
let inMemoryAccessToken: string | null = null;
let workerTokenGetter: (() => string | null) | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  if (!token) {
    secureStorage.removeToken();
  } else {
    // Encrypted migration fallback with 15-min TTL
    secureStorage.setToken(token);
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  const stored = secureStorage.getToken();
  if (stored) {
    inMemoryAccessToken = stored;
    return stored;
  }
  return null;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
  secureStorage.removeToken();
}

export function setWorkerTokenProvider(getter: (() => string | null) | null): void {
  workerTokenGetter = getter;
}

export function getWorkerToken(): string | null {
  return workerTokenGetter ? workerTokenGetter() : null;
}

// Create centralized axios client
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true, // Allow cookies / credentials support
});

// Normalized error helper without sensitive payload logging
export function normalizeError(error: any): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    const details = responseData?.error?.details || responseData?.details || null;
    let message = responseData?.message || responseData?.error || axiosError.message || 'An unexpected server error occurred.';
    
    // Extract validation error messages to provide descriptive human-readable errors
    if (Array.isArray(details) && details.length > 0) {
      message = details.map((d: any) => d.message).join(', ');
    } else if (typeof responseData?.error === 'object' && responseData?.error?.message) {
      message = responseData.error.message;
    }

    return {
      message,
      status,
      code: responseData?.code || responseData?.error?.code || 'AXIOS_ERROR',
      details,
      raw: error,
    };
  }

  // Generic application error
  return {
    message: error?.message || 'An unknown error occurred.',
    code: 'UNKNOWN_ERROR',
    raw: error,
  };
}

export function getErrorMessage(error: any): string {
  return normalizeError(error).message;
}

// Global request cancelation controller utility
export const createCancelToken = () => {
  const source = axios.CancelToken.source();
  return {
    token: source.token,
    cancel: (message?: string) => source.cancel(message),
  };
};

// Helper to detect if running in demo environment (path-based, subdomain-based, or build flag)
export function isDemoEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.startsWith('/demo') ||
    window.location.hostname.startsWith('demo.') ||
    (import.meta as any).env?.VITE_APP_MODE === 'demo'
  );
}

// Request Interceptor: Token injection and preparation
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const isDemoMode = isDemoEnvironment();

    if (isDemoMode) {
      const demoToken = localStorage.getItem('talnova_demo_token');
      if (demoToken && config.headers) {
        config.headers.Authorization = `Bearer ${demoToken}`;
      }
      if (
        config.url &&
        !config.url.startsWith('/demo') &&
        !config.url.startsWith('/super-admin') &&
        !config.url.startsWith('/auth')
      ) {
        config.url = `/demo${config.url.startsWith('/') ? '' : '/'}${config.url}`;
      }
    } else {
      const isKioskRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/kiosk');
      const employeeToken = workerTokenGetter ? workerTokenGetter() : null;
      const isDeviceHeartbeat = Boolean(
        config.url && (config.url.includes('/devices/heartbeat') || config.url.endsWith('/heartbeat'))
      );

      if (isKioskRoute && employeeToken && !isDeviceHeartbeat) {
        if (config.headers) {
          config.headers.Authorization = `Bearer ${employeeToken}`;
          config.headers['x-worker-session-token'] = employeeToken;
        }
      } else if (isKioskRoute && localStorage.getItem('kiosk_device_token')) {
        const deviceToken = localStorage.getItem('kiosk_device_token');
        if (config.headers && deviceToken) {
          config.headers.Authorization = `Bearer ${deviceToken}`;
        }
      } else {
        const token = getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }

    // Inject Accept-Language from persisted user preference
    const lang = localStorage.getItem('talnova_lang') || 'en';
    if (config.headers) {
      config.headers['Accept-Language'] = lang;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: 401 handling, Refresh Token mechanisms
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response?.data && response.data.__shielded === true && typeof response.data.payload === 'string') {
      try {
        const unshielded = unpackDemoPayload(response.data.payload);
        response.data.data = unshielded;
      } catch {
        // Fallback gracefully
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // K-DEV-004: Handle instantaneous device revocation & lockdown (DEF-005)
    const responseData = error.response?.data as any;
    const errorCode = responseData?.code || responseData?.error?.code;
    if (error.response?.status === 401 && (errorCode === 'DEVICE_REVOKED' || responseData?.message?.includes?.('revoked'))) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('kiosk_device_token');
        localStorage.removeItem('kiosk_device_info');
        localStorage.removeItem('kiosk_is_paired');
        localStorage.setItem('kiosk_device_revoked', 'true');
      }
      import('../features/kiosk/services/device-identity.service.js')
        .then((m) => m.deviceIdentityService?.clearDeviceCredentials())
        .catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('talnova:kiosk:device_revoked', {
            detail: {
              message: responseData?.message || 'Device enrollment revoked. Please contact your system administrator.'
            }
          })
        );
      }
      return Promise.reject(error);
    }

    // 401 Unauthorized handling (session expired/invalid)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isDemo = isDemoEnvironment() ||
                     Boolean(originalRequest.url && (originalRequest.url.startsWith('/demo') || originalRequest.url.includes('/demo/')));

      // Demo 401: Handle strictly within the demo subsystem, never touching production session or endpoints
      if (isDemo) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('talnova_demo_token');
          localStorage.removeItem('talnova_demo_user');
          localStorage.removeItem('talnova_demo_tenant');
          localStorage.removeItem('talnova_demo_watermark');
          localStorage.removeItem('talnova_demo_role');
          localStorage.removeItem('talnova_demo_roles');
        }
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const isDemoLoginPage = currentPath.startsWith('/demo/login') || currentPath === '/login';
          if (!isDemoLoginPage) {
            const demoLoginPath = currentPath.startsWith('/demo') ? '/demo/login' : '/login';
            window.location.href = `${demoLoginPath}?reason=session_expired`;
          }
        }
        return Promise.reject(error);
      }

      const isAuthRoute = originalRequest.url?.includes('/auth/');
      const isKbRoute = window.location.pathname.startsWith('/kb') || window.location.pathname.startsWith('/knowledge-base');
      const isPublicCertRoute = window.location.pathname.startsWith('/public/certificate/');
      const isKioskRoute = window.location.pathname.startsWith('/kiosk/');
      const isPublicPage = ['/login', '/register', '/forgot-password'].includes(window.location.pathname) || isKbRoute || isPublicCertRoute || isKioskRoute;

      if (isAuthRoute || isPublicPage) {
        if (isKbRoute) {
          clearAccessToken();
          localStorage.removeItem('user_role');
        }
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        // Silent token refresh via HttpOnly cookie transport
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = res.data.data;
        setAccessToken(accessToken);
        localStorage.setItem('talnova_last_activity', String(Date.now()));
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_roles');
        localStorage.removeItem('user_features');
        localStorage.removeItem('talnova_last_activity');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
