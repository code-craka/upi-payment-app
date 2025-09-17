'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface OrderData {
  orderId: string
  amount: number
  description: string
  status: string
  createdAt: string
  expiresAt: string
  utrNumber?: string
  paymentUrl: string
  isExpired: boolean
}

interface CreateOrderResult {
  success: boolean
  data: {
    orderId: string
    amount: number
    description: string
    status: string
    expiresAt: string
    paymentUrl: string
    timeRemaining: number
  }
  message: string
}

export default function TestPaymentFlow() {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CreateOrderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          description: formData.description,
          customerName: formData.customerName || undefined,
          customerEmail: formData.customerEmail || undefined,
          customerPhone: formData.customerPhone || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        // Clear form
        setFormData({
          amount: '',
          description: '',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
        })
      } else {
        setError(data.error || 'Failed to create order')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    setLoadingOrders(true)
    try {
      const response = await fetch('/api/test/orders?limit=10')
      const data = await response.json()
      
      if (response.ok) {
        setOrders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">UPI Payment System Test</h1>
        <p className="text-muted-foreground">Test the complete payment flow</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Order Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Test Order</CardTitle>
            <CardDescription>
              Create a new payment order to test the flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  max="100000"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerName">Customer Name (Optional)</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="customerEmail">Customer Email (Optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">Customer Phone (Optional)</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating Order...' : 'Create Order'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              View and test recent payment orders
            </CardDescription>
            <Button onClick={loadOrders} disabled={loadingOrders} size="sm">
              {loadingOrders ? 'Loading...' : 'Refresh Orders'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No orders found. Create one above to get started.
                </p>
              ) : (
                orders.map((order) => (
                  <div key={order.orderId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm">{order.orderId}</p>
                        <p className="text-sm text-muted-foreground">{order.description}</p>
                      </div>
                      <Badge variant={order.status === 'pending' ? 'secondary' : 
                                   order.status === 'completed' ? 'default' : 'destructive'}>
                        {order.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold">₹{order.amount}</span>
                      {order.isExpired && (
                        <Badge variant="destructive" className="text-xs">Expired</Badge>
                      )}
                    </div>
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => window.open(order.paymentUrl, '_blank')}
                      >
                        Open Payment Page
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Order Created Successfully!</strong></p>
              <p>Order ID: <code className="bg-muted px-1 rounded">{result.data.orderId}</code></p>
              <p>Amount: ₹{result.data.amount}</p>
              <div className="pt-2">
                <Button 
                  onClick={() => window.open(result.data.paymentUrl, '_blank')}
                  size="sm"
                >
                  Open Payment Page
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>1.</strong> Fill out the form above and click "Create Order"</p>
          <p><strong>2.</strong> Click "Open Payment Page" to go to the payment interface</p>
          <p><strong>3.</strong> Use any UPI app to scan the QR code (or click UPI buttons)</p>
          <p><strong>4.</strong> Complete the payment and note the UTR number</p>
          <p><strong>5.</strong> Return to the payment page and submit the UTR for verification</p>
          <p><strong>6.</strong> You'll be redirected to the success page with receipt option</p>
          
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="font-semibold mb-1">Test UTR Numbers:</p>
            <p className="font-mono">12345678901234567890 (Valid format)</p>
            <p className="font-mono">98765432109876543210 (Alternative)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}