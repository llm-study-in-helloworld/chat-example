import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { User } from './chatStore';

export interface AuthUser extends Omit<User, 'presence'> {
  email: string;
}

interface AuthState {
  // State
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setAuth: (user: AuthUser, token: string) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setAuth: (user, token) => set((state) => {
        state.user = user;
        state.token = token;
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