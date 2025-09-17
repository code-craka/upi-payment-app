'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PaymentOrder } from '@/lib/types';

interface PaymentPageClientProps {
  order: PaymentOrder;
}

export function PaymentPageClient({ order }: PaymentPageClientProps) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [selectedUpi, setSelectedUpi] = useState<string>('');
  const [utr, setUtr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const { toast } = useToast();

  // Timer effect
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(currentOrder.expiresAt).getTime();
      const difference = expiry - now;
      return Math.max(0, difference);
    };

    const updateTimer = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0) {
        setCurrentOrder((prev) => ({ ...prev, status: 'expired' }));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentOrder.expiresAt]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0'),
    };
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleUtrSubmit = async () => {
    if (!utr.trim()) {
      toast({
        title: 'UTR required',
        description: 'Please enter the UTR number',
        variant: 'destructive',
      });
      return;
    }

    if (utr.length !== 12) {
      toast({
        title: 'Invalid UTR',
        description: 'UTR number should be 12 digits',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/orders/${currentOrder.orderId}/utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr }),
      });

      if (response.ok) {
        setCurrentOrder((prev) => ({ ...prev, status: 'pending-verification', utr }));
        toast({
          title: 'UTR submitted',
          description: 'Your payment is being verified',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to submit UTR',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentMethodClick = (method: string) => {
    setSelectedUpi(method);

    // Create UPI deep link
    const upiId = currentOrder.vpa || currentOrder.upiId || 'Bzbx****@upi';
    const merchantName = currentOrder.merchantName || 'Merchant';
    const amount = currentOrder.amount;
    const orderId = currentOrder.orderId;

    const deepLinks = {
      phonepe: `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      paytm: `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      gpay: `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
      upi: `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tr=${orderId}&cu=INR`,
    };

    const deepLink = deepLinks[method as keyof typeof deepLinks];
    if (deepLink) {
      // Open the UPI app
      window.location.href = deepLink;

      toast({
        title: 'Opening UPI App',
        description: `Redirecting to ${method.charAt(0).toUpperCase() + method.slice(1)}...`,
      });
    }
  };

  if (currentOrder.status === 'pending-verification') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-yellow-800">Payment Under Verification</CardTitle>
            <CardDescription>
              We&apos;re verifying your payment. This usually takes a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Submitted UTR:</p>
              <p className="font-mono font-medium text-gray-800">{currentOrder.utr}</p>
            </div>
            <p className="text-xs text-gray-500">
              You can close this page. We&apos;ll notify you once the payment is confirmed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentOrder.status === 'completed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-800">Payment Successful!</CardTitle>
            <CardDescription>Your payment has been completed successfully</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div>
              <p className="text-muted-foreground text-sm">Amount Paid</p>
              <p className="text-2xl font-bold">₹{currentOrder.amount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">To</p>
              <p className="font-medium">{currentOrder.merchantName || 'Merchant'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Transaction ID</p>
              <p className="font-mono text-sm">{currentOrder.orderId}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentOrder.status === 'expired' || currentOrder.status === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-800">
              Payment {currentOrder.status === 'expired' ? 'Expired' : 'Failed'}
            </CardTitle>
            <CardDescription>
              {currentOrder.status === 'expired'
                ? 'This payment link has expired. Please request a new payment link.'
                : 'There was an issue with your payment. Please try again.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.close()}>
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const time = formatTime(timeLeft);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto min-h-screen max-w-md bg-white shadow-sm">
        {/* Timer Section */}
        <div className="px-4 py-6 text-center sm:py-8">
          <h2 className="mb-4 text-lg font-medium text-gray-800 sm:text-xl">
            Order will be closed in:
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="min-w-[50px] rounded-md bg-blue-500 px-3 py-2 text-xl font-bold text-white sm:text-2xl">
              {time.minutes}
            </div>
            <div className="text-2xl font-bold text-gray-600">:</div>
            <div className="min-w-[50px] rounded-md bg-blue-500 px-3 py-2 text-xl font-bold text-white sm:text-2xl">
              {time.seconds}
            </div>
          </div>
        </div>

        {/* Amount Section */}
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-gray-600">Amount</p>
              <p className="text-2xl font-bold text-gray-800 sm:text-3xl">
                ₹ {currentOrder.amount}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(currentOrder.amount.toString(), 'Amount')}
              className="border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
            >
              COPY
            </Button>
          </div>
        </div>

        {/* VPA/UPI Section */}
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-gray-600">VPA/UPI</p>
              <p className="truncate text-lg font-medium text-gray-800">
                {currentOrder.vpa || currentOrder.upiId || 'Bzbx****@upi'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyToClipboard(currentOrder.vpa || currentOrder.upiId || 'Bzbx****@upi', 'VPA')
              }
              className="ml-4 border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
            >
              COPY
            </Button>
          </div>
        </div>

        {/* Notice Section */}
        <div className="px-4 py-4">
          <div className="rounded-r-lg border-l-4 border-red-500 bg-red-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-red-600">Notice:</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                1. One UPI can only transfer money{' '}
                <span className="font-semibold text-red-600">once</span>.
              </p>
              <p>
                2. Don&apos;t change the{' '}
                <span className="font-semibold text-red-600">payment amount</span>. Otherwise, the
                order cannot be closed.
              </p>
            </div>
          </div>
        </div>

        {/* UPI Apps Selection */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* PhonePe */}
            <label
              className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              onClick={() => handlePaymentMethodClick('phonepe')}
            >
              <input
                type="radio"
                name="upi"
                value="phonepe"
                checked={selectedUpi === 'phonepe'}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image
                    src="/phonepe-logo.webp"
                    alt="PhonePe"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-gray-800">PhonePe</span>
              </div>
            </label>

            {/* Paytm */}
            <label
              className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              onClick={() => handlePaymentMethodClick('paytm')}
            >
              <input
                type="radio"
                name="upi"
                value="paytm"
                checked={selectedUpi === 'paytm'}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image
                    src="/Paytm_logo.png"
                    alt="Paytm"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-gray-800">Paytm</span>
              </div>
            </label>

            {/* Google Pay */}
            <label
              className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              onClick={() => handlePaymentMethodClick('gpay')}
            >
              <input
                type="radio"
                name="upi"
                value="gpay"
                checked={selectedUpi === 'gpay'}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image
                    src="/gpay-logo.png"
                    alt="G Pay"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-gray-800">G Pay</span>
              </div>
            </label>

            {/* UPI */}
            <label
              className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              onClick={() => handlePaymentMethodClick('upi')}
            >
              <input
                type="radio"
                name="upi"
                value="upi"
                checked={selectedUpi === 'upi'}
                onChange={() => {}} // Removed onChange as click handler manages selection
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex items-center space-x-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image
                    src="/UPI_logo.svg.png"
                    alt="UPI"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-gray-800">UPI</span>
              </div>
            </label>
          </div>
        </div>

        {/* UTR Form */}
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center gap-1">
            <span className="text-sm text-blue-500">↓</span>
            <span className="text-sm font-medium text-blue-500">
              Fill the UTR numbers after you done payment
            </span>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Input UTR number"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              className="h-12 w-full text-base"
              maxLength={12}
            />

            <Button
              onClick={() => {
                handleUtrSubmit().catch(console.error);
              }}
              disabled={isSubmitting}
              className="h-12 w-full rounded-lg bg-blue-500 text-base font-medium text-white transition-colors hover:bg-blue-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit UTR'}
            </Button>
          </div>
        </div>

        {/* Bottom UPI Logo and Support Info */}
        <div className="border-t border-gray-100 px-4 py-6 text-center">
          <div className="mx-auto mb-4 h-16 w-16">
            <Image
              src="/UPI_logo.svg.png"
              alt="UPI"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>

          <div className="space-y-3 text-center">
            <p className="px-2 text-xs leading-relaxed text-gray-600">
              Dear customers: Please give priority to this channel to recharge! Support UPI account
              withdrawal! ICICI Bank guarantee! Safe and reliable! If you have any questions, please
              contact:
            </p>
            <p className="text-sm font-medium break-all text-blue-500">
              hdfcbankComplaintacceptance@gmail.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
