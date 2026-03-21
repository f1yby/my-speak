import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi, type User, type LoginInput, type SetupInput } from '../services/auth-api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSetup: boolean | null;
  isLoading: boolean;
  _hydrated: boolean;
  error: string | null;
  
  checkSetup: () => Promise<void>;
  setup: (input: SetupInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isSetup: null,
      isLoading: false,
      _hydrated: false,
      error: null,

      checkSetup: async () => {
        try {
          const result = await authApi.checkSetup();
          set({ isSetup: result.isSetup });
        } catch (error) {
          console.error('Check setup error:', error);
          set({ isSetup: false });
        }
      },

      setup: async (input) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.setup(input);
          set({ isSetup: true, isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Setup failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      login: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const session = await authApi.login(input);
          
          localStorage.setItem('token', session.token);
          localStorage.setItem('lastUsername', input.username);
          
          set({
            user: { username: session.username },
            token: session.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Login failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('auth-storage');
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      setHydrated: (state: boolean) => {
        set({ _hydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
