'use client';

import React, { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@clerk/nextjs';
import { useDashboardData } from '@/hooks/use-dashboard';
import { StatsCards } from '@/components/shared/stats-cards';
import { MetricCard } from '@/components/shared/metric-card';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  ShoppingCart,
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  ArrowUpRight,
  Zap,
  Shield,
  Globe,
  Sparkles,
} from 'lucide-react';

// Enhanced mock data with more realistic metrics
const mockStats = {
  totalUsers: 2847,
  totalOrders: 15623,
  totalRevenue: 2890650,
  successRate: 97.8,
  pendingOrders: 34,
  completedOrders: 15456,
  failedOrders: 133,
  activeUsers: 892,
  monthlyGrowth: 23.8,
  recentActivity: [
    {
      id: 1,
      action: 'High-value order created',
      user: 'Rajesh Kumar',
      time: '2 minutes ago',
      type: 'order',
      amount: '₹25,000',
    },
    {
      id: 2,
      action: 'Premium user registered',
      user: 'Priya Sharma',
      time: '5 minutes ago',
      type: 'user',
      details: 'Enterprise plan',
    },
    {
      id: 3,
      action: 'Payment completed',
      user: 'Amit Patel',
      time: '8 minutes ago',
      type: 'payment',
      amount: '₹8,750',
    },
    {
      id: 4,
      action: 'Bulk payment processed',
      user: 'Sneha Gupta',
      time: '12 minutes ago',
      type: 'payment',
      amount: '₹45,200',
    },
    {
      id: 5,
      action: 'System security scan',
      user: 'System',
      time: '15 minutes ago',
      type: 'system',
      details: 'All clear',
    },
  ],
};

