import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getSessionResponse, refreshSession, setSession } from '@/lib/session/redis';
import { serverLogger } from '@/lib/utils/server-logger';
import { getPermissionsForRole } from '@/lib/types/roles';
import { z } from 'zod';

// Request validation schema
const RefreshRequestSchema = z.object({
  action: z.enum(['refresh', 'sync_with_clerk']),
});

/**
 * Session refresh endpoint for frontend-triggered session revalidation
 * Allows immediate UI updates after role changes
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication Required',
          message: 'User must be signed in to refresh session',
        },
        { status: 401 },
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const { action } = RefreshRequestSchema.parse(body);

    const userId = user.id;

    serverLogger.info('Session refresh requested', {
      userId,
      action,
      userEmail: user.emailAddresses?.[0]?.emailAddress,
    });

    if (action === 'refresh') {
      // Simple TTL refresh without changing data
      const refreshSuccess = await refreshSession(userId);

      if (refreshSuccess) {
        const sessionResponse = await getSessionResponse(userId);

        return NextResponse.json({
          success: true,
          action: 'refresh',
          message: 'Session TTL refreshed successfully',
          session: sessionResponse,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          success: false,
          action: 'refresh',
          message: 'Session not found or refresh failed',
          session: await getSessionResponse(userId),
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (action === 'sync_with_clerk') {
      // Sync Redis session with current Clerk metadata
      const clerkRole = (user.publicMetadata as { role?: string })?.role;

      if (!clerkRole) {
        return NextResponse.json(
          {
            error: 'No Role Found',
            message: 'User has no role assigned in Clerk metadata',
          },
          { status: 400 },
        );
      }

      // Validate role and get permissions
      const validRoles = ['admin', 'merchant', 'viewer'];
      if (!validRoles.includes(clerkRole)) {
        return NextResponse.json(
          {
            error: 'Invalid Role',
            message: `Invalid role '${clerkRole}'. Must be one of: ${validRoles.join(', ')}`,
          },
          { status: 400 },
        );
      }

      const permissions = Array.from(getPermissionsForRole(clerkRole as any));

      // Update Redis session with Clerk role and permissions
      const setSuccess = await setSession(userId, {
        role: clerkRole as any,
        permissions: permissions,
      });

      if (setSuccess) {
        const sessionResponse = await getSessionResponse(userId);

        serverLogger.info('Session synced with Clerk metadata', {
          userId,
          clerkRole,
          permissionCount: permissions.length,
          sessionUpdated: sessionResponse.updatedAt,
        });

        return NextResponse.json({
          success: true,
          action: 'sync_with_clerk',
          message: 'Session synchronized with Clerk metadata',
          session: sessionResponse,
          clerkRole,
          permissionCount: permissions.length,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json(
          {
            error: 'Sync Failed',
            message: 'Failed to update Redis session with Clerk data',
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Invalid Action',
        message: 'Unknown action requested',
        availableActions: ['refresh', 'sync_with_clerk'],
      },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    serverLogger.error('Session refresh API error', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while refreshing session',
      },
      { status: 500 },
    );
  }
}

/**
 * Get current session info (lightweight endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: 'Authentication Required',
        },
        { status: 401 },
      );
    }

    const sessionResponse = await getSessionResponse(user.id);

    return NextResponse.json({
      success: true,
      session: sessionResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    serverLogger.error('Session get API error', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to retrieve session information',
      },
      { status: 500 },
    );
  }
}
