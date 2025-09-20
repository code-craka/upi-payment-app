'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Link2, Calendar } from 'lucide-react';

interface CreatePaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkCreated?: (link: { linkId: string; title: string; amount?: number }) => void;
}

export function CreatePaymentLinkDialog({
  open,
  onOpenChange,
  onLinkCreated,
}: CreatePaymentLinkDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    allowCustomAmount: false,
    minAmount: '',
    maxAmount: '',
    expiresAt: '',
    usageLimit: '',
    collectCustomerInfo: true,
    sendEmailReceipt: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast({
        title: 'Error',
        description: 'Please enter a title for the payment link.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          amount: formData.allowCustomAmount ? undefined : parseFloat(formData.amount) || undefined,
          allowCustomAmount: formData.allowCustomAmount,
          minAmount: formData.allowCustomAmount && formData.minAmount ? parseFloat(formData.minAmount) : undefined,
          maxAmount: formData.allowCustomAmount && formData.maxAmount ? parseFloat(formData.maxAmount) : undefined,
          expiresAt: formData.expiresAt || undefined,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
          settings: {
            collectCustomerInfo: formData.collectCustomerInfo,
            sendEmailReceipt: formData.sendEmailReceipt,
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Log activity
        await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'payment_link_created',
            title: 'New payment link created',
            description: `Payment link "${formData.title}" was created`,
            amount: formData.allowCustomAmount ? undefined : parseFloat(formData.amount) || undefined,
            icon: 'link',
            color: 'green',
            metadata: {
              linkId: result.data.linkId,
              title: formData.title,
            },
          }),
        });

        toast({
          title: 'Payment link created successfully',
          description: `"${formData.title}" is now available for payments.`,
        });

        onLinkCreated?.(result.data);
        onOpenChange(false);

        // Reset form
        setFormData({
          title: '',
          description: '',
          amount: '',
          allowCustomAmount: false,
          minAmount: '',
          maxAmount: '',
          expiresAt: '',
          usageLimit: '',
          collectCustomerInfo: true,
          sendEmailReceipt: false,
        });
      } else {
        throw new Error(result.error || 'Failed to create payment link');
      }
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast({
        title: 'Error creating payment link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <div className="rounded-full bg-blue-500 p-2">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            Create Payment Link
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Create a new payment link to collect payments from customers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Basic Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                  Title *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Product Purchase, Service Payment"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this payment is for"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  rows={3}
                />
              </div>
            </div>

            {/* Amount Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Amount Settings</h3>

              <div className="flex items-center space-x-2">
                <Switch
                  id="allowCustomAmount"
                  checked={formData.allowCustomAmount}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowCustomAmount: checked })
                  }
                />
                <Label htmlFor="allowCustomAmount" className="text-sm font-medium text-gray-700">
                  Allow customers to enter custom amount
                </Label>
              </div>

              {!formData.allowCustomAmount ? (
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                    Fixed Amount (₹)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    min="1"
                    step="0.01"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minAmount" className="text-sm font-medium text-gray-700">
                      Minimum Amount (₹)
                    </Label>
                    <Input
                      id="minAmount"
                      type="number"
                      placeholder="0.00"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      min="1"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAmount" className="text-sm font-medium text-gray-700">
                      Maximum Amount (₹)
                    </Label>
                    <Input
                      id="maxAmount"
                      type="number"
                      placeholder="0.00"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Advanced Settings
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt" className="text-sm font-medium text-gray-700">
                    Expires At
                  </Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usageLimit" className="text-sm font-medium text-gray-700">
                    Usage Limit
                  </Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    placeholder="Unlimited"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    min="1"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="collectCustomerInfo"
                    checked={formData.collectCustomerInfo}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, collectCustomerInfo: checked })
                    }
                  />
                  <Label htmlFor="collectCustomerInfo" className="text-sm font-medium text-gray-700">
                    Collect customer information
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sendEmailReceipt"
                    checked={formData.sendEmailReceipt}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, sendEmailReceipt: checked })
                    }
                  />
                  <Label htmlFor="sendEmailReceipt" className="text-sm font-medium text-gray-700">
                    Send email receipt
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Payment Link
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}