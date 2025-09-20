// app/payment-success/[orderId]/page.tsx
import { CheckCircle2, Copy, Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { connectDB } from '@/lib/db/connection';
import { OrderModel } from '@/lib/db/models/Order';
import { notFound } from 'next/navigation';

interface PaymentSuccessProps {
  params: Promise<{
    orderId: string;
  }>;
}

async function getCompletedOrder(orderId: string) {
  try {
    await connectDB();

    const order = await OrderModel.findOne({
      orderId,
      status: { $in: ['completed', 'pending-verification'] },
    }).lean()

    if (!order) {
      return null;
    }

    return {
      id: order._id.toString(),
      orderId: order.orderId,
      amount: order.amount,
      description: order.description,
      merchantName: process.env.UPI_MERCHANT_NAME || 'UPI Payment System',
      status: order.status,
      utr: order.utrNumber,
      utrSubmittedAt: order.updatedAt, // Use updatedAt for when UTR was submitted
      paymentMethod: 'upi', // Default payment method
      verifiedAt: order.verifiedAt,
      createdAt: order.createdAt,
      customerName: order.customerName,
    };
  } catch (error) {
    console.error('Error fetching completed order:', error);
    return null;
  }
}

function PaymentSuccessContent({ order }: { order: unknown }) {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadReceipt = () => {
    const receiptData = {
      orderId: order.orderId,
      amount: order.amount,
      merchantName: order.merchantName,
      utr: order.utr,
      status: order.status,
      customerName: order.customerName,
      date: new Date(order.utrSubmittedAt || order.createdAt).toLocaleDateString('en-IN'),
    };

    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(receiptData, null, 2))}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `receipt-${order.orderId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50 text-center">
          <CardContent className="pt-6">
            <div className="mb-4 flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-green-800">
              {order.status === 'completed' ? 'Payment Successful!' : 'UTR Submitted!'}
            </h1>
            <p className="text-green-700">
              {order.status === 'completed'
                ? 'Your payment has been verified and completed.'
                : 'Your payment is being verified. You will be notified once confirmed.'}
            </p>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Payment Details
              <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                {order.status === 'completed' ? 'Completed' : 'Verifying'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Order ID</span>
              <div className="flex items-center gap-2">
                <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                  {order.orderId}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(order.orderId)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Amount</span>
              <span className="text-lg font-bold">₹ {order.amount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Merchant</span>
              <span className="font-medium">{order.merchantName}</span>
            </div>

            {order.utr && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">UTR Number</span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                      {order.utr}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(order.utr)}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {order.paymentMethod && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium capitalize">
                  {order.paymentMethod === 'googlepay' ? 'Google Pay' : order.paymentMethod}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Date & Time</span>
              <span className="font-medium">
                {new Date(order.utrSubmittedAt || order.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button onClick={downloadReceipt} variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </Button>

          <Link href="/dashboard">
            <Button className="w-full">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Support Information */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="mb-2 text-sm text-blue-800">Need help with this transaction?</p>
            <p className="text-xs text-blue-600">
              Contact support with Order ID: <strong>{order.orderId}</strong>
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Email: support@upipayments.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function PaymentSuccessPage({ params }: PaymentSuccessProps) {
  const { orderId } = await params;

  if (!orderId) {
    notFound();
  }

  const order = await getCompletedOrder(orderId);

  if (!order) {
    notFound();
  }

  return <PaymentSuccessContent order={order} />;
}
