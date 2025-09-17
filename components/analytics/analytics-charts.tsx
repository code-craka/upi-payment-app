'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Mock data for charts
const orderTrendsData = [
  { month: 'Jan', orders: 65, revenue: 45000 },
  { month: 'Feb', orders: 78, revenue: 52000 },
  { month: 'Mar', orders: 90, revenue: 61000 },
  { month: 'Apr', orders: 81, revenue: 58000 },
  { month: 'May', orders: 95, revenue: 67000 },
  { month: 'Jun', orders: 110, revenue: 78000 },
];

const statusDistributionData = [
  { name: 'Completed', value: 1156, color: '#22c55e' },
  { name: 'Pending', value: 23, color: '#3b82f6' },
  { name: 'Failed', value: 68, color: '#ef4444' },
  { name: 'Expired', value: 45, color: '#f59e0b' },
];

const userPerformanceData = [
  { user: 'John Merchant', totalLinks: 45, successfulOrders: 42, successRate: 93.3 },
  { user: 'Jane Store', totalLinks: 38, successfulOrders: 35, successRate: 92.1 },
  { user: 'Mike Tech', totalLinks: 52, successfulOrders: 47, successRate: 90.4 },
  { user: 'Sarah Shop', totalLinks: 29, successfulOrders: 26, successRate: 89.7 },
  { user: 'Tom Electronics', totalLinks: 41, successfulOrders: 36, successRate: 87.8 },
];

const hourlyActivityData = [
  { hour: '00', orders: 2 },
  { hour: '01', orders: 1 },
  { hour: '02', orders: 0 },
  { hour: '03', orders: 1 },
  { hour: '04', orders: 0 },
  { hour: '05', orders: 2 },
  { hour: '06', orders: 5 },
  { hour: '07', orders: 8 },
  { hour: '08', orders: 12 },
  { hour: '09', orders: 18 },
  { hour: '10', orders: 25 },
  { hour: '11', orders: 32 },
  { hour: '12', orders: 28 },
  { hour: '13', orders: 35 },
  { hour: '14', orders: 42 },
  { hour: '15', orders: 38 },
  { hour: '16', orders: 45 },
  { hour: '17', orders: 40 },
  { hour: '18', orders: 35 },
  { hour: '19', orders: 28 },
  { hour: '20', orders: 22 },
  { hour: '21', orders: 18 },
  { hour: '22', orders: 12 },
  { hour: '23', orders: 8 },
];

export function OrderTrendsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Trends</CardTitle>
        <CardDescription>Monthly order volume and revenue trends</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            orders: {
              label: 'Orders',
              color: 'hsl(var(--chart-1))',
            },
            revenue: {
              label: 'Revenue (₹)',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={orderTrendsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="orders"
                stroke="var(--color-orders)"
                strokeWidth={2}
                name="Orders"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                name="Revenue (₹)"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function StatusDistributionChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Status Distribution</CardTitle>
        <CardDescription>Breakdown of orders by current status</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            completed: {
              label: 'Completed',
              color: '#22c55e',
            },
            pending: {
              label: 'Pending',
              color: '#3b82f6',
            },
            failed: {
              label: 'Failed',
              color: '#ef4444',
            },
            expired: {
              label: 'Expired',
              color: '#f59e0b',
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function UserPerformanceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Performance</CardTitle>
        <CardDescription>Success rates and link generation statistics by user</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            totalLinks: {
              label: 'Total Links',
              color: 'hsl(var(--chart-1))',
            },
            successfulOrders: {
              label: 'Successful Orders',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userPerformanceData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="user" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar
                dataKey="totalLinks"
                fill="var(--color-totalLinks)"
                name="Total Links"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="successfulOrders"
                fill="var(--color-successfulOrders)"
                name="Successful Orders"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function HourlyActivityChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hourly Activity</CardTitle>
        <CardDescription>Order distribution throughout the day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            orders: {
              label: 'Orders',
              color: 'hsl(var(--chart-3))',
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="orders"
                fill="var(--color-orders)"
                name="Orders"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
