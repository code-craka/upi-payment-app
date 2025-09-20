'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@clerk/nextjs';
import {
  Activity,
  CheckCircle,
  Plus,
  Eye,
  Zap,
  Users,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { IconWrapper } from '@/lib/icon-wrapper';
import { CreateUserDialog } from '@/components/user-management/create-user-dialog';
import { CreatePaymentLinkDialog } from '@/components/payment-links/create-payment-link-dialog';

// Real-time data interfaces
interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  successRate: number;
  pendingOrders: number;
  completedOrders: number;
  failedOrders: number;
  activeUsers: number;
  monthlyGrowth: number;
}

interface RecentOrder {
  id: string;
  orderId: string;
  amount: number;
  customerName: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
}

interface ActivityItem {
  id: number;
  action: string;
  user: string;
  time: string;
  type: 'order' | 'user' | 'payment' | 'system';
  amount?: string;
  details?: string;
}

// Modern Stats Card Component
function ModernStatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'blue'
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendDirection?: 'up' | 'down';
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      icon: 'bg-blue-500 text-white',
      text: 'text-blue-700',
      trend: 'text-blue-600'
    },
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-green-100',
      icon: 'bg-green-500 text-white',
      text: 'text-green-700',
      trend: 'text-green-600'
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      icon: 'bg-purple-500 text-white',
      text: 'text-purple-700',
      trend: 'text-purple-600'
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      icon: 'bg-orange-500 text-white',
      text: 'text-orange-700',
      trend: 'text-orange-600'
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      icon: 'bg-red-500 text-white',
      text: 'text-red-700',
      trend: 'text-red-600'
    }
  };

  const colors = colorClasses[color];

  return (
    <Card className={`${colors.bg} border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className={`text-3xl font-bold ${colors.text}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {trend && (
                <div className={`flex items-center space-x-1 ${colors.trend}`}>
                  <IconWrapper
                    icon={trendDirection === 'up' ? TrendingUp : TrendingDown}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{trend}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          <div className={`rounded-full p-3 ${colors.icon} shadow-lg`}>
            <IconWrapper icon={Icon} className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// Recent Orders Component
function RecentOrders({ orders, loading }: { orders: RecentOrder[]; loading: boolean }) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'pending-verification': { label: 'Verifying', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
      expired: { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200' },
      failed: { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge className={`${config.color} border font-medium`}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-800">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center space-x-4">
                  <div className="h-4 w-32 rounded bg-gray-300"></div>
                  <div className="h-4 w-24 rounded bg-gray-300"></div>
                  <div className="h-4 w-20 rounded bg-gray-300"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
              <IconWrapper icon={ShoppingCart} className="mr-2 h-5 w-5 text-blue-500" />
              Recent Payment Links
            </CardTitle>
            <CardDescription className="text-gray-600">Latest payment links created</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <IconWrapper icon={Plus} className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Links Yet</h3>
            <p className="text-gray-500 mb-4">Create your first payment link to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <IconWrapper icon={DollarSign} className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      ₹{order.amount.toLocaleString()} - {order.customerName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      Order #{order.orderId}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created: {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(order.status)}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <IconWrapper icon={Eye} className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Activity Component
function RecentActivity({ activities, loading }: { activities: ActivityItem[]; loading: boolean }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return CheckCircle;
      case 'user': return Users;
      case 'payment': return DollarSign;
      case 'system': return Activity;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'order': return 'text-green-600 bg-green-100';
      case 'user': return 'text-blue-600 bg-blue-100';
      case 'payment': return 'text-purple-600 bg-purple-100';
      case 'system': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-800">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center space-x-4">
                  <div className="h-8 w-8 rounded bg-gray-300"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-gray-300"></div>
                    <div className="h-3 w-1/2 rounded bg-gray-300"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <IconWrapper icon={Activity} className="mr-2 h-5 w-5 text-green-500" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-gray-600">Latest system activities</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activities.map((activity) => {
            const IconComponent = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);

            return (
              <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`rounded-full p-2 ${colorClass}`}>
                  <IconWrapper icon={IconComponent} className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">
                    {activity.user} • {activity.time}
                  </p>
                  {(activity.amount || activity.details) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {activity.amount || activity.details}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Modern Admin Dashboard Component
export function ModernAdminDashboard() {
  const [createLinkModal, setCreateLinkModal] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    successRate: 0,
    pendingOrders: 0,
    completedOrders: 0,
    failedOrders: 0,
    activeUsers: 0,
    monthlyGrowth: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Get user info
  let _user = null;

  try {
    const clerkUser = useUser();
    _user = clerkUser.user;
  } catch (_error) {
    console.warn('Clerk authentication failed, using development mode');
    _user = { id: 'dev-user', emailAddresses: [{ emailAddress: 'admin@dev.com' }] };
  }

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsResponse = await fetch('/api/admin/dashboard');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.data?.stats) {
          setStats(statsData.data.stats);
        }
      }

      // Fetch recent payment links
      const paymentLinksResponse = await fetch('/api/payment-links?limit=10');
      if (paymentLinksResponse.ok) {
        const paymentLinksData = await paymentLinksResponse.json();
        if (paymentLinksData.success && paymentLinksData.data && Array.isArray(paymentLinksData.data)) {
          // Transform payment links to orders format for display
          const transformedLinks = paymentLinksData.data.map((link: { _id: string; linkId: string; amount?: number; title: string; isActive: boolean; createdAt: string }) => ({
            id: link._id,
            orderId: link.linkId,
            amount: link.amount || 0,
            customerName: link.title,
            status: link.isActive ? 'active' : 'inactive',
            createdAt: link.createdAt,
          }));
          setRecentOrders(transformedLinks);
        }
      }

      // Fetch real activity data
      const activitiesResponse = await fetch('/api/activities?limit=10');
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        if (activitiesData.success && activitiesData.data && Array.isArray(activitiesData.data)) {
          // Transform activities to the expected format
          const transformedActivities = activitiesData.data.map((activity: { title: string; userName?: string; createdAt: string; type: string; amount?: number; description?: string }, index: number) => ({
            id: index + 1,
            action: activity.title,
            user: activity.userName || 'System',
            time: new Date(activity.createdAt).toLocaleString(),
            type: activity.type.includes('user') ? 'user' :
                  activity.type.includes('payment') ? 'payment' :
                  activity.type.includes('link') ? 'order' : 'system',
            amount: activity.amount ? `₹${activity.amount.toLocaleString()}` : undefined,
            details: activity.description,
          }));
          setRecentActivity(transformedActivities);
        } else {
          // Fallback to default activities if none exist
          setRecentActivity([
            { id: 1, action: 'System initialized', user: 'System', time: new Date().toLocaleString(), type: 'system' },
          ]);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleUserCreated = () => {
    fetchDashboardData();
  };

  const handlePaymentLinkCreated = () => {
    fetchDashboardData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's what's happening with your UPI payment system.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <IconWrapper icon={RefreshCw} className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <ModernStatsCard
            title="Total Users"
            value={stats.totalUsers}
            description="Registered users"
            icon={Users}
            trend="+12%"
            color="blue"
          />
          <ModernStatsCard
            title="Total Orders"
            value={stats.totalOrders}
            description="Payment orders processed"
            icon={ShoppingCart}
            trend="+8%"
            color="green"
          />
          <ModernStatsCard
            title="Total Revenue"
            value={`₹${(stats.totalRevenue / 100000).toFixed(1)}L`}
            description="Revenue generated"
            icon={DollarSign}
            trend="+15%"
            color="purple"
          />
          <ModernStatsCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            description="Payment success rate"
            icon={Activity}
            trend="+2.1%"
            color="orange"
          />
        </div>

        {/* Order Status Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <ModernStatsCard
            title="Pending Orders"
            value={stats.pendingOrders}
            description="Awaiting verification"
            icon={Clock}
            color="orange"
          />
          <ModernStatsCard
            title="Completed Orders"
            value={stats.completedOrders}
            description="Successfully processed"
            icon={CheckCircle}
            color="green"
          />
          <ModernStatsCard
            title="Failed Orders"
            value={stats.failedOrders}
            description="Failed or expired"
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Quick Actions */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                  <IconWrapper icon={Zap} className="mr-2 h-5 w-5 text-yellow-500" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-gray-600">Common administrative tasks</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button
                onClick={() => setCreateLinkModal(true)}
                className="h-24 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-center">
                  <IconWrapper icon={Plus} className="h-8 w-8 mx-auto mb-2" />
                  <span className="text-sm font-medium">Create Payment Link</span>
                </div>
              </Button>

              <Button
                onClick={() => setCreateUserModal(true)}
                className="h-24 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-center">
                  <IconWrapper icon={Users} className="h-8 w-8 mx-auto mb-2" />
                  <span className="text-sm font-medium">Create User</span>
                </div>
              </Button>

              <Button
                onClick={() => window.location.href = '/admin/orders'}
                className="h-24 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-center">
                  <IconWrapper icon={Eye} className="h-8 w-8 mx-auto mb-2" />
                  <span className="text-sm font-medium">View All Orders</span>
                </div>
              </Button>

              <Button
                onClick={() => window.location.href = '/admin/analytics'}
                className="h-24 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-center">
                  <IconWrapper icon={Activity} className="h-8 w-8 mx-auto mb-2" />
                  <span className="text-sm font-medium">Analytics</span>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders and Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentOrders orders={recentOrders} loading={loading} />
          <RecentActivity activities={recentActivity} loading={loading} />
        </div>

        {/* Modals */}
        <CreatePaymentLinkDialog
          open={createLinkModal}
          onOpenChange={setCreateLinkModal}
          onLinkCreated={handlePaymentLinkCreated}
        />

        <CreateUserDialog
          open={createUserModal}
          onOpenChange={setCreateUserModal}
          onUserCreated={handleUserCreated}
        />
      </div>
    </div>
  );
}