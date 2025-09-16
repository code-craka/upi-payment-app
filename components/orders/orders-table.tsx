"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Search, Eye, CheckCircle, XCircle, Clock, Copy } from "lucide-react"
import type { OrderTable } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// Mock data - replace with actual API calls
const mockOrders: OrderTable[] = [
  {
    _id: "1",
    id: "1",
    orderId: "ORD-2024-001",
    amount: 1500,
    description: "Payment to John's Store",
    upiId: "john@paytm",
    merchantName: "John's Store",
    vpa: "john@paytm",
    status: "pending-verification",
    utr: "123456789012",
    createdBy: "user1",
    createdAt: new Date("2024-01-20T10:30:00"),
    updatedAt: new Date("2024-01-20T10:30:00"),
    expiresAt: new Date("2024-01-20T10:39:00"),
    paymentPageUrl: "/pay/ORD-2024-001",
    upiDeepLink: "upi://pay?pa=john@paytm&pn=John's Store&am=1500",
  },
  {
    _id: "2",
    id: "2",
    orderId: "ORD-2024-002",
    amount: 2500,
    description: "Payment to Tech Solutions",
    upiId: "tech@gpay",
    merchantName: "Tech Solutions",
    vpa: "tech@gpay",
    status: "completed",
    utr: "987654321098",
    createdBy: "user2",
    createdAt: new Date("2024-01-20T09:15:00"),
    updatedAt: new Date("2024-01-20T09:15:00"),
    expiresAt: new Date("2024-01-20T09:24:00"),
    paymentPageUrl: "/pay/ORD-2024-002",
    upiDeepLink: "upi://pay?pa=tech@gpay&pn=Tech Solutions&am=2500",
  },
  {
    _id: "3",
    id: "3",
    orderId: "ORD-2024-003",
    amount: 750,
    description: "Payment to Coffee Shop",
    upiId: "coffee@phonepe",
    merchantName: "Coffee Shop",
    vpa: "coffee@phonepe",
    status: "expired",
    createdBy: "user3",
    createdAt: new Date("2024-01-20T08:00:00"),
    updatedAt: new Date("2024-01-20T08:00:00"),
    expiresAt: new Date("2024-01-20T08:09:00"),
    paymentPageUrl: "/pay/ORD-2024-003",
    upiDeepLink: "upi://pay?pa=coffee@phonepe&pn=Coffee Shop&am=750",
  },
  {
    _id: "4",
    id: "4",
    orderId: "ORD-2024-004",
    amount: 3200,
    description: "Payment to Electronics Hub",
    upiId: "electronics@bhim",
    merchantName: "Electronics Hub",
    vpa: "electronics@bhim",
    status: "pending",
    createdBy: "user1",
    createdAt: new Date("2024-01-20T11:45:00"),
    updatedAt: new Date("2024-01-20T11:45:00"),
    expiresAt: new Date("2024-01-20T11:54:00"),
    paymentPageUrl: "/pay/ORD-2024-004",
    upiDeepLink: "upi://pay?pa=electronics@bhim&pn=Electronics Hub&am=3200",
  },
]

interface OrdersTableProps {
  showAllOrders?: boolean
  userId?: string
}

export function OrdersTable({ showAllOrders = true, userId }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [orders, setOrders] = useState<OrderTable[]>(mockOrders)
  const { toast } = useToast()

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.merchantName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.vpa || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesUser = showAllOrders || order.createdBy === userId

    return matchesSearch && matchesStatus && matchesUser
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            Pending
          </Badge>
        )
      case "pending-verification":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200">
            Pending Verification
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            Completed
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            Expired
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      setOrders(orders.map((order) => (order._id === orderId || order.id === orderId ? { ...order, status: newStatus as any } : order)))

      toast({
        title: "Order status updated",
        description: `Order ${orderId} has been marked as ${newStatus}.`,
      })
    } catch (error) {
      toast({
        title: "Error updating order",
        description: "There was a problem updating the order status.",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied to your clipboard.`,
    })
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Orders Management</CardTitle>
            <CardDescription>
              {showAllOrders ? "View and manage all orders in the system" : "Your payment orders"}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>UPI ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>UTR</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order._id || order.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {order.orderId}
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(order.orderId, "Order ID")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{order.merchantName}</TableCell>
                <TableCell className="font-medium">{formatCurrency(order.amount)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {order.vpa}
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(order.vpa || "", "UPI ID")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  {order.utr ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{order.utr}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(order.utr!, "UTR")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{order.createdAt.toLocaleDateString()}</div>
                    <div className="text-muted-foreground">{order.createdAt.toLocaleTimeString()}</div>
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
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => window.open(order.paymentPageUrl, "_blank")}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Payment Page
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {showAllOrders && (
                        <>
                          <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleStatusUpdate(order._id || order.id, "completed")}
                            disabled={order.status === "completed"}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusUpdate(order._id || order.id, "failed")}
                            disabled={order.status === "failed"}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Mark Failed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusUpdate(order._id || order.id, "pending-verification")}
                            disabled={order.status === "pending-verification"}
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
            ))}
          </TableBody>
        </Table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No orders found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
