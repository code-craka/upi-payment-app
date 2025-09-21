'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  CreditCard,
  Activity,
} from 'lucide-react';
import { AuthNavigation } from '@/components/auth-navigation';
import { NoSSR } from '@/components/no-ssr';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

const adminMenuItems = [
  {
    title: 'Dashboard',
    url: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'User Management',
    url: '/admin/users',
    icon: Users,
  },
  {
    title: 'Orders',
    url: '/admin/orders',
    icon: ShoppingCart,
  },
  {
    title: 'Analytics',
    url: '/admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Audit Logs',
    url: '/admin/audit-logs',
    icon: Activity,
  },
  {
    title: 'Settings',
    url: '/admin/settings',
    icon: Settings,
  },
];

const merchantMenuItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    url: '/dashboard/users',
    icon: Users,
  },
  {
    title: 'Payment Links',
    url: '/dashboard/links',
    icon: CreditCard,
  },
  {
    title: 'My Orders',
    url: '/dashboard/orders',
    icon: ShoppingCart,
  },
  {
    title: 'Analytics',
    url: '/dashboard/analytics',
    icon: Activity,
  },
];

const userMenuItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Orders',
    url: '/dashboard/orders',
    icon: ShoppingCart,
  },
];

interface AdminSidebarProps {
  userRole: 'admin' | 'merchant' | 'user';
}

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname();

  const getMenuItems = () => {
    switch (userRole) {
      case 'admin':
        return adminMenuItems;
      case 'merchant':
        return merchantMenuItems;
      case 'user':
        return userMenuItems;
      default:
        return merchantMenuItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar className="border-r border-gray-200 bg-white shadow-lg">
      <SidebarHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              UPI Payment
            </span>
            <span className="text-xs text-gray-500 font-medium capitalize">
              {userRole} Panel
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        <SidebarGroup className="px-3 py-4">
          <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <div
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                          <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                            {item.title}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-center p-4">
          <NoSSR>
            <AuthNavigation showSignInButton={false} />
          </NoSSR>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
