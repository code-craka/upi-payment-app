'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: Date;
  onExpiry?: () => void;
}

export function CountdownTimer({ expiresAt, onExpiry }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = expiry - now;

      return Math.max(0, difference);
    };

    const updateTimer = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0) {
        onExpiry?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpiry]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpiring = timeLeft < 60000; // Less than 1 minute
  const isExpired = timeLeft === 0;

  if (isExpired) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Payment Link Expired</span>
          </div>
          <p className="mt-1 text-sm text-red-500">Please request a new payment link</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`${isExpiring ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}
    >
      <CardContent className="p-4 text-center">
        <div
          className={`flex items-center justify-center gap-2 ${isExpiring ? 'text-orange-600' : 'text-blue-600'}`}
        >
          <Clock className="h-5 w-5" />
          <span className="font-medium">Time Remaining</span>
        </div>
        <div
          className={`mt-1 font-mono text-2xl font-bold ${isExpiring ? 'text-orange-700' : 'text-blue-700'}`}
        >
          {formatTime(timeLeft)}
        </div>
        <p className={`mt-1 text-sm ${isExpiring ? 'text-orange-500' : 'text-blue-500'}`}>
          {isExpiring
            ? 'Payment link expiring soon!'
            : 'Complete your payment before time runs out'}
        </p>
      </CardContent>
    </Card>
  );
}
