"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Clock, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PaymentOrder } from "@/lib/types"

interface PaymentPageClientProps {
  order: PaymentOrder
}

export function PaymentPageClient({ order }: PaymentPageClientProps) {
  const [currentOrder, setCurrentOrder] = useState(order)
  const [selectedUpi, setSelectedUpi] = useState<string>("")
  const [utr, setUtr] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const { toast } = useToast()

  // Timer effect
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expiry = new Date(currentOrder.expiresAt).getTime()
      const difference = expiry - now
      return Math.max(0, difference)
    }

    const updateTimer = () => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)

      if (remaining === 0) {
        setCurrentOrder((prev) => ({ ...prev, status: "expired" }))
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [currentOrder.expiresAt])

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return {
      minutes: minutes.toString().padStart(2, "0"),
      seconds: seconds.toString().padStart(2, "0"),
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleUtrSubmit = async () => {
    if (!utr.trim()) {
      toast({
        title: "UTR required",
        description: "Please enter the UTR number",
        variant: "destructive",
      })
      return
    }

    if (utr.length !== 12) {
      toast({
        title: "Invalid UTR",
        description: "UTR number should be 12 digits",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/orders/${currentOrder.orderId}/utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr }),
      })

      if (response.ok) {
        setCurrentOrder((prev) => ({ ...prev, status: "pending-verification", utr }))
        toast({
          title: "UTR submitted",
          description: "Your payment is being verified",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit UTR",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaymentMethodClick = (method: string) => {
    setSelectedUpi(method)

    // Create UPI deep link
    const upiId = currentOrder.vpa || currentOrder.upiId || "Bzbx****@upi"
    const merchantName = currentOrder.merchantName || "Merchant"
    const amount = currentOrder.amount
    const orderId = currentOrder.orderId

    const deepLinks = {
      phonepe: `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      paytm: `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      gpay: `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      upi: `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
    }

    const deepLink = deepLinks[method as keyof typeof deepLinks]
    if (deepLink) {
      // Open the UPI app
      window.location.href = deepLink

      toast({
        title: "Opening UPI App",
        description: `Redirecting to ${method.charAt(0).toUpperCase() + method.slice(1)}...`,
      })
    }
  }

  if (currentOrder.status === "pending-verification") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-800">Payment Under Verification</CardTitle>
            <CardDescription>We&apos;re verifying your payment. This usually takes a few minutes.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Submitted UTR:</p>
              <p className="font-mono font-medium text-gray-800">{currentOrder.utr}</p>
            </div>
            <p className="text-xs text-gray-500">
              You can close this page. We&apos;ll notify you once the payment is confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentOrder.status === "completed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
              <p className="text-2xl font-bold">₹{currentOrder.amount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To</p>
              <p className="font-medium">{currentOrder.merchantName || "Merchant"}</p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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

  const time = formatTime(timeLeft)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        {/* Timer Section */}
        <div className="text-center py-6 px-4 sm:py-8">
          <h2 className="text-lg sm:text-xl font-medium text-gray-800 mb-4">Order will be closed in:</h2>
          <div className="flex justify-center items-center gap-2">
            <div className="bg-blue-500 text-white px-3 py-2 rounded-md font-bold text-xl sm:text-2xl min-w-[50px]">
              {time.minutes}
            </div>
            <div className="text-2xl font-bold text-gray-600">:</div>
            <div className="bg-blue-500 text-white px-3 py-2 rounded-md font-bold text-xl sm:text-2xl min-w-[50px]">
              {time.seconds}
            </div>
          </div>
        </div>

        {/* Amount Section */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-600 text-base font-medium">Amount</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800">₹ {currentOrder.amount}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(currentOrder.amount.toString(), "Amount")}
              className="bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 px-4 py-2 text-sm font-medium"
            >
              COPY
            </Button>
          </div>
        </div>

        {/* VPA/UPI Section */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <p className="text-gray-600 text-base font-medium">VPA/UPI</p>
              <p className="text-lg font-medium text-gray-800 truncate">
                {currentOrder.vpa || currentOrder.upiId || "Bzbx****@upi"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(currentOrder.vpa || currentOrder.upiId || "Bzbx****@upi", "VPA")}
              className="bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 px-4 py-2 text-sm font-medium ml-4"
            >
              COPY
            </Button>
          </div>
        </div>

        {/* Notice Section */}
        <div className="px-4 py-4">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4">
            <h3 className="text-red-600 font-semibold text-sm mb-2">Notice:</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                1. One UPI can only transfer money <span className="text-red-600 font-semibold">once</span>.
              </p>
              <p>
                2. Don&apos;t change the <span className="text-red-600 font-semibold">payment amount</span>. Otherwise,
                the order cannot be closed.
              </p>
            </div>
          </div>
        </div>

        {/* UPI Apps Selection */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PhonePe */}
            <label
              className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => handlePaymentMethodClick("phonepe")}
            >
              <input
                type="radio"
                name="upi"
                value="phonepe"
                checked={selectedUpi === "phonepe"}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 relative flex-shrink-0">
                  <Image src="/phonepe-logo.webp" alt="PhonePe" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-gray-800 font-medium">PhonePe</span>
              </div>
            </label>

            {/* Paytm */}
            <label
              className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => handlePaymentMethodClick("paytm")}
            >
              <input
                type="radio"
                name="upi"
                value="paytm"
                checked={selectedUpi === "paytm"}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 relative flex-shrink-0">
                  <Image src="/Paytm_logo.png" alt="Paytm" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-gray-800 font-medium">Paytm</span>
              </div>
            </label>

            {/* Google Pay */}
            <label
              className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => handlePaymentMethodClick("gpay")}
            >
              <input
                type="radio"
                name="upi"
                value="gpay"
                checked={selectedUpi === "gpay"}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 relative flex-shrink-0">
                  <Image src="/gpay-logo.png" alt="G Pay" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-gray-800 font-medium">G Pay</span>
              </div>
            </label>

            {/* UPI */}
            <label
              className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => handlePaymentMethodClick("upi")}
            >
              <input
                type="radio"
                name="upi"
                value="upi"
                checked={selectedUpi === "upi"}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 relative flex-shrink-0">
                  <Image src="/UPI_logo.svg.png" alt="UPI" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-gray-800 font-medium">UPI</span>
              </div>
            </label>
          </div>
        </div>

        {/* UTR Form */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-1 mb-4">
            <span className="text-blue-500 text-sm">↓</span>
            <span className="text-blue-500 text-sm font-medium">Fill the UTR numbers after you done payment</span>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Input UTR number"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              className="w-full h-12 text-base"
              maxLength={12}
            />

            <Button
              onClick={() => {
                handleUtrSubmit().catch(console.error)
              }}
              disabled={isSubmitting}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-base font-medium transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Submit UTR"}
            </Button>
          </div>
        </div>

        {/* Bottom UPI Logo and Support Info */}
        <div className="px-4 py-6 text-center border-t border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4">
            <Image src="/UPI_logo.svg.png" alt="UPI" width={64} height={64} className="object-contain" />
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed px-2">
              Dear customers: Please give priority to this channel to recharge! Support UPI account withdrawal! ICICI
              Bank guarantee! Safe and reliable! If you have any questions, please contact:
            </p>
            <p className="text-blue-500 text-sm font-medium break-all">hdfcbankComplaintacceptance@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
