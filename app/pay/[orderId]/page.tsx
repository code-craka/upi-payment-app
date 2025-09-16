import { PaymentPageClient } from "@/components/payment/payment-page-client"
import { notFound } from "next/navigation"

interface PaymentPageProps {
  params: {
    orderId: string
  }
}

// Mock function - replace with actual API call
async function getOrder(orderId: string) {
  // Simulate API call
  const mockOrder = {
    _id: "1",
    orderId: orderId,
    amount: 1500,
    merchantName: "John's Store",
    vpa: "john@paytm",
    status: "pending" as const,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 9 * 60 * 1000), // 9 minutes from now
    paymentPageUrl: `/pay/${orderId}`,
    upiDeepLink: `upi://pay?pa=john@paytm&pn=John's Store&am=1500&tr=${orderId}`,
  }

  return mockOrder
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  const order = await getOrder(params.orderId)

  if (!order) {
    notFound()
  }

  return <PaymentPageClient order={order} />
}
