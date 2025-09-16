import { PaymentPageClient } from "@/components/payment/payment-page-client"
import { notFound } from "next/navigation"

interface PaymentPageProps {
  params: Promise<{
    orderId: string
  }>
}

// Mock function - replace with actual API call
async function getOrder(orderId: string) {
  // Simulate API call
  const mockOrder = {
    _id: "1",
    orderId: orderId,
    amount: 5000,
    merchantName: "Merchant Store",
    vpa: "Bzbx****@upi",
    status: "pending" as const,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 6 * 60 * 1000 + 53 * 1000), // 6:53 from now to match image
    paymentPageUrl: `/pay/${orderId}`,
    upiDeepLink: `upi://pay?pa=Bzbx****@upi&pn=Merchant Store&am=5000&tr=${orderId}`,
  }

  return mockOrder
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  const { orderId } = await params
  const order = await getOrder(orderId)

  if (!order) {
    notFound()
  }

  // Transform mock order to match PaymentOrder interface
  const transformedOrder = {
    id: order._id,
    orderId: order.orderId,
    amount: order.amount,
    description: `Payment to ${order.merchantName}`,
    upiId: order.vpa,
    status: order.status,
    createdBy: "system",
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
    expiresAt: order.expiresAt,
    merchantName: order.merchantName,
    vpa: order.vpa,
    upiDeepLink: order.upiDeepLink,
  }

  return <PaymentPageClient order={transformedOrder} />
}
