'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, IndianRupee, ArrowRight, User, Mail, Phone } from 'lucide-react'

interface PaymentLinkData {
  id: string
  linkId: string
  title: string
  description?: string
  amount?: number
  allowCustomAmount: boolean
  minAmount?: number
  maxAmount?: number
  upiId: string
  merchantName: string
  isActive: boolean
  expiresAt?: string
  usageLimit?: number
  usageCount: number
  settings: {
    collectCustomerInfo: boolean
    sendEmailReceipt: boolean
    redirectUrl?: string
    webhookUrl?: string
  }
  createdAt: string
  updatedAt: string
  createdBy: string
}

interface PaymentLinkPageClientProps {
  paymentLink: PaymentLinkData
}

export function PaymentLinkPageClient({ paymentLink }: PaymentLinkPageClientProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    amount: paymentLink.allowCustomAmount ? '' : paymentLink.amount?.toString() || '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate amount
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid amount')
        return
      }

      if (paymentLink.minAmount && amount < paymentLink.minAmount) {
        setError(`Amount must be at least ₹${paymentLink.minAmount}`)
        return
      }

      if (paymentLink.maxAmount && amount > paymentLink.maxAmount) {
        setError(`Amount cannot exceed ₹${paymentLink.maxAmount}`)
        return
      }

      // Create order from payment link
      const response = await fetch('/api/payment-links/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId: paymentLink.linkId,
          amount: amount,
          customerName: formData.customerName || undefined,
          customerEmail: formData.customerEmail || undefined,
          customerPhone: formData.customerPhone || undefined,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Redirect to payment page
        router.push(`/pay/${result.data.orderId}`)
      } else {
        setError(result.error || 'Failed to create payment order')
      }
    } catch (err) {
      setError('Network error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-800">
            {paymentLink.title}
          </CardTitle>
          {paymentLink.description && (
            <CardDescription className="text-gray-600 mt-2">
              {paymentLink.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Merchant Info */}
          <div className="text-center">
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {paymentLink.merchantName}
            </Badge>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Section */}
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                {paymentLink.allowCustomAmount ? 'Enter Amount' : 'Amount'}
              </Label>

              {paymentLink.allowCustomAmount ? (
                <div className="space-y-2">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-12 text-lg font-semibold text-center"
                    min={paymentLink.minAmount || 1}
                    max={paymentLink.maxAmount}
                    step="0.01"
                    required
                  />
                  <div className="text-xs text-gray-500 text-center">
                    {paymentLink.minAmount && paymentLink.maxAmount
                      ? `Range: ₹${paymentLink.minAmount} - ₹${paymentLink.maxAmount}`
                      : paymentLink.minAmount
                      ? `Minimum: ₹${paymentLink.minAmount}`
                      : paymentLink.maxAmount
                      ? `Maximum: ₹${paymentLink.maxAmount}`
                      : 'Enter any amount'}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    ₹{paymentLink.amount}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Information */}
            {paymentLink.settings.collectCustomerInfo && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customerName" className="text-sm text-gray-600">
                        Full Name
                      </Label>
                      <Input
                        id="customerName"
                        placeholder="Enter your full name"
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        className="h-11"
                      />
                    </div>

                    <div>
                      <Label htmlFor="customerEmail" className="text-sm text-gray-600 flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        Email
                      </Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.customerEmail}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        className="h-11"
                      />
                    </div>

                    <div>
                      <Label htmlFor="customerPhone" className="text-sm text-gray-600 flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        Phone Number
                      </Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        placeholder="Enter your phone number"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Proceed to Payment
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          {/* Footer Info */}
          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>Secure payment powered by UPI</p>
            {paymentLink.usageLimit && (
              <p>
                Used {paymentLink.usageCount} of {paymentLink.usageLimit} times
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}