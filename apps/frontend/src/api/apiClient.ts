import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

const BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable sending cookies in cross-origin requests
});

// Add a request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      // Always ensure token is prefixed with 'Bearer ' for HTTP requests
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Add a response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 Unauthorized and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token logic would go here
        // const refreshToken = localStorage.getItem('refreshToken');
        // const { data } = await apiClient.post('/auth/refresh', { refreshToken });
        // useAuthStore.getState().setAuth(data.user, data.token);

        // For now, just logout on auth error
        useAuthStore.getState().logout();
        window.location.href = "/login";

        return Promise.reject(error);
      } catch (refreshError) {
        // Logout on refresh failure
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
