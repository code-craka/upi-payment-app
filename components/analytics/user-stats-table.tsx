"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"

// Mock data for user statistics
const userStats = [
  {
    userId: "1",
    userName: "John Merchant",
    email: "john@example.com",
    totalLinks: 45,
    successfulOrders: 42,
    failedOrders: 3,
    totalRevenue: 125000,
    successRate: 93.3,
    avgOrderValue: 2976,
    lastActive: "2 hours ago",
  },
  {
    userId: "2",
    userName: "Jane Store",
    email: "jane@example.com",
    totalLinks: 38,
    successfulOrders: 35,
    failedOrders: 3,
    totalRevenue: 98000,
    successRate: 92.1,
    avgOrderValue: 2800,
    lastActive: "1 day ago",
  },
  {
    userId: "3",
    userName: "Mike Tech Solutions",
    email: "mike@example.com",
    totalLinks: 52,
    successfulOrders: 47,
    failedOrders: 5,
    totalRevenue: 156000,
    successRate: 90.4,
    avgOrderValue: 3319,
    lastActive: "3 hours ago",
  },
  {
    userId: "4",
    userName: "Sarah Coffee Shop",
    email: "sarah@example.com",
    totalLinks: 29,
    successfulOrders: 26,
    failedOrders: 3,
    totalRevenue: 45000,
    successRate: 89.7,
    avgOrderValue: 1731,
    lastActive: "5 hours ago",
  },
  {
    userId: "5",
    userName: "Tom Electronics",
    email: "tom@example.com",
    totalLinks: 41,
    successfulOrders: 36,
    failedOrders: 5,
    totalRevenue: 189000,
    successRate: 87.8,
    avgOrderValue: 5250,
    lastActive: "1 hour ago",
  },
]

export function UserStatsTable() {
  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (rate >= 90) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>
    if (rate >= 80) return <Badge className="bg-yellow-100 text-yellow-800">Average</Badge>
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Performance Analytics</CardTitle>
        <CardDescription>Detailed statistics for each user including success rates and revenue metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Links Created</TableHead>
              <TableHead>Success Rate</TableHead>
              <TableHead>Total Revenue</TableHead>
              <TableHead>Avg Order Value</TableHead>
              <TableHead>Performance</TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userStats.map((user) => (
              <TableRow key={user.userId}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{user.userName}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{user.totalLinks}</div>
                    <div className="text-sm text-muted-foreground">
                      {user.successfulOrders} successful, {user.failedOrders} failed
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{user.successRate}%</span>
                    </div>
                    <Progress value={user.successRate} className="h-2" />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(user.totalRevenue)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(user.avgOrderValue)}</TableCell>
                <TableCell>{getSuccessRateBadge(user.successRate)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.lastActive}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
