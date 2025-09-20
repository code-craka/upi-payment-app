'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, Search, Eye, CheckCircle, XCircle, Clock, Copy } from 'lucide-react';
import type { OrderTable } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Mock data - replace with actual API calls
const mockOrders: OrderTable[] = [
  {
    _id: '1',
    id: '1',
    orderId: 'ORD-2024-001',
    amount: 1500,
    description: "Payment to John's Store",
    upiId: 'john@paytm',
    merchantName: "John's Store",
    vpa: 'john@paytm',
    status: 'pending-verification',
    utr: '123456789012',
    createdBy: 'user1',
    createdAt: new Date('2024-01-20T10:30:00'),
    updatedAt: new Date('2024-01-20T10:30:00'),
    expiresAt: new Date('2024-01-20T10:39:00'),
    paymentPageUrl: '/pay/ORD-2024-001',
    upiDeepLink: "upi://pay?pa=john@paytm&pn=John's Store&am=1500",
  },
  {
    _id: '2',
    id: '2',
    orderId: 'ORD-2024-002',
    amount: 2500,
    description: 'Payment to Tech Solutions',
    upiId: 'tech@gpay',
    merchantName: 'Tech Solutions',
    vpa: 'tech@gpay',
    status: 'completed',
    utr: '987654321098',
    createdBy: 'user2',
    createdAt: new Date('2024-01-20T09:15:00'),
    updatedAt: new Date('2024-01-20T09:15:00'),
    expiresAt: new Date('2024-01-20T09:24:00'),
    paymentPageUrl: '/pay/ORD-2024-002',
    upiDeepLink: 'upi://pay?pa=tech@gpay&pn=Tech Solutions&am=2500',
  },
  {
    _id: '3',
    id: '3',
    orderId: 'ORD-2024-003',
    amount: 750,
    description: 'Payment to Coffee Shop',
    upiId: 'coffee@phonepe',
    merchantName: 'Coffee Shop',
    vpa: 'coffee@phonepe',
    status: 'expired',
    createdBy: 'user3',
    createdAt: new Date('2024-01-20T08:00:00'),
    updatedAt: new Date('2024-01-20T08:00:00'),
    expiresAt: new Date('2024-01-20T08:09:00'),
    paymentPageUrl: '/pay/ORD-2024-003',
    upiDeepLink: 'upi://pay?pa=coffee@phonepe&pn=Coffee Shop&am=750',
  },
  {
    _id: '4',
    id: '4',
    orderId: 'ORD-2024-004',
    amount: 3200,
    description: 'Payment to Electronics Hub',
    upiId: 'electronics@bhim',
    merchantName: 'Electronics Hub',
    vpa: 'electronics@bhim',
    status: 'pending',
    createdBy: 'user1',
    createdAt: new Date('2024-01-20T11:45:00'),
    updatedAt: new Date('2024-01-20T11:45:00'),
    expiresAt: new Date('2024-01-20T11:54:00'),
    paymentPageUrl: '/pay/ORD-2024-004',
    upiDeepLink: 'upi://pay?pa=electronics@bhim&pn=Electronics Hub&am=3200',
  },
];

interface OrdersTableProps {
  showAllOrders?: boolean;
  userId?: string;
}

