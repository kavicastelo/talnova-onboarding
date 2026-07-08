import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

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

// Normalized error helper
export function normalizeError(error: any): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    // Log internally for debugging purposes
    console.error('[API Error]', {
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      status,
      message: axiosError.message,
      response: responseData,
    });

    const details = responseData?.error?.details || responseData?.details || null;
    let message = responseData?.message || responseData?.error || axiosError.message || 'An unexpected server error occurred.';
    
    // Extract validation error messages to provide descriptive human-readable errors
    if (Array.isArray(details) && details.length > 0) {
      message = details.map((d: any) => d.message).join(', ');
    } else if (typeof responseData?.error === 'object' && responseData?.error?.message) {
      message = responseData.error.message;
    }

    // Handle standard API responses or default fallbacks
    return {
      message,
      status,
      code: responseData?.code || responseData?.error?.code || 'AXIOS_ERROR',
      details,
      raw: error,
    };
  }

  // Generic application error
  console.error('[Unexpected Error]', error);
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

// Request Interceptor: Token injection and preparation
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Inject Accept-Language from persisted user preference
    // This ensures dynamic content (journeys, KB articles) is returned in the correct locale
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
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 Unauthorized handling (session expired/invalid)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isAuthRoute = originalRequest.url?.includes('/auth/');
      const isKbRoute = window.location.pathname.startsWith('/kb') || window.location.pathname.startsWith('/knowledge-base');
      const isPublicCertRoute = window.location.pathname.startsWith('/public/certificate/');
      const isPublicPage = ['/login', '/register', '/forgot-password'].includes(window.location.pathname) || isKbRoute || isPublicCertRoute;

      if (isAuthRoute || isPublicPage) {
        if (isKbRoute) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_role');
        }
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        console.warn('Session expired or invalid. Attempting to refresh token...');
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = res.data.data;
        localStorage.setItem('auth_token', accessToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed', refreshError);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
