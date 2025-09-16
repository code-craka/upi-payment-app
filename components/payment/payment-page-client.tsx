"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UpiButtons } from "./upi-buttons"
import { QRCodeDisplay } from "./qr-code-display"
import { UtrForm } from "./utr-form"
import { CountdownTimer } from "./countdown-timer"
import { Clock, CheckCircle, XCircle } from "lucide-react"
import type { Order } from "@/lib/types"

interface PaymentPageClientProps {
  order: Order
}

export function PaymentPageClient({ order }: PaymentPageClientProps) {
  const [currentOrder, setCurrentOrder] = useState(order)
  const [showUtrForm, setShowUtrForm] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Payment Pending
          </Badge>
        )
      case "pending-verification":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Verifying Payment
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Payment Successful
          </Badge>
        )
      case "expired":
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Payment {status === "expired" ? "Expired" : "Failed"}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleUtrSubmit = async (utr: string) => {
    try {
      // API call to submit UTR
      const response = await fetch(`/api/orders/${currentOrder.orderId}/utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr }),
      })

      if (response.ok) {
        setCurrentOrder((prev) => ({ ...prev, status: "pending-verification", utr }))
        setShowUtrForm(false)
      }
    } catch (error) {
      console.error("Error submitting UTR:", error)
    }
  }

  const handleExpiry = () => {
    setCurrentOrder((prev) => ({ ...prev, status: "expired" }))
  }

  if (currentOrder.status === "completed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800">Payment Successful!</CardTitle>
            <CardDescription>Your payment has been completed successfully</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(currentOrder.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To</p>
              <p className="font-medium">{currentOrder.merchantName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transaction ID</p>
              <p className="font-mono text-sm">{currentOrder.orderId}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentOrder.status === "expired" || currentOrder.status === "failed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-red-800">
              Payment {currentOrder.status === "expired" ? "Expired" : "Failed"}
            </CardTitle>
            <CardDescription>
              {currentOrder.status === "expired"
                ? "This payment link has expired. Please request a new payment link."
                : "There was an issue with your payment. Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.close()}>
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Complete Your Payment</CardTitle>
          <CardDescription>
            Pay {formatCurrency(currentOrder.amount)} to {currentOrder.merchantName}
          </CardDescription>
          <div className="flex justify-center mt-2">{getStatusBadge(currentOrder.status)}</div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentOrder.status === "pending" && (
            <>
              <CountdownTimer expiresAt={currentOrder.expiresAt} onExpiry={handleExpiry} />

              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Scan QR Code or use UPI apps</p>
                  <QRCodeDisplay
                    upiString={currentOrder.upiDeepLink}
                    amount={currentOrder.amount}
                    merchantName={currentOrder.merchantName}
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Or pay using your favorite UPI app</p>
                  <UpiButtons upiDeepLink={currentOrder.upiDeepLink} onPaymentInitiated={() => setShowUtrForm(true)} />
                </div>
              </div>
            </>
          )}

          {(showUtrForm || currentOrder.status === "pending-verification") && (
            <UtrForm
              onSubmit={handleUtrSubmit}
              isSubmitted={currentOrder.status === "pending-verification"}
              submittedUtr={currentOrder.utr}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
