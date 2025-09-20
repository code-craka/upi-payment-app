import type React from 'react';
import { redirect } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import { getSafeUser } from '@/lib/auth/safe-auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSafeUser();

  if (!user) {
    redirect('/login');
  }

  if (!['admin', 'merchant', 'user'].includes(user.role)) {
    redirect('/unauthorized');
  }

  return (
    <SidebarProvider>
      <AdminSidebar userRole={user.role} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
