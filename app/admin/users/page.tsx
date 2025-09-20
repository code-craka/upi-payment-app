'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ModernUserTable } from '@/components/user-management/modern-user-table';

export default function UsersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 p-6">
          <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="h-6 border-gray-300" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-gray-600 mt-1">Manage users, roles, and permissions across your organization</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <ModernUserTable />
      </div>
    </div>
  );
}
