'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { UserRole } from '@/lib/types/roles';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is signed in
  const isSignedIn = !!user;

  // Fetch current user from API
  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser({
            ...data.user,
            createdAt: new Date(data.user.createdAt),
            updatedAt: new Date(data.user.updatedAt),
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh user data after successful login
        await fetchUser();
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      setUser(null);
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    await fetchUser();
  };

  // Initial user fetch
  useEffect(() => {
    fetchUser();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isSignedIn,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for user data (compatibility with Clerk's useUser)
export function useUser() {
  const { user, isLoading } = useAuth();
  return {
    user,
    isLoaded: !isLoading,
  };
}

// Hook to check if user has specific role
export function useRole() {
  const { user } = useAuth();

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin can access everything
    return user.role === requiredRole;
  };

  const isAdmin = (): boolean => user?.role === 'admin';
  const isMerchant = (): boolean => user?.role === 'merchant' || user?.role === 'admin';
  const isUser = (): boolean => !!user; // Any authenticated user

  return {
    hasRole,
    isAdmin,
    isMerchant,
    isUser,
    currentRole: user?.role,
  };
}