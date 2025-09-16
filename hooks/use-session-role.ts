"use client"

import useSWR from 'swr'
import type { UserRole } from '@/lib/types'

export interface SessionRoleData {
  userId: string
  role: UserRole | null
  permissions: string[]
  updatedAt: Date | null
  hasSession: boolean
  timestamp?: string
  redisHealthy?: boolean
}

export interface UseSessionRoleReturn {
  role: UserRole | null
  permissions: string[]
  hasSession: boolean
  updatedAt: Date | null
  loading: boolean
  error: Error | null
  mutate: () => void
  refresh: () => Promise<void>
}

// Fetcher function for SWR
async function sessionFetcher(url: string): Promise<SessionRoleData> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Session API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  // Handle the debug session API response format
  if (data.success && data.redisSession) {
    return {
      userId: data.redisSession.userId,
      role: data.redisSession.role,
      permissions: data.redisSession.permissions || [],
      updatedAt: data.redisSession.updatedAt ? new Date(data.redisSession.updatedAt) : null,
      hasSession: data.redisSession.hasSession,
      timestamp: data.timestamp,
      redisHealthy: data.redisHealthy,
    }
  }

  // Handle direct session response format
  return {
    userId: data.userId,
    role: data.role,
    permissions: data.permissions || [],
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : null,
    hasSession: data.hasSession,
  }
}

/**
 * Client-side hook for real-time session role updates
 * Automatically refreshes every 30 seconds and provides immediate UI reactivity
 * 
 * @param refreshIntervalMs - Refresh interval in milliseconds (default: 30000)
 * @returns Session role data and control functions
 */
export function useSessionRole(refreshIntervalMs: number = 30000): UseSessionRoleReturn {
  const { 
    data, 
    error, 
    isLoading, 
    mutate 
  } = useSWR<SessionRoleData>(
    '/api/debug/session',
    sessionFetcher,
    {
      refreshInterval: refreshIntervalMs,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (error) => {
        console.error('Session role fetch error:', error)
      },
      onSuccess: (data) => {
        console.debug('Session role updated:', {
          role: data.role,
          hasSession: data.hasSession,
          permissionCount: data.permissions.length,
          updatedAt: data.updatedAt,
        })
      }
    }
  )

  // Manual refresh function that triggers session refresh API
  const refresh = async (): Promise<void> => {
    try {
      const response = await fetch('/api/session/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'refresh' })
      })

      if (response.ok) {
        // Trigger SWR revalidation after successful refresh
        await mutate()
        console.debug('Session manually refreshed and revalidated')
      } else {
        throw new Error(`Refresh failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to refresh session:', error)
      throw error
    }
  }

  return {
    role: data?.role || null,
    permissions: data?.permissions || [],
    hasSession: data?.hasSession || false,
    updatedAt: data?.updatedAt || null,
    loading: isLoading,
    error: error || null,
    mutate,
    refresh,
  }
}

/**
 * Hook for checking specific role permissions
 * @param requiredRole - Role required for access
 * @param refreshIntervalMs - Refresh interval in milliseconds
 * @returns Permission check result and session data
 */
export function useRequireRole(
  requiredRole: UserRole, 
  refreshIntervalMs: number = 30000
) {
  const sessionData = useSessionRole(refreshIntervalMs)
  
  const hasRequiredRole = sessionData.hasSession && (
    sessionData.role === requiredRole || 
    sessionData.role === 'admin' // Admin has access to everything
  )

  return {
    ...sessionData,
    hasRequiredRole,
    canAccess: hasRequiredRole,
  }
}

/**
 * Hook for checking specific permissions
 * @param requiredPermission - Permission required for access
 * @param refreshIntervalMs - Refresh interval in milliseconds
 * @returns Permission check result and session data
 */
export function useRequirePermission(
  requiredPermission: string,
  refreshIntervalMs: number = 30000
) {
  const sessionData = useSessionRole(refreshIntervalMs)
  
  const hasRequiredPermission = sessionData.hasSession && (
    sessionData.role === 'admin' || // Admin has all permissions
    sessionData.permissions.includes(requiredPermission)
  )

  return {
    ...sessionData,
    hasRequiredPermission,
    canAccess: hasRequiredPermission,
  }
}

/**
 * Utility hook for components that need to react to role changes
 * @param onRoleChange - Callback when role changes
 * @param refreshIntervalMs - Refresh interval in milliseconds
 */
export function useRoleChangeListener(
  onRoleChange: (role: UserRole | null, previousRole: UserRole | null) => void,
  refreshIntervalMs: number = 30000
) {
  const sessionData = useSessionRole(refreshIntervalMs)
  
  // Use useEffect to detect role changes
  React.useEffect(() => {
    const previousRole = React.useRef<UserRole | null>(null)
    
    if (previousRole.current !== sessionData.role) {
      onRoleChange(sessionData.role, previousRole.current)
      previousRole.current = sessionData.role
    }
  }, [sessionData.role, onRoleChange])

  return sessionData
}

// Export type for external use
export type { UserRole } from '@/lib/types'

// Add React import for useEffect
import React from 'react'