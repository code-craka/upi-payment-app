'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';

// Mock data for user statistics
const userStats = [
  {
    userId: '1',
    userName: 'John Merchant',
    email: 'john@example.com',
    totalLinks: 45,
    successfulOrders: 42,
    failedOrders: 3,
    totalRevenue: 125000,
    successRate: 93.3,
    avgOrderValue: 2976,
    lastActive: '2 hours ago',
  },
  {
    userId: '2',
    userName: 'Jane Store',
    email: 'jane@example.com',
    totalLinks: 38,
    successfulOrders: 35,
    failedOrders: 3,
    totalRevenue: 98000,
    successRate: 92.1,
    avgOrderValue: 2800,
    lastActive: '1 day ago',
  },
  {
    userId: '3',
    userName: 'Mike Tech Solutions',
    email: 'mike@example.com',
    totalLinks: 52,
    successfulOrders: 47,
    failedOrders: 5,
    totalRevenue: 156000,
    successRate: 90.4,
    avgOrderValue: 3319,
    lastActive: '3 hours ago',
  },
  {
    userId: '4',
    userName: 'Sarah Coffee Shop',
    email: 'sarah@example.com',
    totalLinks: 29,
    successfulOrders: 26,
    failedOrders: 3,
    totalRevenue: 45000,
    successRate: 89.7,
    avgOrderValue: 1731,
    lastActive: '5 hours ago',
  },
  {
    userId: '5',
    userName: 'Tom Electronics',
    email: 'tom@example.com',
    totalLinks: 41,
    successfulOrders: 36,
    failedOrders: 5,
    totalRevenue: 189000,
    successRate: 87.8,
    avgOrderValue: 5250,
    lastActive: '1 hour ago',
  },
];

export function UserStatsTable() {
  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) return <Badge className="bg-green-100 text-green-800 border-green-200">Excellent</Badge>;
    if (rate >= 90) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Good</Badge>;
    if (rate >= 80) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Average</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-200">Poor</Badge>;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">User Performance Analytics</h3>
        <p className="text-sm text-gray-600">
          Detailed statistics for each user including success rates and revenue metrics
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200">
              <TableHead className="font-semibold text-gray-700">User</TableHead>
              <TableHead className="font-semibold text-gray-700">Links Created</TableHead>
              <TableHead className="font-semibold text-gray-700">Success Rate</TableHead>
              <TableHead className="font-semibold text-gray-700">Total Revenue</TableHead>
              <TableHead className="font-semibold text-gray-700">Avg Order Value</TableHead>
              <TableHead className="font-semibold text-gray-700">Performance</TableHead>
              <TableHead className="font-semibold text-gray-700">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userStats.map((user) => (
              <TableRow key={user.userId} className="border-gray-100 hover:bg-gray-50">
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{user.userName}</div>
                    <div className="text-gray-500 text-sm">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">{user.totalLinks}</div>
                    <div className="text-gray-500 text-sm">
                      {user.successfulOrders} successful, {user.failedOrders} failed
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{user.successRate}%</span>
                    </div>
                    <Progress value={user.successRate} className="h-2" />
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{formatCurrency(user.totalRevenue)}</TableCell>
                <TableCell className="font-medium text-gray-900">{formatCurrency(user.avgOrderValue)}</TableCell>
                <TableCell>{getSuccessRateBadge(user.successRate)}</TableCell>
                <TableCell className="text-gray-500 text-sm">{user.lastActive}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
