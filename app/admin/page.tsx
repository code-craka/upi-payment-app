'use client';

import React, { Suspense, useState, useEffect } from 'react';
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
import { useUser } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/use-dashboard';
import { StatsCards } from '@/components/shared/stats-cards';
import { MetricCard } from '@/components/shared/metric-card';
import { useToast } from '@/hooks/use-toast';
import {
  Activity,
  CheckCircle,
  Plus,
  Eye,
  ArrowUpRight,
  Zap,
  Shield,
  Globe,
  Sparkles,
} from 'lucide-react';
import { IconWrapper } from '@/lib/icon-wrapper';
import { MerchantDashboard } from '@/components/admin/merchant-dashboard';
import { ModernAdminDashboard } from '@/components/admin/modern-admin-dashboard';

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
function CreatePaymentLinkModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
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
      // Validate required fields
      if (!formData.amount || !formData.description || !formData.customerName) {
        throw new Error('Please fill in all required fields');
      }

      // Create real payment order via API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || undefined,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expiresInMinutes: parseInt(formData.expiryHours) * 60, // Convert hours to minutes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      const result = await response.json();
      const orderId = result.data.orderId;
      const paymentLink = `${window.location.origin}/pay/${orderId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(paymentLink);

      toast({
        title: '✨ Payment Link Created!',
        description: `Order ${orderId} created and link copied to clipboard`,
      });

      // Call success callback to refresh dashboard
      onSuccess?.();

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
      <DialogContent className="max-w-md border border-border bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-2xl font-bold text-transparent">
            Create Payment Link
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateLink} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="font-medium text-foreground">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-2">
                        <Label htmlFor="description" className="font-medium text-foreground">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Enter payment description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary resize-none"
              rows={3}
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
                required
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
                  <IconWrapper icon={Sparkles} className="mr-2 h-4 w-4" />
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
function AdminStatsCards({ stats, isLoading }: { stats: typeof mockStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 h-4 rounded bg-muted"></div>
            <div className="mb-2 h-8 rounded bg-muted"></div>
            <div className="h-3 rounded bg-muted"></div>
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      id: 'total-users',
      title: 'Total Users',
      value: (stats.totalUsers || 0).toLocaleString(),
      description: 'Registered users',
      icon: 'Users',
      trend: '+12% from last month',
    },
    {
      id: 'total-orders',
      title: 'Total Orders',
      value: (stats.totalOrders || 0).toLocaleString(),
      description: 'Payment orders processed',
      icon: 'ShoppingCart',
      trend: '+8% from last month',
    },
    {
      id: 'total-revenue',
      title: 'Total Revenue',
      value: `₹${((stats.totalRevenue || 0) / 100000).toFixed(1)}L`,
      description: 'Revenue generated',
      icon: 'DollarSign',
      trend: '+15% from last month',
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: `${stats.successRate || 0}%`,
      description: 'Payment success rate',
      icon: 'Activity',
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
      icon: 'Clock', // Changed from Clock component to string
      trend: 'Active',
    },
    {
      title: 'Completed Orders',
      value: mockStats.completedOrders.toLocaleString(),
      description: 'Successfully processed',
      icon: 'CheckCircle', // Changed from CheckCircle component to string
      trend: 'Success',
    },
    {
      title: 'Failed Orders',
      value: mockStats.failedOrders,
      description: 'Failed or expired',
      icon: 'XCircle', // Changed from XCircle component to string
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

function RecentPaymentLinks() {
  const [paymentLinks, setPaymentLinks] = useState<Array<{
    id: string;
    amount: number;
    customerName: string;
    description?: string;
    expiresAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPaymentLinks();
  }, []);

  const fetchPaymentLinks = async () => {
    try {
      const response = await fetch('/api/orders?limit=5&status=pending');
      if (response.ok) {
        const data = await response.json();
        // Ensure we always get an array
        const linksData = data.data || data || [];
        const validLinks = Array.isArray(linksData) ? linksData : [];
        setPaymentLinks(validLinks);
      } else {
        // If API fails, don't show empty state, just log the error
        console.warn('Failed to fetch payment links from API');
        setPaymentLinks([]);
      }
    } catch (_error) {
      console.error('Failed to fetch payment links');
      setPaymentLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Copied!',
        description: 'Payment link copied to clipboard',
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 backdrop-blur-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Recent Payment Links</h2>
          <p className="text-sm text-muted-foreground">Latest payment links created</p>
        </div>
        <div className="rounded-xl bg-primary p-3">
          <IconWrapper icon={Zap} className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>

      {!Array.isArray(paymentLinks) || paymentLinks.length === 0 ? (
        <div className="text-center py-8">
          <IconWrapper icon={Plus} className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Payment Links Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first payment link to get started</p>
          <Button className="bg-primary hover:bg-primary/90">
            <IconWrapper icon={Plus} className="h-4 w-4 mr-2" />
            Create Payment Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.isArray(paymentLinks) && paymentLinks.map((link) => (
            <div
              key={link.id}
              className="group rounded-xl border border-border bg-card/50 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:bg-card/70"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="rounded-lg bg-primary/10 p-2 transition-transform duration-200 group-hover:scale-110">
                    <IconWrapper icon={CheckCircle} className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-sm font-medium text-foreground">
                      ₹{link.amount} - {link.customerName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {link.description || 'Payment link'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(link.expiresAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/pay/${link.id}`)}
                    className="border-primary/20 hover:bg-primary/10"
                  >
                    <IconWrapper icon={Eye} className="h-4 w-4 mr-1" />
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(`/pay/${link.id}`, '_blank')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <IconWrapper icon={ArrowUpRight} className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {paymentLinks.length > 0 && (
        <div className="mt-6 border-t border-border pt-6">
          <button
            className="group w-full rounded-xl border border-border bg-card p-4 text-card-foreground transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:bg-card/90 hover:text-foreground"
            onClick={() => window.location.href = '/admin/orders'}
          >
            <div className="flex items-center justify-center space-x-2">
              <IconWrapper icon={Eye} className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="font-medium">View All Payment Links</span>
              <IconWrapper icon={ArrowUpRight} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function RecentActivity({ activities }: { activities: Array<{ id: number; action: string; user: string; time: string; type: string; amount?: string; details?: string }> }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return CheckCircle;
      case 'user':
        return Plus;
      case 'payment':
        return ArrowUpRight;
      case 'system':
        return Shield;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'order':
        return 'text-green-400';
      case 'user':
        return 'text-blue-400';
      case 'payment':
        return 'text-purple-400';
      case 'system':
        return 'text-orange-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-8 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">Latest system activities</p>
        </div>
        <div className="rounded-xl bg-primary p-3">
          <IconWrapper icon={Activity} className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="group flex items-center space-x-4 rounded-xl border border-border bg-card/50 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:bg-card/70"
          >
            <div className={`rounded-lg bg-primary/10 p-2 transition-transform duration-200 group-hover:scale-110`}>
              <IconWrapper
                icon={getActivityIcon(activity.type)}
                className={`h-5 w-5 ${getActivityColor(activity.type)}`}
              />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-medium text-foreground">
                {activity.action}
              </h3>
              <p className="text-xs text-muted-foreground">
                {activity.user} • {activity.time}
              </p>
              {(activity.amount || activity.details) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.amount || activity.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <button
          className="group w-full rounded-xl border border-border bg-card p-4 text-card-foreground transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:bg-card/90 hover:text-foreground"
          onClick={() => window.location.href = '/admin/audit-logs'}
        >
          <div className="flex items-center justify-center space-x-2">
            <IconWrapper icon={Eye} className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">View All Activity</span>
            <IconWrapper icon={ArrowUpRight} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [createLinkModal, setCreateLinkModal] = useState(false);

  // Handle custom authentication
  let user = null;
  let userRole = 'admin'; // Default to admin for development

  try {
    const authResult = useUser();
    user = authResult.user;
    userRole = user?.role || 'admin';
  } catch (_error) {
    console.warn('Authentication failed, using development mode:', _error);
    // In development mode, we'll use mock data
    user = { id: 'dev-user', email: 'admin@dev.com', role: 'admin' };
  }

  // Use the dashboard hook to fetch real data (must be called before any returns)
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(userRole);

  // If user is merchant, show merchant-specific dashboard
  if (userRole === 'merchant') {
    return <MerchantDashboard />;
  }

  // For admin users, show the modern admin dashboard
  if (userRole === 'admin') {
    return <ModernAdminDashboard />;
  }

  // Continue with admin dashboard for admin users (fallback)

  // Use real data if available, otherwise fall back to mock data
  const stats = dashboardData?.stats ? {
    totalUsers: dashboardData.stats.totalUsers || 0,
    totalOrders: dashboardData.stats.totalOrders || 0,
    totalRevenue: dashboardData.stats.totalRevenue || 0,
    successRate: dashboardData.stats.successRate || 0,
    pendingOrders: dashboardData.stats.pendingOrders || 0,
    completedOrders: dashboardData.stats.completedOrders || 0,
    failedOrders: dashboardData.stats.failedOrders || 0,
    activeUsers: dashboardData.stats.activeUsers || 0,
    monthlyGrowth: dashboardData.stats.monthlyGrowth || 0,
    recentActivity: mockStats.recentActivity,
  } : mockStats;
  const recentActivity = dashboardData?.recentActivity || mockStats.recentActivity;

  // Function to refresh dashboard data
  const refreshDashboard = () => {
    // Trigger a page refresh or refetch data
    window.location.reload();
  };

  // Handle errors from dashboard hook
  if (dashboardError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-400">Error Loading Dashboard</h1>
            <p className="text-slate-400">{dashboardError.message}</p>
            <button
              onClick={refreshDashboard}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-4xl font-bold text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
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
                  className="animate-pulse rounded-2xl border border-border bg-card p-6"
                >
                  <div className="mb-4 h-4 rounded bg-muted"></div>
                  <div className="mb-2 h-8 rounded bg-muted"></div>
                  <div className="h-3 rounded bg-muted"></div>
                </div>
              ))}
            </div>
          }
        >
          <AdminStatsCards stats={stats} isLoading={dashboardLoading} />
        </Suspense>

        {/* Order Status Cards */}
        <Suspense
          fallback={
            <div className="grid gap-6 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-border bg-card p-6"
                >
                  <div className="mb-4 h-4 rounded bg-muted"></div>
                  <div className="mb-2 h-8 rounded bg-muted"></div>
                  <div className="h-3 rounded bg-muted"></div>
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
              <h2 className="mb-2 text-xl font-semibold text-foreground">Quick Actions</h2>
              <p className="text-sm text-muted-foreground">Common administrative tasks</p>
            </div>
            <div className="rounded-xl bg-primary p-3">
              <IconWrapper icon={Zap} className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Create Payment Link */}
            <button
              onClick={() => setCreateLinkModal(true)}
              className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-6 text-card-foreground backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:bg-card/90 hover:shadow-2xl hover:shadow-primary/25"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-primary/10 p-3 backdrop-blur-sm">
                  <IconWrapper icon={Plus} className="h-8 w-8 text-primary transition-transform duration-500 group-hover:rotate-90" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">Create Payment Link</h3>
                <p className="text-sm text-muted-foreground">Generate instant payment links</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* View All Orders */}
            <button 
              className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-6 text-card-foreground backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:bg-card/90 hover:shadow-2xl hover:shadow-primary/25"
              onClick={() => window.location.href = '/admin/orders'}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-primary/10 p-3 backdrop-blur-sm">
                  <IconWrapper icon={Eye} className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">View All Orders</h3>
                <p className="text-sm text-muted-foreground">Browse complete order history</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* System Settings */}
            <button 
              className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-6 text-card-foreground backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:bg-card/90 hover:shadow-2xl hover:shadow-primary/25"
              onClick={() => window.location.href = '/admin/settings'}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-primary/10 p-3 backdrop-blur-sm">
                  <IconWrapper icon={Shield} className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">System Settings</h3>
                <p className="text-sm text-muted-foreground">Configure system parameters</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>

            {/* Analytics */}
            <button 
              className="group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-6 text-card-foreground backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:bg-card/90 hover:shadow-2xl hover:shadow-primary/25"
              onClick={() => window.location.href = '/admin/analytics'}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mx-auto mb-4 w-fit rounded-lg bg-primary/10 p-3 backdrop-blur-sm">
                  <IconWrapper icon={Globe} className="h-8 w-8 text-primary transition-transform duration-300 group-hover:rotate-12" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">Analytics</h3>
                <p className="text-sm text-muted-foreground">View detailed analytics</p>
              </div>
              <div className="absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
          </div>
        </div>

        {/* Recent Payment Links */}
        <Suspense
          fallback={
            <div className="animate-pulse rounded-2xl border border-border bg-card p-8 backdrop-blur-sm">
              <div className="mb-4 h-6 rounded bg-muted"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl"></div>
                ))}
              </div>
            </div>
          }
        >
          <RecentPaymentLinks />
        </Suspense>

        {/* Recent Activity */}
        <Suspense
          fallback={
            <div className="animate-pulse rounded-2xl border border-border bg-card p-8 backdrop-blur-sm">
              <div className="mb-4 h-6 rounded bg-muted"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted"></div>
                ))}
              </div>
            </div>
          }
        >
          <RecentActivity activities={recentActivity} />
        </Suspense>

        {/* Create Payment Link Modal */}
        <CreatePaymentLinkModal
          isOpen={createLinkModal}
          onClose={() => setCreateLinkModal(false)}
          onSuccess={refreshDashboard}
        />
      </div>
    </div>
  );
}
