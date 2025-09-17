import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { StatsCards } from '@/components/shared/stats-cards';
import { formatCurrency } from '@/lib/utils';
import { CreditCard, ShoppingCart, TrendingUp, Plus, Eye } from 'lucide-react';

// Mock data for merchant dashboard
const mockMerchantStats = {
  totalLinks: 45,
  activeOrders: 8,
  completedOrders: 37,
  totalRevenue: 125000,
  successRate: 93.3,
  recentOrders: [
    { id: 'ORD-001', amount: 1500, status: 'completed', createdAt: '2 hours ago' },
    { id: 'ORD-002', amount: 2500, status: 'pending', createdAt: '4 hours ago' },
    { id: 'ORD-003', amount: 750, status: 'pending-verification', createdAt: '6 hours ago' },
  ],
};

function MerchantStatsCards() {
  const merchantMetrics = [
    {
      id: 'payment-links',
      title: 'Payment Links',
      value: mockMerchantStats.totalLinks,
      description: 'Total links created',
      icon: CreditCard,
      trend: '+5 this week',
    },
    {
      id: 'active-orders',
      title: 'Active Orders',
      value: mockMerchantStats.activeOrders,
      description: 'Pending payment',
      icon: ShoppingCart,
      trend: '+2 today',
    },
    {
      id: 'total-revenue',
      title: 'Total Revenue',
      value: formatCurrency(mockMerchantStats.totalRevenue),
      description: 'From completed orders',
      icon: TrendingUp,
      trend: '+12% this month',
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: `${mockMerchantStats.successRate}%`,
      description: 'Payment completion rate',
      icon: TrendingUp,
      trend: '+0.8% this week',
    },
  ];

  return <StatsCards metrics={merchantMetrics} />;
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Button className="h-20 flex-col gap-2">
            <Plus className="h-6 w-6" />
            Create Payment Link
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
            <Eye className="h-6 w-6" />
            View All Orders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentOrders() {
  const getStatusBadge = (status: string) => {
    const statusColors = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-blue-100 text-blue-800',
      'pending-verification': 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}
      >
        {status.replace('-', ' ')}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Your latest payment orders</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockMerchantStats.recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <p className="font-medium">{order.id}</p>
                <p className="text-muted-foreground text-sm">{order.createdAt}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">{formatCurrency(order.amount)}</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full bg-transparent">
            View All Orders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function MerchantDashboard() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const userRole = (sessionClaims?.publicMetadata as { role?: string })?.role as string;
  const userName = (sessionClaims?.firstName as string) || 'User';

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {userName}!</h1>
          <p className="text-muted-foreground capitalize">{userRole} Dashboard</p>
        </div>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<div>Loading stats...</div>}>
          <MerchantStatsCards />
        </Suspense>

        <div className="grid gap-6 md:grid-cols-2">
          <QuickActions />
          <RecentOrders />
        </div>
      </div>
    </div>
  );
}
