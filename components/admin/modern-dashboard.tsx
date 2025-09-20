'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  CreditCard, 
  DollarSign,
  Activity,
  Plus,
  FileText,
  Settings
} from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  totalOrders: number;
  ordersChange: number;
  totalUsers: number;
  usersChange: number;
  activePayments: number;
  paymentsChange: number;
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

interface SystemHealthMetric {
  name: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
}

const quickActions: QuickAction[] = [
  {
    title: 'Create Payment Link',
    description: 'Generate new UPI payment link',
    icon: <Plus className="h-5 w-5" />,
    href: '/admin/orders/create',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    title: 'View Orders',
    description: 'Manage payment orders',
    icon: <CreditCard className="h-5 w-5" />,
    href: '/admin/orders',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    title: 'User Management',
    description: 'Manage system users',
    icon: <Users className="h-5 w-5" />,
    href: '/admin/users',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    title: 'Audit Logs',
    description: 'View system activity',
    icon: <FileText className="h-5 w-5" />,
    href: '/admin/audit-logs',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
  {
    title: 'Settings',
    description: 'System configuration',
    icon: <Settings className="h-5 w-5" />,
    href: '/admin/settings',
    color: 'bg-gray-500 hover:bg-gray-600',
  },
];

interface ModernDashboardProps {
  className?: string;
}

export function ModernDashboard({ className }: ModernDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/admin/dashboard');
        if (response.ok) {
          const data = await response.json();
          
          // Transform API data to our interface
          setStats({
            totalRevenue: data.data.revenue.total || 0,
            revenueChange: data.data.revenue.change || 0,
            totalOrders: data.data.orders.total || 0,
            ordersChange: data.data.orders.change || 0,
            totalUsers: data.data.users.total || 0,
            usersChange: data.data.users.change || 0,
            activePayments: data.data.orders.pending || 0,
            paymentsChange: 0,
          });

          // Extract system health metrics
          if (data.data.systemHealth) {
            const health = data.data.systemHealth;
            setSystemHealth([
              { name: 'Database', value: 100, status: health.database ? 'healthy' : 'critical' },
              { name: 'Redis Cache', value: 100, status: health.redis ? 'healthy' : 'critical' },
              { name: 'API Response', value: Math.max(0, 100 - (health.avgResponseTime || 0)), status: 'healthy' },
            ]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Set fallback data
        setStats({
          totalRevenue: 0,
          revenueChange: 0,
          totalOrders: 0,
          ordersChange: 0,
          totalUsers: 0,
          usersChange: 0,
          activePayments: 0,
          paymentsChange: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    } else if (change < 0) {
      return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <div className={`flex items-center text-xs ${getChangeColor(stats?.revenueChange || 0)}`}>
              {getChangeIcon(stats?.revenueChange || 0)}
              <span className="ml-1">
                {stats?.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}%` : '0%'} from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalOrders || 0)}</div>
            <div className={`flex items-center text-xs ${getChangeColor(stats?.ordersChange || 0)}`}>
              {getChangeIcon(stats?.ordersChange || 0)}
              <span className="ml-1">
                {stats?.ordersChange ? `${stats.ordersChange > 0 ? '+' : ''}${stats.ordersChange}%` : '0%'} from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.totalUsers || 0)}</div>
            <div className={`flex items-center text-xs ${getChangeColor(stats?.usersChange || 0)}`}>
              {getChangeIcon(stats?.usersChange || 0)}
              <span className="ml-1">
                {stats?.usersChange ? `${stats.usersChange > 0 ? '+' : ''}${stats.usersChange}%` : '0%'} from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Payments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.activePayments || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>Pending transactions</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                className={`${action.color} text-white h-auto p-4 flex-col space-y-2 transition-transform hover:scale-105`}
                onClick={() => window.location.href = action.href}
              >
                {action.icon}
                <div className="text-center">
                  <div className="font-medium text-sm">{action.title}</div>
                  <div className="text-xs opacity-90">{action.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>
            Real-time system performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systemHealth.map((metric, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-24 text-sm font-medium">{metric.name}</div>
                <Progress value={metric.value} className="w-32" />
                <div className="text-sm text-muted-foreground">{metric.value}%</div>
              </div>
              <Badge
                variant={
                  metric.status === 'healthy' 
                    ? 'default' 
                    : metric.status === 'warning' 
                    ? 'secondary' 
                    : 'destructive'
                }
              >
                {metric.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}