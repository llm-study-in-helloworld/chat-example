import { AuthUser } from '../store/authStore';
import apiClient from './apiClient';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface RegisterResponse {
  token: string;
  user: AuthUser;
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },
  
  register: async (email: string, password: string, nickname: string): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<RegisterResponse>('/auth/signup', { 
      email, 
      password, 
      nickname 
    });
    return data;
  },
  
  getCurrentUser: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<AuthUser>('/users/me');
    return data;
  },
  
  updateProfile: async (userData: Partial<AuthUser>): Promise<AuthUser> => {
    const { data } = await apiClient.patch<AuthUser>('/users/profile', userData);
    return data;
  },
  
  updatePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.patch<{ success: boolean }>('/users/password', {
      currentPassword,
      newPassword
    });
    return data;
  },
  
  logout: async (): Promise<void> => {
    // Just a client-side logout, no endpoint needed
    // For server invalidation, you could add:
    // await apiClient.post('/auth/logout');
    return;
  }
}; 