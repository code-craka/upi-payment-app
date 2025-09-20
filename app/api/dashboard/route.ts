import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireRole';
import { connectDB } from '@/lib/db/connection';
import { OrderModel } from '@/lib/db/models/Order';
import { UserModel } from '@/lib/db/models/User';
import { AuditLogModel } from '@/lib/db/models/AuditLog';
import { z } from 'zod';

// Dashboard analytics response schema
const _DashboardAnalyticsSchema = z.object({
  success: z.boolean(),
  data: z.object({
    analytics: z.object({
      totalRevenue: z.number(),
      totalOrders: z.number(),
      completedOrders: z.number(),
      pendingOrders: z.number(),
      revenueGrowth: z.number(),
      orderGrowth: z.number(),
      avgOrderValue: z.number(),
      conversionRate: z.number(),
      monthlyRevenue: z.array(
        z.object({
          month: z.string(),
          revenue: z.number(),
          orders: z.number(),
        }),
      ),
      topMerchants: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          revenue: z.number(),
          orders: z.number(),
        }),
      ),
    }),
    userStats: z.object({
      totalUsers: z.number(),
      activeUsers: z.number(),
      newUsers: z.number(),
      userGrowth: z.number(),
      roleDistribution: z.object({
        admin: z.number(),
        merchant: z.number(),
        user: z.number(),
      }),
    }),
    recentActivity: z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        user: z.string().optional(),
        timestamp: z.string(),
        details: z.record(z.unknown()).optional(),
      }),
    ),
    systemHealth: z.object({
      status: z.enum(['healthy', 'warning', 'critical']),
      uptime: z.number(),
      responseTime: z.number(),
      errorRate: z.number(),
      cacheHitRate: z.number(),
    }),
    meta: z.object({
      lastUpdated: z.string(),
      userId: z.string(),
      source: z.enum(['redis', 'clerk', 'custom_auth']),
      cached: z.boolean(),
      responseTime: z.number(),
    }),
  }),
});

export type DashboardAnalytics = z.infer<typeof _DashboardAnalyticsSchema>;

/**
 * GET /api/dashboard - Unified dashboard analytics endpoint
 * Returns comprehensive dashboard data including analytics, user stats, and recent activity
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();

  try {
    // 1. Authentication and role validation
    const user = await requireAuth(request);

    // 2. Permission check for dashboard access
    if (!['admin', 'merchant', 'user'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for dashboard access' },
        { status: 403 },
      );
    }

    // 4. Connect to database
    await connectDB();

    // 5. Parallel data fetching for performance
    const [analyticsData, userStatsData, recentActivityData, systemHealthData] = await Promise.all([
      getAnalyticsData(user.role, user.id),
      getUserStats(user.role),
      getRecentActivity(user.role, user.id),
      getSystemHealth(),
    ]);

    const responseTime = performance.now() - startTime;

    // 6. Construct response
    const response: DashboardAnalytics['data'] = {
      analytics: analyticsData,
      userStats: userStatsData,
      recentActivity: recentActivityData,
      systemHealth: systemHealthData,
      meta: {
        lastUpdated: new Date().toISOString(),
        userId: user.id,
        source: 'custom_auth',
        cached: false,
        responseTime: Math.round(responseTime),
      },
    };

    // 7. Log performance metrics
    if (responseTime > 1000) {
      console.warn(`[Dashboard API] Slow response: ${responseTime}ms`);
    }

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60', // 1 minute cache
          'X-Response-Time': responseTime.toFixed(2),
        },
      },
    );
  } catch (error) {
    console.error('[Dashboard API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId: crypto.randomUUID(),
      },
      { status: 500 },
    );
  }
}

/**
 * Get analytics data (revenue, orders, growth metrics)
 */
