import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import {
  OrderTrendsChart,
  StatusDistributionChart,
  UserPerformanceChart,
  HourlyActivityChart,
} from '@/components/analytics/analytics-charts';
import { UserStatsTable } from '@/components/analytics/user-stats-table';
import { TrendingUp, Users, DollarSign, Activity, BarChart3, PieChart, LineChart } from 'lucide-react';

// Mock summary stats
const summaryStats = {
  totalRevenue: 613000,
  revenueGrowth: 15.2,
  totalUsers: 156,
  userGrowth: 12.0,
  avgSuccessRate: 90.7,
  successRateChange: 2.1,
  totalTransactions: 1292,
  transactionGrowth: 8.5,
};

function SummaryCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-blue-700">Total Revenue</CardTitle>
          <div className="rounded-full bg-blue-500 p-2">
            <DollarSign className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-900">{formatCurrency(summaryStats.totalRevenue)}</div>
          <p className="text-blue-600 text-sm mt-2">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              +{summaryStats.revenueGrowth}%
            </span>
            <span className="ml-2">from last month</span>
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-green-700">Active Users</CardTitle>
          <div className="rounded-full bg-green-500 p-2">
            <Users className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-900">{summaryStats.totalUsers}</div>
          <p className="text-green-600 text-sm mt-2">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              +{summaryStats.userGrowth}%
            </span>
            <span className="ml-2">from last month</span>
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-purple-700">Avg Success Rate</CardTitle>
          <div className="rounded-full bg-purple-500 p-2">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-900">{summaryStats.avgSuccessRate}%</div>
          <p className="text-purple-600 text-sm mt-2">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              +{summaryStats.successRateChange}%
            </span>
            <span className="ml-2">from last month</span>
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-orange-700">Total Transactions</CardTitle>
          <div className="rounded-full bg-orange-500 p-2">
            <Activity className="h-4 w-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-900">{summaryStats.totalTransactions}</div>
          <p className="text-orange-600 text-sm mt-2">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              +{summaryStats.transactionGrowth}%
            </span>
            <span className="ml-2">from last month</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      {/* Content */}
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights and performance metrics</p>
        </div>

        {/* Summary Cards */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-blue-500 p-2">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Key Performance Metrics</h2>
          </div>
          <SummaryCards />
        </div>

        {/* Charts Section 1 */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-blue-500 p-2">
              <LineChart className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Trends & Distribution</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <OrderTrendsChart />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <StatusDistributionChart />
            </div>
          </div>
        </div>

        {/* Charts Section 2 */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-green-500 p-2">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Performance & Activity</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <UserPerformanceChart />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <HourlyActivityChart />
            </div>
          </div>
        </div>

        {/* User Stats Table */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-purple-500 p-2">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Detailed User Statistics</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <UserStatsTable />
          </div>
        </div>
      </div>
    </div>
  );
}
