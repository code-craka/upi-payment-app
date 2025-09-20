'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Eye,
  ArrowUpRight,
  Zap,
  Users,
  Sparkles,
} from 'lucide-react';
import { IconWrapper } from '@/lib/icon-wrapper';
import { CreateUserDialog } from '@/components/user-management/create-user-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Create Payment Link Modal Component
function CreatePaymentLinkModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    customerName: '',
    customerEmail: '',
    expiryHours: '24',
  });
  const { toast } = useToast();

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.amount || !formData.description || !formData.customerName) {
        throw new Error('Please fill in all required fields');
      }

      // Create real payment order via API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || undefined,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expiresInMinutes: parseInt(formData.expiryHours) * 60,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      const result = await response.json();
      const orderId = result.data.orderId;
      const paymentLink = `${window.location.origin}/pay/${orderId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(paymentLink);

      toast({
        title: '✨ Payment Link Created!',
        description: `Order ${orderId} created and link copied to clipboard`,
      });

      // Call success callback to refresh dashboard
      onSuccess?.();

      // Reset form and close modal
      setFormData({
        amount: '',
        description: '',
        customerName: '',
        customerEmail: '',
        expiryHours: '24',
      });
      onClose();
    } catch (error) {
      toast({
        title: '❌ Error',
        description: error instanceof Error ? error.message : 'Failed to create payment link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border border-border bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-2xl font-bold text-transparent">
            Create Payment Link
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateLink} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="font-medium text-foreground">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium text-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Enter payment description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary resize-none"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="font-medium text-foreground">
                Customer Name
              </Label>
              <Input
                id="customerName"
                type="text"
                placeholder="Full name"
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
                className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryHours" className="font-medium text-foreground">
                Expires In
              </Label>
              <Select
                value={formData.expiryHours}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, expiryHours: value }))}
              >
                <SelectTrigger className="border-input bg-background text-foreground focus:border-primary focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="24">24 Hours</SelectItem>
                  <SelectItem value="168">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail" className="font-medium text-foreground">
              Customer Email (Optional)
            </Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="customer@example.com"
              value={formData.customerEmail}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
              className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Creating...
                </>
              ) : (
                <>
                  <IconWrapper icon={Sparkles} className="mr-2 h-4 w-4" />
                  Create Link
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecentPaymentLinks() {
  const [paymentLinks, setPaymentLinks] = useState<Array<{
    id: string;
    amount: number;
    customerName: string;
    description?: string;
    expiresAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPaymentLinks();
  }, []);

  const fetchPaymentLinks = async () => {
    try {
      const response = await fetch('/api/orders?limit=5&status=pending');
      if (response.ok) {
        const data = await response.json();
        // Ensure we always get an array
        const linksData = data.data || data || [];
        const validLinks = Array.isArray(linksData) ? linksData : [];
        setPaymentLinks(validLinks);
      } else {
        console.warn('Failed to fetch payment links from API');
        setPaymentLinks([]);
      }
    } catch (_error) {
      console.error('Failed to fetch payment links');
      setPaymentLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Copied!',
        description: 'Payment link copied to clipboard',
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl"></div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <IconWrapper icon={Zap} className="h-5 w-5 text-purple-500" />
              Recent Payment Links
            </CardTitle>
            <CardDescription className="text-gray-600">Your latest payment links</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!Array.isArray(paymentLinks) || paymentLinks.length === 0 ? (
          <div className="text-center py-8">
            <IconWrapper icon={Plus} className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Payment Links Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first payment link to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.isArray(paymentLinks) && paymentLinks.map((link) => (
              <div
                key={link.id}
                className="group rounded-xl border border-border bg-card/50 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:bg-card/70"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-lg bg-primary/10 p-2 transition-transform duration-200 group-hover:scale-110">
                      <IconWrapper icon={Eye} className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 text-sm font-medium text-foreground">
                        ₹{link.amount} - {link.customerName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {link.description || 'Payment link'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {new Date(link.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.origin}/pay/${link.id}`)}
                      className="border-primary/20 hover:bg-primary/10"
                    >
                      <IconWrapper icon={Eye} className="h-4 w-4 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(`/pay/${link.id}`, '_blank')}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <IconWrapper icon={ArrowUpRight} className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {paymentLinks.length > 0 && (
          <div className="mt-6 border-t border-border pt-6">
            <button
              className="group w-full rounded-xl border border-border bg-card p-4 text-card-foreground transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:bg-card/90 hover:text-foreground"
              onClick={() => window.location.href = '/admin/orders'}
            >
              <div className="flex items-center justify-center space-x-2">
                <IconWrapper icon={Eye} className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                <span className="font-medium">View All Payment Links</span>
                <IconWrapper icon={ArrowUpRight} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MerchantDashboard() {
  const [createLinkModal, setCreateLinkModal] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);

  // Handle Clerk authentication with fallback
  let _user = null;
  try {
    const clerkUser = useUser();
    _user = clerkUser.user;
  } catch (_error) {
    console.warn('Clerk authentication failed, using development mode');
    _user = { id: 'dev-user', emailAddresses: [{ emailAddress: 'merchant@dev.com' }] };
  }

  // Function to refresh dashboard data
  const refreshDashboard = () => {
    window.location.reload();
  };

  const handleUserCreated = () => {
    refreshDashboard();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Merchant Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Welcome back! Create users and manage payment links for your business.
          </p>
        </div>

        {/* Quick Actions Section - Only User Creation and Payment Links */}
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <IconWrapper icon={Zap} className="h-5 w-5 text-yellow-500" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-gray-600">Merchant operations - User management and payment links</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Create User */}
              <button
                onClick={() => setCreateUserModal(true)}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 text-gray-800 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-200/50"
              >
                <div className="relative">
                  <div className="mx-auto mb-4 w-fit rounded-lg bg-blue-500 p-3 text-white">
                    <IconWrapper icon={Users} className="h-8 w-8 transition-transform duration-300 group-hover:rotate-12" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">Create User</h3>
                  <p className="text-sm text-gray-600">Add new users to the system</p>
                </div>
              </button>

              {/* Create Payment Link */}
              <button
                onClick={() => setCreateLinkModal(true)}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-6 text-gray-800 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-200/50"
              >
                <div className="relative">
                  <div className="mx-auto mb-4 w-fit rounded-lg bg-green-500 p-3 text-white">
                    <IconWrapper icon={Plus} className="h-8 w-8 transition-transform duration-300 group-hover:rotate-90" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">Create Payment Link</h3>
                  <p className="text-sm text-gray-600">Generate instant payment links</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Payment Links */}
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <div className="animate-pulse">
                  <div className="h-6 bg-muted rounded mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded-xl"></div>
                    ))}
                  </div>
                </div>
              </CardHeader>
            </Card>
          }
        >
          <RecentPaymentLinks />
        </Suspense>

        {/* Create User Modal */}
        <CreateUserDialog
          open={createUserModal}
          onOpenChange={setCreateUserModal}
          onUserCreated={handleUserCreated}
        />

        {/* Create Payment Link Modal */}
        <CreatePaymentLinkModal
          isOpen={createLinkModal}
          onClose={() => setCreateLinkModal(false)}
          onSuccess={refreshDashboard}
        />
      </div>
    </div>
  );
}