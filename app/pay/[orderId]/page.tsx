import { notFound, redirect } from 'next/navigation'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'
import { PaymentPageClient } from '@/components/payment/payment-page-client'

interface PaymentPageProps {
  params: Promise<{
    orderId: string
  }>
}

async function getOrder(orderId: string) {
  try {
    await connectDB()
    
    const order = await OrderModel.findOne({ 
      orderId: orderId,
      status: { $nin: ['expired', 'failed'] }
    }).lean()

    if (!order) {
      return null
    }

    // Check if order is expired
    const now = new Date()
    if (order.expiresAt && new Date(order.expiresAt) < now && order.status === 'pending') {
      // Update order status to expired
      await OrderModel.findByIdAndUpdate(order._id, { 
        status: 'expired',
        updatedAt: now
      })
      return null
    }

    // Transform MongoDB document to match component interface
    return {
      id: order._id.toString(),
      orderId: order.orderId,
      amount: order.amount,
      description: order.description || `Payment for Order ${order.orderId}`,
      upiId: order.upiId,
      merchantName: process.env.UPI_MERCHANT_NAME || 'UPI Payment System',
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      expiresAt: order.expiresAt,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      createdBy: order.createdBy,
      utr: order.utrNumber,
      vpa: order.upiId, // Add vpa field that client component expects
    }
  } catch (error) {
    console.error('Error fetching order:', error)
    return null
  }
}

export default async function PaymentPage({ params }: PaymentPageProps) {
  const { orderId } = await params
  
  if (!orderId) {
    notFound()
  }

  const order = await getOrder(orderId)

  if (!order) {
    notFound()
  }

  // Redirect completed orders to success page
  if (order.status === 'completed') {
    redirect(`/payment-success/${orderId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <PaymentPageClient order={order} />
    </div>
  )
}
