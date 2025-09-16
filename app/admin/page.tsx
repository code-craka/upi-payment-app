import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, ShoppingCart, TrendingUp, DollarSign, Activity, Clock, CheckCircle, XCircle } from "lucide-react"

// Mock data - replace with actual API calls
const mockStats = {
  totalUsers: 156,
  totalOrders: 1247,
  totalRevenue: 89650,
  successRate: 94.2,
  pendingOrders: 23,
  completedOrders: 1156,
  failedOrders: 68,
  recentActivity: [
    { id: 1, action: "New order created", user: "John Doe", time: "2 minutes ago", type: "order" },
    { id: 2, action: "User registered", user: "Jane Smith", time: "5 minutes ago", type: "user" },
    { id: 3, action: "Payment completed", user: "Mike Johnson", time: "8 minutes ago", type: "payment" },
    { id: 4, action: "Order expired", user: "Sarah Wilson", time: "12 minutes ago", type: "expired" },
  ],
}

function StatsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">+12% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.totalOrders}</div>
          <p className="text-xs text-muted-foreground">+8% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{mockStats.totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">+15% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockStats.successRate}%</div>
          <p className="text-xs text-muted-foreground">+2.1% from last month</p>
        </CardContent>
      </Card>
    </div>
  )
}

function OrderStatusCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{mockStats.pendingOrders}</div>
          <p className="text-xs text-muted-foreground">Awaiting verification</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{mockStats.completedOrders}</div>
          <p className="text-xs text-muted-foreground">Successfully processed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Orders</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{mockStats.failedOrders}</div>
          <p className="text-xs text-muted-foreground">Failed or expired</p>
        </CardContent>
      </Card>
    </div>
  )
}

function RecentActivity() {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingCart className="h-4 w-4 text-blue-600" />
      case "user":
        return <Users className="h-4 w-4 text-green-600" />
      case "payment":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "expired":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getActivityBadge = (type: string) => {
    switch (type) {
      case "order":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            Order
          </Badge>
        )
      case "user":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            User
          </Badge>
        )
      case "payment":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            Payment
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            Expired
          </Badge>
        )
      default:
        return <Badge variant="outline">Activity</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest system activities and events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockStats.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg border">
              {getActivityIcon(activity.type)}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{activity.action}</p>
                <p className="text-sm text-muted-foreground">by {activity.user}</p>
              </div>
              <div className="flex items-center gap-2">
                {getActivityBadge(activity.type)}
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full bg-transparent">
            View All Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your UPI payment system.
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <StatsCards />
      </Suspense>

      <Suspense fallback={<div>Loading order status...</div>}>
        <OrderStatusCards />
      </Suspense>

      <Suspense fallback={<div>Loading recent activity...</div>}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}