async function getAnalyticsData(userRole: string, userId: string) {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Base query - admins see all data, merchants and users see their own
    const baseQuery = userRole === 'admin' ? {} : { createdBy: userId };

    // Current month metrics
    const [totalRevenue, totalOrders, completedOrders, pendingOrders] = await Promise.all([
      OrderModel.aggregate([
        { $match: { ...baseQuery, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      OrderModel.countDocuments(baseQuery),
      OrderModel.countDocuments({ ...baseQuery, status: 'completed' }),
      OrderModel.countDocuments({ ...baseQuery, status: 'pending' }),
    ]);

    // Previous month for growth calculation
    const [lastMonthRevenue, lastMonthOrders] = await Promise.all([
      OrderModel.aggregate([
        {
          $match: {
            ...baseQuery,
            status: 'completed',
            createdAt: { $gte: lastMonth, $lt: thisMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      OrderModel.countDocuments({
        ...baseQuery,
        createdAt: { $gte: lastMonth, $lt: thisMonth },
      }),
    ]);

    const currentRevenue = totalRevenue[0]?.total || 0;
    const currentOrders = totalOrders;
    const previousRevenue = lastMonthRevenue[0]?.total || 0;
    const previousOrders = lastMonthOrders;

    // Calculate growth rates
    const revenueGrowth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const orderGrowth =
      previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders) * 100 : 0;

    // Average order value and conversion rate
    const avgOrderValue = completedOrders > 0 ? currentRevenue / completedOrders : 0;
    const conversionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue = await OrderModel.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Top merchants (admin only)
    const topMerchants =
      userRole === 'admin'
        ? await OrderModel.aggregate([
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: '$createdBy',
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'merchant',
              },
            },
            {
              $project: {
                id: '$_id',
                name: { $arrayElemAt: ['$merchant.name', 0] },
                revenue: 1,
                orders: 1,
              },
            },
          ])
        : [];

    return {
      totalRevenue: currentRevenue,
      totalOrders: currentOrders,
      completedOrders,
      pendingOrders,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      orderGrowth: Math.round(orderGrowth * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      monthlyRevenue: monthlyRevenue.map((item: { _id: { year: number; month: number }; revenue: number; orders: number }) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        revenue: item.revenue,
        orders: item.orders,
      })),
      topMerchants: topMerchants.map((merchant: { id: string; name?: string; revenue: number; orders: number }) => ({
        id: merchant.id,
        name: merchant.name || 'Unknown Merchant',
        revenue: merchant.revenue,
        orders: merchant.orders,
      })),
    };
  } catch (error) {
    console.error('[Dashboard] Analytics error:', error);
    return {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      revenueGrowth: 0,
      orderGrowth: 0,
      avgOrderValue: 0,
      conversionRate: 0,
      monthlyRevenue: [],
      topMerchants: [],
    };
  }
}

/**
 * Get user statistics
 */
async function getUserStats(userRole: string) {
  try {
    // Admin sees all users, merchants and users see limited stats
    if (userRole !== 'admin') {
      return {
        totalUsers: 1, // They can see they exist
        activeUsers: 1,
        newUsers: 0,
        userGrowth: 0,
        roleDistribution: { admin: 0, merchant: 0, user: 0 },
      };
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalUsers, newUsers, lastMonthUsers, roleDistribution] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ createdAt: { $gte: thisMonth } }),
      UserModel.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
      UserModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);

    const activeUsers = Math.floor(totalUsers * 0.7); // Estimate active users
    const userGrowth =
      lastMonthUsers > 0 ? ((newUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;

    const roles = roleDistribution.reduce(
      (acc: Record<string, number>, item: { _id: string; count: number }) => {
        acc[item._id] = item.count;
        return acc;
      },
      { admin: 0, merchant: 0, user: 0 },
    );

    return {
      totalUsers,
      activeUsers,
      newUsers,
      userGrowth: Math.round(userGrowth * 100) / 100,
      roleDistribution: roles,
    };
  } catch (error) {
    console.error('[Dashboard] User stats error:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      userGrowth: 0,
      roleDistribution: { admin: 0, merchant: 0, user: 0 },
    };
  }
}

/**
 * Get recent activity from audit logs
 */
async function getRecentActivity(userRole: string, userId: string) {
  try {
    // Base query - admins see all activity, merchants and users see their own
    const baseQuery = userRole === 'admin' ? {} : { userId };

    const activities = await AuditLogModel.find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action userId createdAt metadata')
      .lean();

    return activities.map((activity: Record<string, unknown>) => ({
      id: String(activity._id),
      action: String(activity.action),
      user: String(activity.userId),
      timestamp: (activity.createdAt as Date).toISOString(),
      details: activity.metadata as Record<string, unknown> | undefined,
    }));
  } catch (error) {
    console.error('[Dashboard] Activity error:', error);
    return [];
  }
}

/**
 * Get system health metrics
 */
async function getSystemHealth() {
  try {
    // Mock system health data - in production, this would come from monitoring
    const uptime = process.uptime() * 1000; // Convert to milliseconds
    const responseTime = Math.random() * 100 + 50; // Mock 50-150ms
    const errorRate = Math.random() * 2; // Mock 0-2% error rate
    const cacheHitRate = 85 + Math.random() * 10; // Mock 85-95% cache hit rate

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (responseTime > 200 || errorRate > 5) {
      status = 'warning';
    }
    if (responseTime > 500 || errorRate > 10) {
      status = 'critical';
    }

    return {
      status,
      uptime: Math.round(uptime),
      responseTime: Math.round(responseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    };
  } catch (error) {
    console.error('[Dashboard] Health check error:', error);
    return {
      status: 'critical' as const,
      uptime: 0,
      responseTime: 0,
      errorRate: 100,
      cacheHitRate: 0,
    };
  }
}
