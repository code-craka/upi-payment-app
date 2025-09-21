'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  // Dummy Timer effect - Always shows 9 minutes countdown and resets
  useEffect(() => {
    // Set initial time to 9 minutes (540 seconds) in milliseconds
    const TIMER_DURATION = 9 * 60 * 1000; // 9 minutes in milliseconds

    // Get the start time from sessionStorage or create new one
    const getStartTime = () => {
      const stored = sessionStorage.getItem('paymentTimerStart');
      if (stored) {
        return parseInt(stored);
      }
      const now = Date.now();
      sessionStorage.setItem('paymentTimerStart', now.toString());
      return now;
    };

    const startTime = getStartTime();

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const cyclePosition = elapsed % TIMER_DURATION;
      const remaining = TIMER_DURATION - cyclePosition;

      setTimeLeft(remaining);

      // Don't expire the payment - just let the timer reset
      // Remove the expiration logic completely
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []); // Remove dependency on currentOrder.expiresAt

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

  // Only show failed status screen, not expired (since timer is dummy)
  if (currentOrder.status === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-800">Payment Failed</CardTitle>
            <CardDescription>
              There was an issue with your payment. Please try again.
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6 space-y-6 font-sans">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">Complete Payment</h1>
          <p className="text-sm text-gray-600">Pay using UPI to complete your order</p>
        </div>

        {/* Countdown Timer */}
        <div className="text-center space-y-3">
          <p className="text-gray-700 font-medium text-sm">Payment Timer:</p>
          <div className="flex justify-center gap-2">
            <div className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xl font-bold min-w-[50px]">
              {time.minutes}
            </div>
            <span className="text-gray-400 text-xl font-bold">:</span>
            <div className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xl font-bold min-w-[50px]">
              {time.seconds}
            </div>
          </div>
          <p className="text-xs text-gray-500">Minutes : Seconds (Auto-resets)</p>
        </div>

        {/* Amount Section */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-700 font-medium">Amount to Pay</p>
            <button 
              onClick={() => copyToClipboard(currentOrder.amount.toString(), 'Amount')}
              className="text-blue-600 border border-blue-600 rounded-md px-3 py-1 text-xs font-medium hover:bg-blue-50 transition-colors"
            >
              COPY
            </button>
          </div>
          <p className="text-3xl font-bold text-gray-900">₹{currentOrder.amount}</p>
        </div>

        {/* UPI ID Section */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-700 font-medium">UPI ID</p>
            <button 
              onClick={() => copyToClipboard(currentOrder.vpa || currentOrder.upiId || 'merchant@paytm', 'UPI ID')}
              className="text-blue-600 border border-blue-600 rounded-md px-3 py-1 text-xs font-medium hover:bg-blue-50 transition-colors"
            >
              COPY
            </button>
          </div>
          <p className="font-mono text-lg font-medium text-gray-900 break-all">
            {currentOrder.vpa || currentOrder.upiId || 'merchant@paytm'}
          </p>
        </div>

        {/* Important Notice */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">Important Notice:</p>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>One UPI ID can only transfer money <strong>once</strong></li>
                  <li>Don't change the <strong>payment amount</strong></li>
                  <li>Take your time - payment link never expires</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-4">
          <p className="text-gray-700 font-medium text-sm">Choose Payment Method:</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: "/icons/phonepe.svg", value: "phonepe", alt: "PhonePe" },
              { icon: "/icons/paytm.svg", value: "paytm", alt: "Paytm" },
              { icon: "/icons/googlepay.svg", value: "gpay", alt: "Google Pay" },
              { icon: "/icons/upi.svg", value: "upi", alt: "UPI" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handlePaymentMethodClick(option.value)}
                className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all duration-200 hover:shadow-md ${
                  selectedUpi === option.value 
                    ? 'border-blue-600 bg-blue-50 shadow-md' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="relative">
                  <Image
                    src={option.icon}
                    alt={option.alt}
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain"
                  />
                  {selectedUpi === option.value && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* UTR Input Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">
              After payment, enter UTR number below
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter 12-digit UTR number"
              maxLength={12}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
            />
            <p className="text-xs text-gray-500">
              UTR is a 12-digit reference number for your transaction
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          onClick={handleUtrSubmit}
          disabled={isSubmitting || !utr || utr.length !== 12}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Verifying Payment...</span>
            </div>
          ) : (
            'Complete Payment Verification'
          )}
        </button>

        {/* Support Information */}
        <div className="text-center space-y-2 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/icons/upi.svg"
              alt="UPI"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <p className="text-xs font-medium text-gray-600">Powered by UPI</p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            For any payment issues, contact support at{' '}
            <a href="mailto:support@payment.com" className="text-blue-600 font-medium">
              support@payment.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
