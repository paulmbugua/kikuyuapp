import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import userService, { UserProfile } from '@/services/userService';

interface UserState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  fetchUser: () => Promise<void>;
  fetchProfile: (username: string) => Promise<UserProfile | null>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  uploadCover: (file: File) => Promise<string>;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      setUser: (user) => set({ user }),

      fetchUser: async () => {
        set({ isLoading: true });
        try {
          // Try to get from localStorage first
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            set({ user: JSON.parse(storedUser) });
          }
          
          // Fetch fresh data from API
          const response = await fetch('http://localhost:5000/api/v1/users/me', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            set({ user: data.data.user });
            localStorage.setItem('user', JSON.stringify(data.data.user));
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchProfile: async (username: string) => {
        try {
          const profile = await userService.getProfile(username);
          return profile;
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          return null;
        }
      },

      updateProfile: async (data) => {
        try {
          const updatedUser = await userService.updateProfile(data);
          set({ user: updatedUser });
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (error) {
          console.error('Failed to update profile:', error);
          throw error;
        }
      },

      uploadAvatar: async (file: File) => {
        try {
          const { avatar_url, user } = await userService.uploadAvatar(file);
          set({ user });
          localStorage.setItem('user', JSON.stringify(user));
          return avatar_url;
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          throw error;
        }
      },

      uploadCover: async (file: File) => {
        try {
          const { cover_url, user } = await userService.uploadCover(file);
          set({ user });
          localStorage.setItem('user', JSON.stringify(user));
          return cover_url;
        } catch (error) {
          console.error('Failed to upload cover:', error);
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('thutha_onboarding');
        set({ user: null });
      },
    }),
    {
      name: 'user-storage',
      storage: {
        getItem: (name) => {
          const value = localStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);