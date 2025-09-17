import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { serverLogger } from "@/lib/utils/server-logger"
import { getCachedUserRole, cacheUserRole } from "@/lib/redis"
import type { UserRole } from "@/lib/types"

export interface AuthConfig {
  redirectOnAuthFailure: boolean
  redirectUrl: string
  publicRoutes: string[]
  adminRoutes: string[]
}

const defaultAuthConfig: AuthConfig = {
  redirectOnAuthFailure: true,
  redirectUrl: "/sign-in",
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/pay(.*)",
    "/api/admin/bootstrap",
    "/api/system-status",
    "/api/debug/user",
    "/api/debug/session-claims",
    "/api/debug/session",
    "/api/csrf-token"
  ],
  adminRoutes: ["/admin(.*)", "/api/admin(.*)"],
}

export function isPublicRoute(pathname: string, publicRoutes: string[] = defaultAuthConfig.publicRoutes): boolean {
  return publicRoutes.some(route => {
    const regex = new RegExp(`^${route.replace(/\*/g, ".*")}$`)
    return regex.test(pathname)
  })
}

export function isAdminRoute(pathname: string, adminRoutes: string[] = defaultAuthConfig.adminRoutes): boolean {
  return adminRoutes.some(route => {
    const regex = new RegExp(`^${route.replace(/\*/g, ".*")}$`)
    return regex.test(pathname)
  })
}

export async function getSafeUser() {
  try {
    const user = await currentUser()
    return user
  } catch (error) {
    serverLogger.error("Failed to get current user", error)
    return null
  }
}

/**
 * Get user role with Redis fallback
 * Tries Redis cache first, falls back to Clerk metadata
 * @param user - Clerk user object
 * @returns User role and source information
 */
