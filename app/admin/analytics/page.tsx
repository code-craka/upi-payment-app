import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import {
  OrderTrendsChart,
  StatusDistributionChart,
  UserPerformanceChart,
  HourlyActivityChart,
} from "@/components/analytics/analytics-charts"
import { UserStatsTable } from "@/components/analytics/user-stats-table"
import { TrendingUp, Users, DollarSign, Activity } from "lucide-react"

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
}

function SummaryCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summaryStats.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+{summaryStats.revenueGrowth}%</span> from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryStats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+{summaryStats.userGrowth}%</span> from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryStats.avgSuccessRate}%</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+{summaryStats.successRateChange}%</span> from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryStats.totalTransactions}</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+{summaryStats.transactionGrowth}%</span> from last month
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      </div>

      <div className="space-y-6">
        <SummaryCards />

        <div className="grid gap-6 md:grid-cols-2">
          <OrderTrendsChart />
          <StatusDistributionChart />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <UserPerformanceChart />
          <HourlyActivityChart />
        </div>

        <UserStatsTable />
      </div>
    </div>
  )
}
