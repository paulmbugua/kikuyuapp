// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  avatar_url: string;
  avatar_key?: string;
  cover_key?: string;
  is_verified: boolean;
  wallet_balance?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface OAuthLoginResult {
  user: User;
  tokens: AuthTokens;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (result: OAuthLoginResult) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUser = async () => {
    try {
      const response = await axiosInstance.get('/auth/me');
      const userData = response.data.data?.user || response.data.data;
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const login = async ({ user: userData, tokens }: OAuthLoginResult) => {
    setIsLoading(true);
    try {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      toast.success(`Welcome back, ${userData.full_name || userData.username}!`);

      const onboarding = localStorage.getItem('thutha_onboarding');
      if (onboarding) {
        try {
          const onboardingData = JSON.parse(onboarding);
          if (onboardingData.onboardingComplete) {
            navigate('/feed');
            return;
          }
        } catch (error) {
          console.error('Error parsing onboarding:', error);
        }
      }
      navigate('/onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('thutha_onboarding');
    setUser(null);
    toast.success('Logged out successfully');
    navigate('/login');
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Verify token is still valid
          await refreshUser();
        } catch (error) {
          console.error('Failed to restore session:', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};