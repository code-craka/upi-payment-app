import type { ReactNode } from 'react';

export interface Order {
  id: string;
  orderId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'pending-verification';
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
}

export interface DashboardStats {
  totalUsers?: number;
  totalOrders: number;
  totalRevenue: number;
  successRate: number;
  pendingOrders: number;
  completedOrders: number;
  failedOrders: number;
  activeUsers?: number;
  monthlyGrowth?: number;
  totalLinks?: number;
  activeOrders?: number;
}

export interface ActivityItem {
  id: number;
  action: string;
  user: string;
  time: string;
  type: 'order' | 'user' | 'payment' | 'system';
  amount?: string;
  details?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentOrders?: Order[];
  recentActivity?: ActivityItem[];
}

export interface OrderFilters {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
