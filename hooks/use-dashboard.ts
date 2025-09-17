'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardData, OrderFilters, OrdersResponse } from '@/lib/types/dashboard';

// Fetch dashboard data based on user role
async function fetchDashboardData(userRole: string): Promise<DashboardData> {
  if (userRole === 'admin') {
    const response = await fetch('/api/admin/dashboard');
    if (!response.ok) {
      throw new Error('Failed to fetch admin dashboard data');
    }
    return response.json();
  } else {
    // For merchant/viewer roles
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data');
    }
    return response.json();
  }
}

// Fetch orders with filters
async function fetchOrders(filters: OrderFilters = {}): Promise<OrdersResponse> {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.search) params.set('search', filters.search);

  const response = await fetch(`/api/orders?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  return response.json();
}

export function useDashboardData(userRole: string) {
  return useQuery({
    queryKey: ['dashboard', userRole],
    queryFn: () => fetchDashboardData(userRole),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
