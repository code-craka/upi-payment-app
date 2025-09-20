import { getSafeUser } from '@/lib/auth/safe-auth';
import { redirect } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ExternalLink, Copy, Eye } from 'lucide-react';

// Mock data for payment links
const mockPaymentLinks = [
  {
    id: 'link_001',
    title: 'Monthly Subscription',
    description: 'Subscription payment for premium service',
    amount: 1000,
    status: 'active',
    usageCount: 23,
    usageLimit: 100,
    createdAt: '2024-01-15',
    expiresAt: '2024-12-31',
  },
  {
    id: 'link_002',
    title: 'One-time Payment',
    description: 'Single product purchase',
    amount: 2500,
    status: 'active',
    usageCount: 5,
    usageLimit: 10,
    createdAt: '2024-01-10',
    expiresAt: '2024-06-30',
  },
  {
    id: 'link_003',
    title: 'Donation Link',
    description: 'Charity donation collection',
    amount: null,
    status: 'inactive',
    usageCount: 0,
    usageLimit: null,
    createdAt: '2024-01-01',
    expiresAt: null,
  },
];

function getStatusBadge(status: string) {
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    expired: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[status as keyof typeof statusColors] || statusColors.inactive}`}
    >
      {status}
    </span>
  );
}

export default async function PaymentLinksPage() {
  const user = await getSafeUser();

  if (!user) {
    redirect('/login');
  }

  // Only merchants and admins can access payment links
  if (!['admin', 'merchant'].includes(user.role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-2xl font-bold">Payment Links</h1>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Link
        </Button>
      </div>

      <div className="space-y-4">
        {mockPaymentLinks.map((link) => (
          <Card key={link.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{link.title}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </div>
                {getStatusBadge(link.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-lg font-semibold">
                    {link.amount ? `₹${link.amount}` : 'Variable'}
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
                  <p className="text-lg font-semibold">{link.createdAt}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expires</p>
                  <p className="text-lg font-semibold">{link.expiresAt || 'Never'}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {mockPaymentLinks.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center">
                <h3 className="text-lg font-semibold">No payment links yet</h3>
                <p className="text-muted-foreground mt-2">
                  Create your first payment link to start accepting payments
                </p>
                <Button className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}