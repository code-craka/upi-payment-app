'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  ExternalLink,
  Eye,
  Calendar,
  Users,
  IndianRupee,
  BarChart3,
  Settings,
  QrCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PaymentLink {
  _id: string;
  linkId: string;
  title: string;
  description?: string;
  amount?: number;
  allowCustomAmount: boolean;
  minAmount?: number;
  maxAmount?: number;
  upiId: string;
  isActive: boolean;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  stats: {
    totalOrders: number;
    successfulOrders: number;
    totalAmount: number;
    lastUsedAt?: string;
  };
  settings: {
    collectCustomerInfo: boolean;
    sendEmailReceipt: boolean;
    redirectUrl?: string;
    webhookUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ViewPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentLink: PaymentLink | null;
}

export function ViewPaymentLinkDialog({
  open,
  onOpenChange,
  paymentLink
}: ViewPaymentLinkDialogProps) {
  const { toast } = useToast();
  const [copyingUrl, setCopyingUrl] = useState(false);

  if (!paymentLink) return null;

  const publicUrl = `${window.location.origin}/link/${paymentLink.linkId}`;
  const isExpired = paymentLink.expiresAt ? new Date(paymentLink.expiresAt) < new Date() : false;
  const isLimitReached = paymentLink.usageLimit ? paymentLink.usageCount >= paymentLink.usageLimit : false;
  const canBeUsed = paymentLink.isActive && !isExpired && !isLimitReached;

  const handleCopyUrl = async () => {
    setCopyingUrl(true);
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({
        title: 'Payment link copied',
        description: 'The payment link has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Unable to copy the payment link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCopyingUrl(false);
    }
  };

  const handleOpenLink = () => {
    window.open(publicUrl, '_blank');
  };

  const getStatusBadge = () => {
    if (!paymentLink.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isLimitReached) {
      return <Badge variant="destructive">Limit Reached</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
  };

  const successRate = paymentLink.stats.totalOrders > 0
    ? (paymentLink.stats.successfulOrders / paymentLink.stats.totalOrders * 100).toFixed(1)
    : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="h-5 w-5" />
                {paymentLink.title}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {paymentLink.description || 'No description provided'}
              </DialogDescription>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleCopyUrl}
              disabled={copyingUrl}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              {copyingUrl ? 'Copying...' : 'Copy Link'}
            </Button>
            <Button
              onClick={handleOpenLink}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                // Generate QR code functionality can be added here
                toast({
                  title: 'QR Code',
                  description: 'QR code generation coming soon!',
                });
              }}
            >
              <QrCode className="h-4 w-4" />
              QR Code
            </Button>
          </div>

          {/* Payment Link URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Link URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={publicUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
              />
              <Button
                onClick={handleCopyUrl}
                disabled={copyingUrl}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <IndianRupee className="h-5 w-5" />
                Payment Details
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-medium">
                    {paymentLink.allowCustomAmount ? (
                      `₹${paymentLink.minAmount || 0} - ₹${paymentLink.maxAmount || '∞'}`
                    ) : paymentLink.amount ? (
                      `₹${paymentLink.amount}`
                    ) : (
                      'Variable'
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">UPI ID:</span>
                  <span className="font-medium font-mono text-sm">{paymentLink.upiId}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Custom Amount:</span>
                  <span className="font-medium">
                    {paymentLink.allowCustomAmount ? 'Allowed' : 'Fixed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage & Limits */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usage & Limits
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Times Used:</span>
                  <span className="font-medium">
                    {paymentLink.usageCount} / {paymentLink.usageLimit || '∞'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created:</span>
                  <span className="font-medium text-sm">
                    {format(new Date(paymentLink.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>

                {paymentLink.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Expires:</span>
                    <span className={`font-medium text-sm ${isExpired ? 'text-red-600' : ''}`}>
                      {format(new Date(paymentLink.expiresAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistics
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Total Orders</div>
                <div className="text-2xl font-bold text-blue-900">
                  {paymentLink.stats.totalOrders}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Successful</div>
                <div className="text-2xl font-bold text-green-900">
                  {paymentLink.stats.successfulOrders}
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Success Rate</div>
                <div className="text-2xl font-bold text-purple-900">
                  {successRate}%
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Total Amount</div>
                <div className="text-2xl font-bold text-orange-900">
                  ₹{paymentLink.stats.totalAmount}
                </div>
              </div>
            </div>

            {paymentLink.stats.lastUsedAt && (
              <div className="text-sm text-gray-600">
                Last used: {format(new Date(paymentLink.stats.lastUsedAt), 'MMM d, yyyy "at" h:mm a')}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Collect Customer Info:</span>
                  <Badge variant={paymentLink.settings.collectCustomerInfo ? "default" : "secondary"}>
                    {paymentLink.settings.collectCustomerInfo ? 'Yes' : 'No'}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Email Receipt:</span>
                  <Badge variant={paymentLink.settings.sendEmailReceipt ? "default" : "secondary"}>
                    {paymentLink.settings.sendEmailReceipt ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {paymentLink.settings.redirectUrl && (
                  <div>
                    <span className="text-sm text-gray-600">Redirect URL:</span>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded mt-1 break-all">
                      {paymentLink.settings.redirectUrl}
                    </div>
                  </div>
                )}

                {paymentLink.settings.webhookUrl && (
                  <div>
                    <span className="text-sm text-gray-600">Webhook URL:</span>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded mt-1 break-all">
                      {paymentLink.settings.webhookUrl}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Alert */}
          {!canBeUsed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800">
                ⚠️ This payment link is currently unavailable for payments
              </div>
              <div className="text-sm text-yellow-700 mt-1">
                {!paymentLink.isActive && 'Link is inactive. '}
                {isExpired && 'Link has expired. '}
                {isLimitReached && 'Usage limit has been reached. '}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}