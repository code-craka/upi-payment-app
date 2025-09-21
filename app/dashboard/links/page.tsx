'use client';

import { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ExternalLink, Copy, Eye } from 'lucide-react';
import { CreatePaymentLinkDialog } from '@/components/payment-links/create-payment-link-dialog';
import { ViewPaymentLinkDialog } from '@/components/payment-links/view-payment-link-dialog';
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

function getStatusBadge(link: PaymentLink) {
  const isExpired = link.expiresAt ? new Date(link.expiresAt) < new Date() : false;
  const isLimitReached = link.usageLimit ? link.usageCount >= link.usageLimit : false;

  let status = 'active';
  let statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800',
    'limit-reached': 'bg-orange-100 text-orange-800',
  };

  if (!link.isActive) {
    status = 'inactive';
  } else if (isExpired) {
    status = 'expired';
  } else if (isLimitReached) {
    status = 'limit-reached';
  }

  const displayStatus = status === 'limit-reached' ? 'limit reached' : status;

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.inactive}`}
    >
      {displayStatus}
    </span>
  );
}

function PaymentLinksContent() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const { toast } = useToast();

  const fetchPaymentLinks = async () => {
    try {
      const response = await fetch('/api/payment-links');
      if (response.ok) {
        const result = await response.json();
        setPaymentLinks(result.data || []);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch payment links',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching payment links:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch payment links',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentLinks();
  }, []);

  const handleCopyLink = async (linkId: string) => {
    const url = `${window.location.origin}/link/${linkId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Payment link copied',
        description: 'The payment link has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Unable to copy the payment link.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenLink = (linkId: string) => {
    const url = `${window.location.origin}/link/${linkId}`;
    window.open(url, '_blank');
  };

  const handleViewLink = (link: PaymentLink) => {
    setSelectedLink(link);
    setViewDialogOpen(true);
  };

  const handleLinkCreated = () => {
    fetchPaymentLinks();
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="text-2xl font-bold">Payment Links</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading payment links...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="text-2xl font-bold">Payment Links</h1>
          </div>
          <Button
            className="gap-2"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Link
          </Button>
        </div>

        <div className="space-y-4">
          {paymentLinks.map((link) => (
            <Card key={link._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description || 'No description'}</CardDescription>
                  </div>
                  {getStatusBadge(link)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Amount</p>
                    <p className="text-lg font-semibold">
                      {link.allowCustomAmount ? (
                        `₹${link.minAmount || 0} - ₹${link.maxAmount || '∞'}`
                      ) : link.amount ? (
                        `₹${link.amount}`
                      ) : (
                        'Variable'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Usage</p>
                    <p className="text-lg font-semibold">
                      {link.usageCount} / {link.usageLimit || '∞'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-lg font-semibold">
                      {format(new Date(link.createdAt), 'yyyy-MM-dd')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expires</p>
                    <p className="text-lg font-semibold">
                      {link.expiresAt ? format(new Date(link.expiresAt), 'yyyy-MM-dd') : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleViewLink(link)}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleCopyLink(link.linkId)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleOpenLink(link.linkId)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {paymentLinks.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">No payment links yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Create your first payment link to start accepting payments
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreatePaymentLinkDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onLinkCreated={handleLinkCreated}
      />

      <ViewPaymentLinkDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        paymentLink={selectedLink}
      />
    </>
  );
}

export default function PaymentLinksPage() {
  return <PaymentLinksContent />;
}