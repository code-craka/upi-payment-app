import type React from 'react';
import { redirect } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import { getSafeUser } from '@/lib/auth/safe-auth';

// Force dynamic rendering to avoid static prerendering issues with authentication
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  console.warn('AdminLayout: Starting authentication check');

  // Use custom authentication
  const user = await getSafeUser();
  console.warn('AdminLayout: User =', user ? 'found' : 'null');

  // Check authentication
  if (!user) {
    console.warn('AdminLayout: Redirecting to login');
    redirect('/login');
  }

  // Check admin role
  if (user.role !== 'admin') {
    console.warn('AdminLayout: Redirecting to unauthorized');
    redirect('/unauthorized');
  }

  console.warn('AdminLayout: Authentication successful, rendering admin layout');

  return (
    <SidebarProvider>
      <AdminSidebar userRole="admin" />
      <SidebarInset className="bg-gray-50 min-h-screen">
        <DashboardHeader />
        <main className="flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
