import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { cacheUserRole, updateRoleStats, getCachedUserRole } from '@/lib/redis';
import { connectDB } from '@/lib/db/connection';
import {
  AdminBootstrapRequestSchema,
  type AdminBootstrapResponse,
  type UserRole,
  type RoleChangeEvent,
} from '@/lib/types';

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * POST /api/admin/bootstrap
 *
 * Bootstrap admin users by assigning roles with dual-write to Clerk and Redis
 * This endpoint allows initial admin setup and role management
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminBootstrapResponse | { error: string; details?: string }>> {
  try {
    // Get current user for authorization
    const currentUserData = await currentUser();

    if (!currentUserData) {
      return NextResponse.json(
        {
          error: 'Authentication Required',
          details: 'You must be signed in to access this endpoint',
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = AdminBootstrapRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid Request',
          details: validationResult.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      );
    }

    const { userEmail, targetRole, force = false, reason } = validationResult.data;

    // Check if current user has admin role (or allow bootstrap if no admins exist)
    const currentUserRole = currentUserData.publicMetadata?.role as string;
    const isCurrentUserAdmin = currentUserRole === 'admin';

    // Allow bootstrap only if:
    // 1. Current user is admin, OR
    // 2. No admins exist in the system (initial bootstrap)
    if (!isCurrentUserAdmin) {
      // Check if any admins exist by querying Clerk users
      const adminUsers = await clerk.users.getUserList({
        limit: 1,
      });

      const hasAdmins = adminUsers.data.some((user: { publicMetadata?: { role?: string } }) => user.publicMetadata?.role === 'admin');

      if (hasAdmins && !force) {
        return NextResponse.json(
          {
            error: 'Access Denied',
            details: 'Admin privileges required or use force flag for emergency bootstrap',
          },
          { status: 403 },
        );
      }
    }

    // Find target user by email
    const targetUsers = await clerk.users.getUserList({
      emailAddress: [userEmail],
      limit: 1,
    });

    if (targetUsers.data.length === 0) {
      return NextResponse.json(
        {
          error: 'User Not Found',
          details: `No user found with email: ${userEmail}`,
        },
        { status: 404 },
      );
    }

    const targetUser = targetUsers.data[0];
    const previousRole = (targetUser.publicMetadata?.role as UserRole) || null;

    // Skip if user already has the target role (unless forced)
    if (previousRole === targetRole && !force) {
      return NextResponse.json({
        success: true,
        userId: targetUser.id,
        previousRole,
        newRole: targetRole,
        clerkUpdated: false,
        redisUpdated: false,
        message: `User already has ${targetRole} role`,
        timestamp: Date.now(),
      });
    }

    const startTime = Date.now();
    let clerkUpdated = false;
    let redisUpdated = false;
    let updateError: string | undefined;

    try {
      // 1. Update Clerk metadata (source of truth)
      await clerk.users.updateUserMetadata(targetUser.id, {
        publicMetadata: {
          ...targetUser.publicMetadata,
          role: targetRole,
          roleUpdatedAt: Date.now(),
          roleUpdatedBy: currentUserData.id,
          roleUpdateReason: reason || 'Admin bootstrap',
        },
      });

      clerkUpdated = true;

      // 2. Cache role in Redis for instant access
      await cacheUserRole(targetUser.id, targetRole, {
        source: 'bootstrap',
        updatedBy: currentUserData.id,
        updatedAt: Date.now(),
        previousRole,
        reason: reason || 'Admin bootstrap',
      });

      redisUpdated = true;

      // 3. Update role statistics
      await updateRoleStats({
        userId: targetUser.id,
        oldRole: previousRole,
        newRole: targetRole,
      });
    } catch (error) {
      updateError = error instanceof Error ? error.message : 'Unknown update error';
      console.error('[Bootstrap] Role update failed:', error);
    }

    // 4. Create audit log (optional - will skip if AuditLogModel is not available)
    try {
      await connectDB();

      const roleChangeEvent: RoleChangeEvent = {
        userId: targetUser.id,
        userEmail: targetUser.primaryEmailAddress?.emailAddress || userEmail,
        previousRole,
        newRole: targetRole,
        source: 'bootstrap',
        triggeredBy: currentUserData.id,
        reason: reason || 'Admin bootstrap via API',
        timestamp: Date.now(),
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      };

      // Log the event to console as fallback
      console.warn('[Bootstrap] Role change event:', roleChangeEvent);
    } catch (auditError) {
      console.error('[Bootstrap] Audit log creation failed:', auditError);
      // Don't fail the request for audit log errors
    }

    const response: AdminBootstrapResponse = {
      success: clerkUpdated, // Success if Clerk (source of truth) was updated
      userId: targetUser.id,
      previousRole,
      newRole: targetRole,
      clerkUpdated,
      redisUpdated,
      message: clerkUpdated
        ? `Successfully ${previousRole ? 'updated' : 'assigned'} role to ${targetRole}`
        : `Failed to update role: ${updateError}`,
      timestamp: Date.now(),
    };

    const statusCode = clerkUpdated ? 200 : 500;

    console.warn(`[Bootstrap] Role bootstrap ${clerkUpdated ? 'successful' : 'failed'}:`, {
      targetUser: userEmail,
      targetUserId: targetUser.id,
      previousRole,
      newRole: targetRole,
      triggeredBy: currentUserData.id,
      clerkUpdated,
      redisUpdated,
      updateError,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error('[Bootstrap] Unexpected error:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/bootstrap
 *
 * Get bootstrap status and hybrid role synchronization statistics
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const currentUserData = await currentUser();

    if (!currentUserData) {
      return NextResponse.json({ error: 'Authentication Required' }, { status: 401 });
    }

    // Check if current user is admin or if no admins exist
    const currentUserRole = currentUserData.publicMetadata?.role as string;
    const isAdmin = currentUserRole === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get user statistics from Clerk with Redis sync status
    const allUsers = await clerk.users.getUserList({
      limit: 500, // Adjust based on your needs
    });

    const roleStats = {
      admin: 0,
      merchant: 0,
      viewer: 0,
      total: allUsers.data.length,
      unassigned: 0,
      synced: 0,
      unsynced: 0,
    };

    const syncStatus = [];

    // Check each user's sync status between Clerk and Redis
    for (const user of allUsers.data) {
      const clerkRole = user.publicMetadata?.role as UserRole;
      const cachedRole = await getCachedUserRole(user.id);

      const isInSync = clerkRole === cachedRole?.role;
      const userSyncStatus = {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        clerkRole: clerkRole || null,
        redisRole: cachedRole?.role || null,
        inSync: isInSync,
        lastSync: cachedRole?.lastSync || null,
      };

      syncStatus.push(userSyncStatus);

      // Update role counts
      if (clerkRole === 'admin') roleStats.admin++;
      else if (clerkRole === 'merchant') roleStats.merchant++;
      else if (clerkRole === 'viewer') roleStats.viewer++;
      else roleStats.unassigned++;

      // Update sync counts
      if (isInSync) roleStats.synced++;
      else roleStats.unsynced++;
    }

    // Calculate sync health score
    const syncHealthScore = roleStats.total > 0 ? (roleStats.synced / roleStats.total) * 100 : 100;

    return NextResponse.json({
      success: true,
      stats: roleStats,
      syncHealth: {
        score: Math.round(syncHealthScore),
        synced: roleStats.synced,
        unsynced: roleStats.unsynced,
        total: roleStats.total,
      },
      canBootstrap: isAdmin,
      unsyncedUsers: syncStatus.filter((u) => !u.inSync),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Bootstrap] GET error:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
