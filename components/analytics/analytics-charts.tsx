'use client';

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
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Order Trends</h3>
        <p className="text-sm text-gray-600">Monthly order volume and revenue trends</p>
      </div>
      <ChartContainer
        config={{
          orders: {
            label: 'Orders',
            color: '#3b82f6',
          },
          revenue: {
            label: 'Revenue (₹)',
            color: '#22c55e',
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={orderTrendsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="orders"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Orders"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="#22c55e"
              strokeWidth={3}
              name="Revenue (₹)"
              dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#22c55e' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

export function StatusDistributionChart() {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Order Status Distribution</h3>
        <p className="text-sm text-gray-600">Breakdown of orders by current status</p>
      </div>
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
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {statusDistributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percentage = ((data.value / statusDistributionData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1);
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm text-gray-600">{data.value} orders ({percentage}%)</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry) => (
                <span style={{ color: entry.color }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

export function UserPerformanceChart() {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">User Performance</h3>
        <p className="text-sm text-gray-600">Success rates and link generation statistics by user</p>
      </div>
      <ChartContainer
        config={{
          totalLinks: {
            label: 'Total Links',
            color: '#3b82f6',
          },
          successfulOrders: {
            label: 'Successful Orders',
            color: '#22c55e',
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={userPerformanceData} margin={{ left: 20, right: 20, bottom: 40, top: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="user"
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={11}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium mb-2">{label}</p>
                      {payload.map((entry, index) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: {entry.value}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar
              dataKey="totalLinks"
              fill="#3b82f6"
              name="Total Links"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="successfulOrders"
              fill="#22c55e"
              name="Successful Orders"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

export function HourlyActivityChart() {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Hourly Activity</h3>
        <p className="text-sm text-gray-600">Order distribution throughout the day</p>
      </div>
      <ChartContainer
        config={{
          orders: {
            label: 'Orders',
            color: '#f97316',
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourlyActivityData} margin={{ left: 20, right: 20, bottom: 20, top: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium">{label}:00</p>
                      <p className="text-sm text-orange-600">{payload[0].value} orders</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="orders"
              fill="#f97316"
              name="Orders"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// Export combined analytics charts component
export function AnalyticsCharts() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <OrderTrendsChart />
      <StatusDistributionChart />
      <UserPerformanceChart />
      <HourlyActivityChart />
    </div>
  );
}
