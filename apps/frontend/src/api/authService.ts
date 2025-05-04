import { AuthResponse, User } from '@chat-example/types';
import apiClient from './apiClient';

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },
  
  register: async (email: string, password: string, nickname: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/signup', { 
      email, 
      password, 
      nickname 
    });

    return data;
  },
  
  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/users/me');
    return data;
  },
  
  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const { data } = await apiClient.patch<User>('/users/profile', userData);
    return data;
  },
  
  updatePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.patch<{ success: boolean }>('/auth/password', {
      currentPassword,
      newPassword
    });
    return data;
  },
  
  logout: async (): Promise<void> => {
    // Server-side logout to invalidate tokens
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Error during logout:', error);
      // Continue with client-side logout even if server-side fails
    }
    return;
  }
}; 