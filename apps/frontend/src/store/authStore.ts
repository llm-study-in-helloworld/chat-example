import { AuthResponse, User } from '@chat-example/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setAuthFromResponse: (response: AuthResponse) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setAuthFromResponse: (response) => set((state) => {
        state.user = response.user as User;
        state.token = response.token;
        state.isAuthenticated = true;
      }),
      
      updateUser: (userData) => set((state) => {
        if (state.user) {
          state.user = { ...state.user, ...userData };
        }
      }),
      
      logout: () => set((state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      }),
    })),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
); 