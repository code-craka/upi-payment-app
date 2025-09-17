'use client';

import { useState, useEffect } from 'react';
import { Copy, CheckCircle2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';

// UPI Provider configurations
const UPI_PROVIDERS = [
  {
    name: 'PhonePe',
    id: 'phonepe',
    icon: '/icons/phonepe.svg',
    scheme: 'phonepe://pay',
  },
  {
    name: 'Paytm',
    id: 'paytm',
    icon: '/icons/paytm.svg',
    scheme: 'paytmmp://pay',
  },
  {
    name: 'Google Pay',
    id: 'googlepay',
    icon: '/icons/googlepay.png',
    scheme: 'tez://upi/pay',
  },
  {
    name: 'UPI',
    id: 'upi',
    icon: '/icons/upi.webp',
    scheme: 'upi://pay',
  },
];

interface PaymentOrder {
  id: string;
  orderId: string;
  amount: number;
  description: string;
  upiId: string;
  merchantName: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  upiDeepLink?: string;
}

interface PaymentPageProps {
  order: PaymentOrder;
}

export function PaymentPageComponent({ order }: PaymentPageProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [utr, setUtr] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Initialize countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(order.expiresAt).getTime();
      const difference = expiry - now;

      if (difference > 0) {
        setTimeLeft(Math.floor(difference / 1000));
      } else {
        setTimeLeft(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [order.expiresAt]);

  // Format time display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return {
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(remainingSeconds).padStart(2, '0'),
    };
  };

  const { minutes, seconds } = formatTime(timeLeft);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        variant: 'destructive',
        description: 'Failed to copy to clipboard',
      });
    }
  };

  // Generate UPI deep link
  const generateUpiLink = (provider: (typeof UPI_PROVIDERS)[0]) => {
    const params = new URLSearchParams({
      pa: order.upiId,
      pn: encodeURIComponent(order.merchantName),
      am: order.amount.toString(),
      tr: order.orderId,
      cu: 'INR',
    });

    return `${provider.scheme}?${params.toString()}`;
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (providerId: string) => {
    setSelectedMethod(providerId);
    const provider = UPI_PROVIDERS.find((p) => p.id === providerId);

    if (provider) {
      const upiLink = generateUpiLink(provider);

      // Try to open the UPI app
      window.location.href = upiLink;

      toast({
        description: `Opening ${provider.name}...`,
      });
    }
  };

  // Submit UTR
  const handleUtrSubmit = async () => {
    if (!utr.trim()) {
      toast({
        variant: 'destructive',
        description: 'Please enter a valid UTR number',
      });
      return;
    }

    if (utr.length !== 12) {
      toast({
        variant: 'destructive',
        description: 'UTR number must be 12 digits',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${order.orderId}/utr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          utr: utr,
          paymentMethod: selectedMethod || 'upi',
        }),
      });

      if (response.ok) {
        toast({
          description: 'UTR submitted successfully! Your payment is being verified.',
        });
        setUtr('');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit UTR');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Failed to submit UTR',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract masked VPA for display
  const getMaskedVpa = (vpa: string) => {
    const [username, domain] = vpa.split('@');
    if (username && domain) {
      const maskedUsername = username.slice(0, 4) + '****';
      return `${maskedUsername}@${domain}`;
    }
    return vpa;
  };

  if (timeLeft <= 0) {
    return (
      <div className="mx-auto w-full max-w-lg p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mb-2 text-xl font-bold text-red-600">Order Expired</div>
            <p className="text-gray-600">
              This payment link has expired. Please create a new order.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      {/* Timer Section */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Order will be closed in:</p>
        <div className="flex items-center space-x-1">
          <span className="rounded bg-blue-600 px-2 py-1 font-mono text-sm text-white">
            {minutes}
          </span>
          <span className="font-bold text-blue-600">:</span>
          <span className="rounded bg-blue-600 px-2 py-1 font-mono text-sm text-white">
            {seconds}
          </span>
        </div>
      </div>

      {/* Amount Section */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Amount</p>
        <div className="flex items-center gap-3">
          <p className="text-lg font-bold text-gray-900">
            ₹ {order.amount.toLocaleString('en-IN')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(order.amount.toString(), 'Amount')}
            className="h-8 px-3"
          >
            {copiedField === 'Amount' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                COPY
              </>
            )}
          </Button>
        </div>
      </div>

      {/* VPA/UPI Section */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">VPA/UPI</p>
        <div className="flex items-center gap-3">
          <p className="font-mono text-lg font-bold">{getMaskedVpa(order.upiId)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(order.upiId, 'UPI ID')}
            className="h-8 px-3"
          >
            {copiedField === 'UPI ID' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                COPY
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notice Section */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-bold text-red-600">Notice</p>
          <div className="space-y-1 text-xs text-gray-700">
            <p>
              1. <span className="font-semibold text-red-600">One UPI</span> can only transfer money{' '}
              <span className="font-semibold text-red-600">once</span>.
            </p>
            <p>
              2. Don't change the <span className="font-semibold text-red-600">payment amount</span>
              . Otherwise, the order cannot be closed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Section */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-4 font-semibold">Choose Payment Method</h3>
          <RadioGroup value={selectedMethod} onValueChange={handlePaymentMethodSelect}>
            <div className="space-y-2">
              {UPI_PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex cursor-pointer items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50"
                >
                  <RadioGroupItem value={provider.id} id={provider.id} />
                  <Label htmlFor={provider.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="relative h-8 w-16">
                        <Image
                          src={provider.icon}
                          alt={provider.name}
                          fill
                          className="object-contain"
                          sizes="64px"
                        />
                      </div>
                      <span className="font-medium">{provider.name}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* UTR Input Section */}
      <Card>
        <CardContent className="p-4">
          <Label className="mb-3 flex items-center gap-2 text-sm text-blue-700">
            <ArrowDown className="h-4 w-4" />
            Fill the UTR number after you complete payment:
          </Label>

          <div className="space-y-3">
            <Input
              placeholder="Enter 12-digit UTR number"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className="text-center font-mono text-lg"
              maxLength={12}
            />

            <Button
              onClick={handleUtrSubmit}
              disabled={isSubmitting || !utr.trim() || utr.length !== 12}
              className="w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
            >
              {isSubmitting ? 'Submitting...' : 'Submit UTR'}
            </Button>
          </div>

          <p className="mt-2 text-center text-xs text-gray-500">
            UTR (UPI Transaction Reference) is a 12-digit number you'll receive after payment
          </p>
        </CardContent>
      </Card>

      {/* Customer Support Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-blue-800">Need help? Contact customer support</p>
          <p className="mt-1 text-xs text-blue-600">
            support@{order.merchantName?.toLowerCase().replace(/\s+/g, '')}.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
