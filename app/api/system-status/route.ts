import { NextRequest, NextResponse } from 'next/server';
import { getSafeUser } from '@/lib/auth/safe-auth';
import { connectDB } from '@/lib/db/connection';
import { OrderModel } from '@/lib/db/models/Order';
import { AuditLogModel } from '@/lib/db/models/AuditLog';

export async function GET(_request: NextRequest) {
  try {
    const user = await getSafeUser();

    // Allow unauthenticated access for system diagnostics
    const isAuthenticated = !!user;

    // Test database connection
    await connectDB();

    // Check collections
    const orderCount = await OrderModel.countDocuments();
    const auditCount = await AuditLogModel.countDocuments();

    // Check user role status if authenticated
    const userRole = user?.role;

    const systemStatus = {
      database: {
        connected: true,
        collections: {
          orders: orderCount,
          auditLogs: auditCount,
        },
      },
      user: isAuthenticated
        ? {
            id: user.id,
            email: user.email,
            role: userRole,
            hasRole: !!userRole,
            name: user.firstName ? `${user.firstName} ${user.lastName}`.trim() : null,
          }
        : {
            authenticated: false,
            message: 'No user session',
          },
      environment: {
        mongoUri: process.env.MONGODB_URI ? '✓ Configured' : '✗ Missing',
        authKeys: process.env.SESSION_SECRET ? '✓ Configured' : '✗ Missing',
      },
    };

    return NextResponse.json({
      success: true,
      status: 'System operational',
      data: systemStatus,
    });
  } catch (error) {
    console.error('System status check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'System check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
