import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { CreditCard, ShoppingCart, TrendingUp, Plus, Eye } from "lucide-react"

// Mock data for merchant dashboard
const mockMerchantStats = {
  totalLinks: 45,
  activeOrders: 8,
  completedOrders: 37,
  totalRevenue: 125000,
  successRate: 93.3,
  recentOrders: [
    { id: "ORD-001", amount: 1500, status: "completed", createdAt: "2 hours ago" },
    { id: "ORD-002", amount: 2500, status: "pending", createdAt: "4 hours ago" },
    { id: "ORD-003", amount: 750, status: "pending-verification", createdAt: "6 hours ago" },
  ],
}

function MerchantStatsCards() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payment Links</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockMerchantStats.totalLinks}</div>
          <p className="text-xs text-muted-foreground">Total links created</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockMerchantStats.activeOrders}</div>
          <p className="text-xs text-muted-foreground">Pending payment</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(mockMerchantStats.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">From completed orders</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mockMerchantStats.successRate}%</div>
          <p className="text-xs text-muted-foreground">Payment completion rate</p>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Button className="h-20 flex-col gap-2">
            <Plus className="h-6 w-6" />
            Create Payment Link
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
            <Eye className="h-6 w-6" />
            View All Orders
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentOrders() {
  const getStatusBadge = (status: string) => {
    const statusColors = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-blue-100 text-blue-800",
      "pending-verification": "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
    }

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.pending}`}
      >
        {status.replace("-", " ")}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Your latest payment orders</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockMerchantStats.recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">{order.id}</p>
                <p className="text-sm text-muted-foreground">{order.createdAt}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">{formatCurrency(order.amount)}</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full bg-transparent">
            View All Orders
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function MerchantDashboard() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const userRole = sessionClaims?.metadata?.role as string
  const userName = sessionClaims?.firstName || "User"

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {userName}!</h1>
          <p className="text-muted-foreground capitalize">{userRole} Dashboard</p>
        </div>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<div>Loading stats...</div>}>
          <MerchantStatsCards />
        </Suspense>

        <div className="grid gap-6 md:grid-cols-2">
          <QuickActions />
          <RecentOrders />
        </div>
      </div>
    </div>
  )
}
