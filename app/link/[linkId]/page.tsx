import { notFound } from 'next/navigation'
import { connectDB } from '@/lib/db/connection'
import { PaymentLinkModel } from '@/lib/db/models/PaymentLink'
import { PaymentLinkPageClient } from '@/components/payment-links/payment-link-page-client'

interface PaymentLinkPageProps {
  params: Promise<{
    linkId: string
  }>
}

async function getPaymentLink(linkId: string) {
  try {
    await connectDB()

    const paymentLink = await PaymentLinkModel.findOne({
      linkId: linkId,
      isActive: true
    }).lean()

    if (!paymentLink) {
      return null
    }

    // Check if expired
    if (paymentLink.expiresAt && new Date() > paymentLink.expiresAt) {
      return null
    }

    // Check if usage limit reached
    if (paymentLink.usageLimit && paymentLink.usageCount >= paymentLink.usageLimit) {
      return null
    }

    // Transform MongoDB document to match component interface
    return {
      id: paymentLink._id.toString(),
      linkId: paymentLink.linkId,
      title: paymentLink.title,
      description: paymentLink.description,
      amount: paymentLink.amount,
      allowCustomAmount: paymentLink.allowCustomAmount,
      minAmount: paymentLink.minAmount,
      maxAmount: paymentLink.maxAmount,
      upiId: paymentLink.upiId,
      merchantName: process.env.UPI_MERCHANT_NAME || 'UPI Payment System',
      isActive: paymentLink.isActive,
      expiresAt: paymentLink.expiresAt,
      usageLimit: paymentLink.usageLimit,
      usageCount: paymentLink.usageCount,
      settings: paymentLink.settings,
      createdAt: paymentLink.createdAt,
      updatedAt: paymentLink.updatedAt,
      createdBy: paymentLink.createdBy,
    }
  } catch (_error) {
    console.error('Error fetching payment link:', _error)
    return null
  }
}

export default async function PaymentLinkPage({ params }: PaymentLinkPageProps) {
  const { linkId } = await params

  if (!linkId) {
    notFound()
  }

  const paymentLink = await getPaymentLink(linkId)

  if (!paymentLink) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <PaymentLinkPageClient paymentLink={paymentLink} />
    </div>
  )
}