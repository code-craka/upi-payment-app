"use client"

import { useUser } from "@clerk/nextjs"
import { type SafeUser, SafeUserSchema, type UserRole, hasPermission, type Permission } from "@/lib/types"

export function useSafeUser(): SafeUser | null {
  const { user, isLoaded } = useUser()

  if (!isLoaded || !user) return null

  try {
    const safeUser: SafeUser = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || "",
      firstName: user.firstName,
      lastName: user.lastName,
      role: (user.publicMetadata?.role as UserRole) || "viewer",
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
    }

    return SafeUserSchema.parse(safeUser)
  } catch (error) {
    console.error("Error parsing safe user:", error)
    return null
  }
}

export function useUserRole(): UserRole | null {
  const user = useSafeUser()
  return user?.role || null
}

export function useHasPermission(permission: Permission): boolean {
  const user = useSafeUser()
  if (!user) return false
  return hasPermission(user.role, permission)
}

export function useRequireRole(requiredRole: UserRole): SafeUser | null {
  const user = useSafeUser()
  if (!user) return null
  if (user.role !== requiredRole && user.role !== "admin") return null
  return user
}
