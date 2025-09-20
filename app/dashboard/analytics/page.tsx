import { getSafeUser } from '@/lib/auth/safe-auth';
import { redirect } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsCharts } from '@/components/analytics/analytics-charts';
import { StatsCards } from '@/components/shared/stats-cards';
import { formatCurrency } from '@/lib/utils';

// Mock analytics data for merchants
const mockAnalyticsData = {
  stats: {
    totalRevenue: 125000,
    totalOrders: 234,
    successRate: 93.3,
    avgOrderValue: 534.19,
    revenueGrowth: 12.5,
    orderGrowth: 8.2,
    successRateChange: 2.1,
    avgOrderValueChange: -3.2,
  },
  monthlyRevenue: [
    { month: 'Jan', revenue: 15000, orders: 45 },
    { month: 'Feb', revenue: 18000, orders: 52 },
    { month: 'Mar', revenue: 22000, orders: 48 },
    { month: 'Apr', revenue: 25000, orders: 61 },
    { month: 'May', revenue: 28000, orders: 58 },
    { month: 'Jun', revenue: 17000, orders: 34 },
  ],
  topProducts: [
    { name: 'Premium Subscription', revenue: 45000, orders: 75 },
    { name: 'Basic Plan', revenue: 32000, orders: 89 },
    { name: 'Enterprise License', revenue: 28000, orders: 14 },
    { name: 'Add-on Services', revenue: 20000, orders: 56 },
  ],
  paymentMethods: [
    { method: 'UPI', percentage: 65, count: 152 },
    { method: 'Card', percentage: 25, count: 59 },
    { method: 'Net Banking', percentage: 10, count: 23 },
  ],
};

function MerchantAnalyticsCards() {
  const analyticsMetrics = [
    {
      id: 'total-revenue',
      title: 'Total Revenue',
      value: formatCurrency(mockAnalyticsData.stats.totalRevenue),
      description: 'All-time revenue',
      icon: 'TrendingUp',
      trend: `+${mockAnalyticsData.stats.revenueGrowth}% this month`,
    },
    {
      id: 'total-orders',
      title: 'Total Orders',
      value: mockAnalyticsData.stats.totalOrders,
      description: 'Orders processed',
      icon: 'ShoppingCart',
      trend: `+${mockAnalyticsData.stats.orderGrowth}% this month`,
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: `${mockAnalyticsData.stats.successRate}%`,
      description: 'Payment success rate',
      icon: 'CheckCircle',
      trend: `+${mockAnalyticsData.stats.successRateChange}% this month`,
    },
    {
      id: 'avg-order-value',
      title: 'Avg Order Value',
      value: formatCurrency(mockAnalyticsData.stats.avgOrderValue),
      description: 'Average per order',
      icon: 'DollarSign',
      trend: `${mockAnalyticsData.stats.avgOrderValueChange}% this month`,
    },
  ];

  return <StatsCards metrics={analyticsMetrics} />;
}

function TopProductsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Products</CardTitle>
        <CardDescription>Best selling products by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockAnalyticsData.topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-muted-foreground text-sm">{product.orders} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(product.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentMethodsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Distribution of payment methods used</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockAnalyticsData.paymentMethods.map((method) => (
            <div key={method.method} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{method.method}</span>
                <span className="text-muted-foreground">
                  {method.percentage}% ({method.count} orders)
                </span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${method.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function MerchantAnalyticsPage() {
  const user = await getSafeUser();

  if (!user) {
    redirect('/login');
  }

  // Only merchants and admins can access detailed analytics
  if (!['admin', 'merchant'].includes(user.role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track your payment performance and trends
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Key Metrics */}
        <MerchantAnalyticsCards />

        {/* Charts */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>Monthly revenue and order trends</CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsCharts data={mockAnalyticsData.monthlyRevenue} />
          </CardContent>
        </Card>

        {/* Additional Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <TopProductsCard />
          <PaymentMethodsCard />
        </div>
      </div>
    </div>
  );
}