// Create Payment Link Modal Component
function CreatePaymentLinkModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    customerName: '',
    customerEmail: '',
    expiryHours: '24',
  });
  const { toast } = useToast();

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const orderId = `ORD${Date.now()}`;
      const paymentLink = `${window.location.origin}/pay/${orderId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(paymentLink);

      toast({
        title: '✨ Payment Link Created!',
        description: 'Link copied to clipboard successfully',
      });

      // Reset form and close modal
      setFormData({
        amount: '',
        description: '',
        customerName: '',
        customerEmail: '',
        expiryHours: '24',
      });
      onClose();
          } catch {
      toast({
        title: '❌ Error',
        description: 'Failed to create payment link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border border-slate-700/50 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
            Create Payment Link
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateLink} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="font-medium text-slate-200">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              className="border-slate-600 bg-slate-800/50 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium text-slate-200">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Payment description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="resize-none border-slate-600 bg-slate-800/50 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="font-medium text-slate-200">
                Customer Name
              </Label>
              <Input
                id="customerName"
                type="text"
                placeholder="Full name"
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                className="border-slate-600 bg-slate-800/50 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryHours" className="font-medium text-slate-200">
                Expires In
              </Label>
              <Select
                value={formData.expiryHours}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, expiryHours: value }))}
              >
                <SelectTrigger className="border-slate-600 bg-slate-800/50 text-white focus:border-transparent focus:ring-2 focus:ring-purple-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-600 bg-slate-800">
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="24">24 Hours</SelectItem>
                  <SelectItem value="168">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail" className="font-medium text-slate-200">
              Customer Email (Optional)
            </Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="customer@example.com"
              value={formData.customerEmail}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
              className="border-slate-600 bg-slate-800/50 text-white placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 border-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/25 hover:from-indigo-500 hover:to-purple-500"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Link
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function AdminStatsCards() {
  const metrics = [
    {
      id: 'total-users',
      title: 'Total Users',
      value: mockStats.totalUsers.toLocaleString(),
      description: 'Registered users',
      icon: Users,
      trend: '+12% from last month',
    },
    {
      id: 'total-orders',
      title: 'Total Orders',
      value: mockStats.totalOrders.toLocaleString(),
      description: 'Payment orders processed',
      icon: ShoppingCart,
      trend: '+8% from last month',
    },
    {
      id: 'total-revenue',
      title: 'Total Revenue',
      value: `₹${(mockStats.totalRevenue / 100000).toFixed(1)}L`,
      description: 'Revenue generated',
      icon: DollarSign,
      trend: '+15% from last month',
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: `${mockStats.successRate}%`,
      description: 'Payment success rate',
      icon: Activity,
      trend: '+2.1% from last month',
    },
  ];

  return <StatsCards metrics={metrics} />;
}

function OrderStatusCards() {
  const orderMetrics = [
    {
      title: 'Pending Orders',
      value: mockStats.pendingOrders,
      description: 'Awaiting verification',
      icon: Clock,
      trend: 'Active',
    },
    {
      title: 'Completed Orders',
      value: mockStats.completedOrders.toLocaleString(),
      description: 'Successfully processed',
      icon: CheckCircle,
      trend: 'Success',
    },
    {
      title: 'Failed Orders',
      value: mockStats.failedOrders,
      description: 'Failed or expired',
      icon: XCircle,
      trend: 'Issues',
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {orderMetrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          trend={metric.trend}
        />
      ))}
    </div>
  );
}

function RecentActivity() {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-5 w-5 text-blue-400" />;
      case 'user':
        return <Users className="h-5 w-5 text-emerald-400" />;
      case 'payment':
        return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case 'system':
        return <Shield className="h-5 w-5 text-purple-400" />;
      default:
        return <Activity className="h-5 w-5 text-slate-400" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'order':
        return (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
            Order
          </span>
        );
      case 'user':
        return (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">
            User
          </span>
        );
      case 'payment':
        return (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">
            Payment
          </span>
        );
      case 'system':
        return (
          <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-xs text-purple-300">
            System
          </span>
        );
      default:
        return (
          <span className="rounded-full border border-slate-500/30 bg-slate-500/20 px-2 py-1 text-xs text-slate-300">
            Activity
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-8 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-white">Recent Activity</h2>
          <p className="text-sm text-slate-400">Latest system activities and events</p>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-3">
          <Activity className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="space-y-3">
        {mockStats.recentActivity.map((activity) => (
          <div
            key={activity.id}
            className="group rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800/70"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="rounded-lg bg-slate-700/50 p-2 transition-transform duration-200 group-hover:scale-110">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-sm font-medium text-white">{activity.action}</h3>
                  <p className="text-xs text-slate-400">by {activity.user}</p>
                  {activity.amount && (
                    <p className="mt-1 text-xs font-medium text-emerald-400">{activity.amount}</p>
                  )}
                  {activity.details && (
                    <p className="mt-1 text-xs text-slate-500">{activity.details}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {getActivityBadge(activity.type)}
                <span className="text-xs text-slate-500">{activity.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-700/50 pt-6">
        <button className="group w-full rounded-xl border border-slate-600/50 bg-gradient-to-r from-slate-700/50 to-slate-800/50 p-4 text-slate-300 transition-all duration-300 hover:scale-[1.02] hover:border-slate-500/50 hover:from-slate-600/50 hover:to-slate-700/50 hover:text-white">
          <div className="flex items-center justify-center space-x-2">
            <Eye className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">View All Activity</span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [createLinkModal, setCreateLinkModal] = useState(false);
  const { user } = useUser();
  const userRole = (user?.publicMetadata?.role as string) || 'admin';
  const { data: dashboardData, isLoading: _isLoading, error } = useDashboardData(userRole);

  // Use real data if available, otherwise fall back to mock data
  const _stats = dashboardData || mockStats;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-400">Error Loading Dashboard</h1>
            <p className="text-slate-400">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-lg text-slate-400">
            Welcome back! Here&apos;s what&apos;s happening with your UPI payment system.
          </p>
        </div>

        {/* Stats Cards */}
        <Suspense
          fallback={
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm"
                >
                  <div className="mb-4 h-4 rounded bg-slate-700"></div>
                  <div className="mb-2 h-8 rounded bg-slate-700"></div>
                  <div className="h-3 rounded bg-slate-700"></div>
                </div>
              ))}
            </div>
          }
        >
          <AdminStatsCards />
        </Suspense>

        {/* Order Status Cards */}
        <Suspense
          fallback={
            <div className="grid gap-6 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm"
                >
                  <div className="mb-4 h-4 rounded bg-slate-700"></div>
                  <div className="mb-2 h-8 rounded bg-slate-700"></div>
                  <div className="h-3 rounded bg-slate-700"></div>
                </div>
              ))}
            </div>
          }
        >
          <OrderStatusCards />
        </Suspense>

        {/* Quick Actions Section */}
        <div className="rounded-2xl border border-slate-700/30 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-8 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-xl font-semibold text-white">Quick Actions</h2>
              <p className="text-sm text-slate-400">Common administrative tasks</p>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-3">
              <Zap className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Create Payment Link */}
            <button
              onClick={() => setCreateLinkModal(true)}
              className="group relative overflow-hidden rounded-xl border border-purple-400/20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 hover:shadow-2xl hover:shadow-purple-500/25"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <Plus className="h-8 w-8 transition-transform duration-500 group-hover:rotate-90" />
                </div>
                <h3 className="mb-2 text-lg font-bold">Create Payment Link</h3>
                <p className="text-sm text-purple-100">Generate instant payment links</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* View All Orders */}
            <button className="group relative overflow-hidden rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 hover:shadow-2xl hover:shadow-emerald-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <Eye className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="mb-2 text-lg font-bold">View All Orders</h3>
                <p className="text-sm text-emerald-100">Browse complete order history</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* System Settings */}
            <button className="group relative overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 p-6 text-white backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:from-amber-500 hover:via-orange-500 hover:to-red-500 hover:shadow-2xl hover:shadow-amber-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <Shield className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="mb-2 text-lg font-bold">System Settings</h3>
                <p className="text-sm text-amber-100">Configure system parameters</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* Analytics */}
            <button className="group relative overflow-hidden rounded-xl border border-violet-400/20 bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 p-6 text-white backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:from-purple-500 hover:via-violet-500 hover:to-indigo-500 hover:shadow-2xl hover:shadow-purple-500/25">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-white/10 p-3 backdrop-blur-sm">
                  <Globe className="h-8 w-8 transition-transform duration-300 group-hover:rotate-12" />
                </div>
                <h3 className="mb-2 text-lg font-bold">Analytics</h3>
                <p className="text-sm text-purple-100">View detailed analytics</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <Suspense
          fallback={
            <div className="animate-pulse rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 backdrop-blur-sm">
              <div className="mb-4 h-6 rounded bg-slate-700"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-slate-700/50"></div>
                ))}
              </div>
            </div>
          }
        >
          <RecentActivity />
        </Suspense>

        {/* Create Payment Link Modal */}
        <CreatePaymentLinkModal
          isOpen={createLinkModal}
          onClose={() => setCreateLinkModal(false)}
        />
      </div>
    </div>
  );
}