export async function getUserRoleWithFallback(user: any): Promise<{
  role: UserRole | null;
  source: 'redis' | 'clerk';
  confidence: number;
  cached: boolean;
}> {
  if (!user) {
    return { role: null, source: 'clerk', confidence: 0, cached: false };
  }

  const userId = user.id;

  try {
    // Try Redis cache first
    const cachedRole = await getCachedUserRole(userId);

    if (cachedRole && cachedRole.role) {
      // Verify role is valid
      const validRoles: UserRole[] = ['admin', 'merchant', 'viewer'];
      if (validRoles.includes(cachedRole.role as UserRole)) {
        serverLogger.middleware("Role resolved from Redis cache", {
          userId,
          role: cachedRole.role,
          source: 'redis',
          confidence: 1,
          version: cachedRole.version,
          lastSync: new Date(cachedRole.lastSync).toISOString()
        });

        return {
          role: cachedRole.role as UserRole,
          source: 'redis',
          confidence: 1,
          cached: true
        };
      } else {
        serverLogger.middleware("Invalid role found in Redis cache", {
          userId,
          cachedRole: cachedRole.role,
          source: 'redis',
          confidence: 0
        });
      }
    }

    // Fallback to Clerk metadata
    const clerkRole = user.publicMetadata?.role as UserRole;

    if (clerkRole) {
      // Cache the role from Clerk for future requests
      await cacheUserRole(userId, clerkRole, {
        source: 'clerk_fallback',
        cachedAt: Date.now()
      });

      serverLogger.middleware("Role resolved from Clerk (cached for future)", {
        userId,
        role: clerkRole,
        source: 'clerk',
        confidence: 0.9,
        cached: false
      });

      return {
        role: clerkRole,
        source: 'clerk',
        confidence: 0.9,
        cached: false
      };
    }

    // No role found
    serverLogger.middleware("No role found for user", {
      userId,
      source: 'none',
      confidence: 0
    });

    return { role: null, source: 'clerk', confidence: 0, cached: false };

  } catch (error) {
    serverLogger.error("Error resolving user role", {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Emergency fallback to Clerk only
    const clerkRole = user.publicMetadata?.role as UserRole;
    return {
      role: clerkRole || null,
      source: 'clerk',
      confidence: clerkRole ? 0.5 : 0,
      cached: false
    };
  }
}

export async function requireRole(user: any, requiredRole: UserRole): Promise<boolean> {
  if (!user) return false;

  const roleResult = await getUserRoleWithFallback(user);
  return roleResult.role === requiredRole;
}

export async function requirePermission(user: any, permission: string): Promise<boolean> {
  if (!user) return false;

  const roleResult = await getUserRoleWithFallback(user);

  // Admin has all permissions
  if (roleResult.role === "admin") return true;

  // Check specific permissions from Clerk metadata
  const permissions = user.publicMetadata?.permissions as string[] || [];
  return permissions.includes(permission);
}

export function createAuthMiddleware(config: Partial<AuthConfig> = {}) {
  const authConfig = { ...defaultAuthConfig, ...config }

  return async function authMiddleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow public routes
    if (isPublicRoute(pathname, authConfig.publicRoutes)) {
      return NextResponse.next()
    }

    // Get user authentication
    const user = await getSafeUser()

    // Redirect to sign-in if not authenticated
    if (!user) {
      serverLogger.middleware(`Unauthenticated access attempt to: ${pathname}`)

      if (authConfig.redirectOnAuthFailure) {
        const signInUrl = new URL(authConfig.redirectUrl, request.url)
        signInUrl.searchParams.set("redirect", pathname)
        return NextResponse.redirect(signInUrl)
      }

      return new NextResponse(
        JSON.stringify({
          error: "Authentication Required",
          message: "Please sign in to access this resource",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Admin route protection
    if (isAdminRoute(pathname, authConfig.adminRoutes)) {
      const roleResult = await getUserRoleWithFallback(user);

      if (!roleResult.role) {
        serverLogger.middleware("No role found for admin route access", {
          pathname,
          userId: user.id,
          source: roleResult.source,
          confidence: roleResult.confidence
        });

        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              error: "Access Denied",
              message: "No role assigned. Please contact administrator.",
              needsBootstrap: true
            },
            { status: 403 }
          );
        }

        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Check if user has admin role
      if (roleResult.role !== "admin") {
        serverLogger.middleware("Access denied for admin route - insufficient role", {
          pathname,
          userId: user.id,
          currentRole: roleResult.role,
          requiredRole: "admin",
          source: roleResult.source,
          confidence: roleResult.confidence
        });

        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              error: "Access Denied",
              message: "Admin privileges required to access this resource",
              requiredRole: "admin",
              currentRole: roleResult.role,
              roleSource: roleResult.source,
              confidence: roleResult.confidence
            },
            { status: 403 }
          );
        }

        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Log successful admin access
      serverLogger.middleware("Admin access granted", {
        pathname,
        userId: user.id,
        role: roleResult.role,
        source: roleResult.source,
        confidence: roleResult.confidence,
        cached: roleResult.cached
      });
    }

    return NextResponse.next()
  }
}

// Utility function for API routes to check authentication
export async function requireAuth(request: NextRequest): Promise<{ user: any } | { error: NextResponse }> {
  const user = await getSafeUser()

  if (!user) {
    return {
      error: new NextResponse(
        JSON.stringify({
          error: "Authentication Required",
          message: "Please sign in to access this resource",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    }
  }

  return { user }
}

// Utility function for API routes to check admin role
export async function requireAdmin(request: NextRequest): Promise<{ user: any } | { error: NextResponse }> {
  const authResult = await requireAuth(request)

  if ('error' in authResult) {
    return authResult
  }

  const { user } = authResult
  const roleResult = await getUserRoleWithFallback(user)

  if (roleResult.role !== "admin") {
    return {
      error: new NextResponse(
        JSON.stringify({
          error: "Access Denied",
          message: "Admin privileges required to access this resource",
          requiredRole: "admin",
          currentRole: roleResult.role,
          roleSource: roleResult.source,
          confidence: roleResult.confidence
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    }
  }

  return { user }
}