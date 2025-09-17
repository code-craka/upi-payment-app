"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  type UserRole, 
  type SessionHookState, 
  type UseSessionRoleOptions 
} from "@/lib/types";

// Default options for the hook
const DEFAULT_OPTIONS: Required<UseSessionRoleOptions> = {
  refreshInterval: 30000, // 30 seconds
  maxStaleTime: 60000, // 1 minute
  fallbackRole: null as any, // Will be handled as undefined
  enableAutoRefresh: true,
  onRoleChange: () => {},
  onError: () => {},
};

/**
 * Custom hook for hybrid role management with Redis caching
 * 
 * Features:
 * - Automatic 30-second refresh from Redis cache
 * - Instant role updates via manual refresh
 * - Fallback to Clerk when Redis is unavailable
 * - Stale-while-revalidate pattern
 * - Error handling and retry logic
 * 
 * @param options Configuration options for the hook
 * @returns Hook state with role, loading status, and refresh function
 */
export function useSessionRole(options: UseSessionRoleOptions = {}) {
  const { user, isLoaded: isUserLoaded } = useUser();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Hook state
  const [state, setState] = useState<SessionHookState>({
    role: null,
    isLoading: true,
    error: null,
    lastRefresh: 0,
    isStale: false,
    refreshCount: 0,
  });

  // Refs for cleanup and avoiding stale closures
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousRoleRef = useRef<UserRole | null>(null);

  /**
   * Fetch role from our hybrid API endpoint
   */
  const fetchRole = useCallback(async (force: boolean = false): Promise<UserRole | null> => {
    if (!user?.id) {
      return null;
    }

    try {
      // Cancel previous request if still in flight
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      
      const response = await fetch("/api/debug/session", {
        method: "GET",
        headers: {
          "Cache-Control": force ? "no-cache" : "max-age=30", // 30 seconds cache
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if response has the expected structure
      if (!data.redisData) {
        throw new Error("Invalid response structure");
      }

      // Prefer Redis cached role, fallback to Clerk role
      const role = data.redisData.role || data.clerkData?.role || null;
      
      return role as UserRole | null;

    } catch (error: any) {
      // Don't throw on abort errors (cleanup)
      if (error.name === 'AbortError') {
        return null;
      }

      console.error("[useSessionRole] Fetch error:", error);
      
      // Fallback to Clerk role if available
      return (user.publicMetadata?.role as UserRole) || null;
    }
  }, [user?.id, user?.publicMetadata?.role]);

  /**
   * Update state with new role and handle change callbacks
   */
  const updateState = useCallback((updates: Partial<SessionHookState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      
      // Check for role changes
      if ('role' in updates && updates.role !== previousRoleRef.current) {
        const oldRole = previousRoleRef.current;
        const newRole = updates.role || null;
        
        previousRoleRef.current = newRole;
        
        // Trigger role change callback
        try {
          opts.onRoleChange(oldRole, newRole);
        } catch (error) {
          console.error("[useSessionRole] onRoleChange callback error:", error);
        }
      }
      
      return newState;
    });
  }, [opts.onRoleChange]);

  /**
   * Manual refresh function for immediate role updates
   */
  const refreshRole = useCallback(async (force: boolean = false): Promise<UserRole | null> => {
    if (!isUserLoaded || !user) {
      return null;
    }

    updateState({ isLoading: true, error: null });

    try {
      const role = await fetchRole(force);
      const now = Date.now();
      
      updateState({
        role,
        isLoading: false,
        error: null,
        lastRefresh: now,
        isStale: false,
        refreshCount: state.refreshCount + 1,
      });

      return role;

    } catch (error: any) {
      console.error("[useSessionRole] Refresh error:", error);
      
      updateState({
        isLoading: false,
        error: error.message || "Failed to refresh role",
        isStale: true,
      });

      // Trigger error callback
      try {
        opts.onError(error);
      } catch (callbackError) {
        console.error("[useSessionRole] onError callback error:", callbackError);
      }

      return state.role; // Return current role on error
    }
  }, [isUserLoaded, user, fetchRole, state.refreshCount, updateState, opts.onError]);

  /**
   * Check if current role data is stale
   */
  const isStale = useCallback(() => {
    const now = Date.now();
    const age = now - state.lastRefresh;
    return age > opts.maxStaleTime;
  }, [state.lastRefresh, opts.maxStaleTime]);

  /**
   * Setup automatic refresh interval
   */
  useEffect(() => {
    if (!opts.enableAutoRefresh || !isUserLoaded || !user) {
      return;
    }

    // Initial fetch
    refreshRole(false);

    // Setup interval for automatic refresh
    intervalRef.current = setInterval(() => {
      if (document.hidden) {
        // Skip refresh when tab is hidden to save resources
        return;
      }
      
      refreshRole(false);
    }, opts.refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [opts.enableAutoRefresh, opts.refreshInterval, isUserLoaded, user, refreshRole]);

  /**
   * Update stale status periodically
   */
  useEffect(() => {
    const checkStaleStatus = () => {
      const stale = isStale();
      if (stale !== state.isStale) {
        updateState({ isStale: stale });
      }
    };

    // Check stale status every 10 seconds
    const staleCheckInterval = setInterval(checkStaleStatus, 10000);

    return () => clearInterval(staleCheckInterval);
  }, [isStale, state.isStale, updateState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Handle user changes (sign in/out)
   */
  useEffect(() => {
    if (!isUserLoaded) {
      return;
    }

    if (!user) {
      // User signed out
      updateState({
        role: null,
        isLoading: false,
        error: null,
        lastRefresh: 0,
        isStale: false,
        refreshCount: 0,
      });
      previousRoleRef.current = null;
    }
  }, [isUserLoaded, user, updateState]);

  // Return hook interface
  return {
    // Current role state
    role: state.role,
    isLoading: state.isLoading,
    error: state.error,
    
    // Data freshness
    isStale: state.isStale,
    lastRefresh: state.lastRefresh,
    refreshCount: state.refreshCount,
    
    // Actions
    refresh: refreshRole,
    forceRefresh: () => refreshRole(true),
    
    // Utilities
    hasRole: (targetRole: UserRole) => state.role === targetRole,
    isAdmin: state.role === "admin",
    isMerchant: state.role === "merchant",
    isViewer: state.role === "viewer",
    
    // Debugging info
    debug: {
      options: opts,
      state,
      userId: user?.id || null,
      clerkRole: (user?.publicMetadata?.role as UserRole) || null,
    },
  };
}

/**
 * Hook for checking specific role permissions
 * 
 * @param requiredRole Role required for access
 * @param options Hook configuration options
 * @returns Permission check result with loading state
 */
export function useRolePermission(
  requiredRole: UserRole,
  options: UseSessionRoleOptions = {}
) {
  const { role, isLoading, error, refresh } = useSessionRole(options);
  
  return {
    hasPermission: role === requiredRole,
    isLoading,
    error,
    refresh,
    currentRole: role,
    requiredRole,
  };
}

/**
 * Hook for requiring specific role access
 * @param requiredRole - Role required for access
 * @param options - Hook configuration options
 * @returns Role check result and session data
 */
export function useRequireRole(
  requiredRole: UserRole, 
  options: UseSessionRoleOptions = {}
) {
  const sessionData = useSessionRole(options);
  
  const hasRequiredRole = sessionData.role && (
    sessionData.role === requiredRole || 
    sessionData.role === 'admin' // Admin has access to everything
  );

  return {
    ...sessionData,
    hasRequiredRole,
    canAccess: hasRequiredRole,
    hasSession: Boolean(sessionData.role),
    loading: sessionData.isLoading,
    permissions: [], // Will be implemented when permissions system is added
  };
}

/**
 * Hook for checking specific permissions
 * @param requiredPermission - Permission required for access
 * @param options - Hook configuration options
 * @returns Permission check result and session data
 */
export function useRequirePermission(
  requiredPermission: string,
  options: UseSessionRoleOptions = {}
) {
  const sessionData = useSessionRole(options);
  
  // For now, only admin has all permissions
  const hasRequiredPermission = sessionData.role === 'admin';

  return {
    ...sessionData,
    hasRequiredPermission,
    canAccess: hasRequiredPermission,
    hasSession: Boolean(sessionData.role),
    loading: sessionData.isLoading,
    permissions: sessionData.role === 'admin' ? [requiredPermission] : [],
  };
}

/**
 * Hook for admin-only functionality
 * 
 * @param options Hook configuration options
 * @returns Admin permission state
 */
export function useAdminRole(options: UseSessionRoleOptions = {}) {
  return useRolePermission("admin", options);
}