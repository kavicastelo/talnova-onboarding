import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Config
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8080/api';
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

    // Handle standard API responses or default fallbacks
    return {
      message: responseData?.message || responseData?.error || axiosError.message || 'An unexpected server error occurred.',
      status,
      code: responseData?.code || 'AXIOS_ERROR',
      details: responseData?.details || null,
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
    // PLACEHOLDER: Retrieve JWT token from local storage, cookie, or store
    const token = localStorage.getItem('auth_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
      originalRequest._retry = true;

      try {
        console.warn('Session expired or invalid. Attempting to refresh token...');
        // PLACEHOLDER: Refresh token logic should go here
        // const newAccessToken = await refreshAuthToken();
        // localStorage.setItem('auth_token', newAccessToken);
        // originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        // return apiClient(originalRequest);
        
        // If refresh fails or is not implemented yet, redirect to login or clear auth state
        // For now, only log. Do not break app redirect since login redirect isn't explicitly configured.
      } catch (refreshError) {
        console.error('Token refresh failed', refreshError);
        // Clear token, force logout or reload
        // localStorage.removeItem('auth_token');
        // window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