export function OrdersTable({ showAllOrders = true, userId }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orders, setOrders] = useState<OrderTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (!showAllOrders && userId) params.set('userId', userId);
      params.set('limit', '50'); // Fetch more orders for better UX

      const response = await fetch(`/api/orders?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Ensure we always get an array
        const ordersData = data.data || data || [];
        const validOrders = Array.isArray(ordersData) ? ordersData : [];
        setOrders(validOrders);
      } else {
        // Fallback to mock data if API fails
        console.warn('Failed to fetch orders from API, using mock data');
        setOrders(Array.isArray(mockOrders) ? mockOrders : []);
        setError('Failed to fetch orders from server, showing sample data');
      }
    } catch (fetchError) {
      console.error('Error fetching orders, using mock data:', fetchError);
      setOrders(Array.isArray(mockOrders) ? mockOrders : []);
      setError('Network error occurred, showing sample data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showAllOrders, userId]);

  // Fetch orders on component mount and when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Ensure orders is always an array before filtering
  const safeOrders = Array.isArray(orders) ? orders : [];

  const filteredOrders = safeOrders.filter((order) => {
    // Add safety checks for order properties
    if (!order || typeof order !== 'object') return false;

    const orderId = order.orderId || '';
    const merchantName = order.merchantName || '';
    const vpa = order.vpa || '';
    const status = order.status || '';
    const createdBy = order.createdBy || '';

    const matchesSearch =
      orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vpa.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesUser = showAllOrders || createdBy === userId;

    return matchesSearch && matchesStatus && matchesUser;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="border-blue-200 text-blue-600">
            Pending
          </Badge>
        );
      case 'pending-verification':
        return (
          <Badge variant="outline" className="border-yellow-200 text-yellow-600">
            Pending Verification
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="border-green-200 text-green-600">
            Completed
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="border-red-200 text-red-600">
            Expired
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="border-red-200 text-red-600">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      // Optimistically update the UI
      setOrders(
        orders.map((order) =>
          order._id === orderId || order.id === orderId
            ? { ...order, status: newStatus as 'pending' | 'pending-verification' | 'completed' | 'expired' | 'failed' }
            : order,
        ),
      );

      // Make API call to update status
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        await fetchOrders();
        throw new Error('Failed to update order status');
      }

      toast({
        title: 'Order status updated',
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      });
    } catch (_error) {
      toast({
        title: 'Error updating order',
        description: 'There was a problem updating the order status.',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: `${label} has been copied to your clipboard.`,
    });
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <div className="rounded-full bg-green-500 p-2">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Orders Management
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              {showAllOrders ? 'View and manage all orders in the system' : 'Your payment orders'}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-6">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 bg-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px] border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-gray-200 shadow-lg">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pending-verification">Pending Verification</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border bg-muted p-4">
                <div className="flex items-center space-x-4">
                  <div className="h-4 w-32 rounded bg-muted-foreground/20"></div>
                  <div className="h-4 w-24 rounded bg-muted-foreground/20"></div>
                  <div className="h-4 w-20 rounded bg-muted-foreground/20"></div>
                  <div className="h-4 w-16 rounded bg-muted-foreground/20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Order ID</TableHead>
                    <TableHead className="font-semibold text-gray-700">Merchant</TableHead>
                    <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                    <TableHead className="font-semibold text-gray-700">UPI ID</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700">UTR</TableHead>
                    <TableHead className="font-semibold text-gray-700">Created</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(filteredOrders) && filteredOrders.length > 0 && filteredOrders.map((order) => {
                    // Additional safety check for each order
                    if (!order || typeof order !== 'object') return null;

                    return (
                      <TableRow key={order._id || order.id || Math.random()} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-900">{order.orderId || 'N/A'}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(order.orderId || '', 'Order ID')}
                              className="h-6 w-6 p-0 hover:bg-green-100"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">{order.merchantName || 'N/A'}</TableCell>
                        <TableCell className="font-medium text-gray-900">{formatCurrency(order.amount || 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{order.vpa}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(order.vpa || '', 'UPI ID')}
                              className="h-6 w-6 p-0 hover:bg-green-100"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          {order.utr ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-900">{order.utr}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(order.utr!, 'UTR')}
                                className="h-6 w-6 p-0 hover:bg-green-100"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="text-gray-900">{order.createdAt.toLocaleDateString()}</div>
                            <div className="text-gray-500">
                              {order.createdAt.toLocaleTimeString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border border-gray-200">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => window.open(order.paymentPageUrl, '_blank')}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Payment Page
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {showAllOrders && (
                                <>
                                  <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(order._id || order.id, 'completed')}
                                    disabled={order.status === 'completed'}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark Completed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(order._id || order.id, 'failed')}
                                    disabled={order.status === 'failed'}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Mark Failed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleStatusUpdate(order._id || order.id, 'pending-verification')
                                    }
                                    disabled={order.status === 'pending-verification'}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    Pending Verification
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Empty State */}
            {filteredOrders.length === 0 && !loading && (
              <div className="text-center py-12">
                <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
                <p className="text-gray-500">
                  {searchTerm || statusFilter !== 'all'
                    ? 'No orders match your current filters.'
                    : 'Orders will appear here once customers start making payments.'
                  }
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
