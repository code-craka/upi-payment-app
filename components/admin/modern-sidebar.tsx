'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Users,
  CreditCard,
  Settings,
  Menu,
  X,
  ChevronDown,
  FileText,
  Shield,
  Home,
  Activity,
  LucideIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavigationItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: Home,
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Orders',
    href: '/admin/orders',
    icon: CreditCard,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: FileText,
  },
  {
    title: 'Settings',
    icon: Settings,
    children: [
      {
        title: 'Security',
        href: '/admin/settings/security',
        icon: Shield,
      },
      {
        title: 'System',
        href: '/admin/settings/system',
        icon: Activity,
      },
    ],
  },
];

interface ModernSidebarProps {
  className?: string;
}

export function ModernSidebar({ className }: ModernSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <Collapsible key={item.title} className="w-full">
          <CollapsibleTrigger
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              'focus:bg-accent focus:text-accent-foreground focus:outline-none',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <div className="flex items-center">
              <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-3')} />
              {!isCollapsed && <span>{item.title}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            )}
          </CollapsibleTrigger>
          {!isCollapsed && (
            <CollapsibleContent className="space-y-1">
              <div className="ml-4 border-l border-border pl-4 space-y-1">
                {item.children?.map((child) => renderNavigationItem(child, level + 1))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    }

    if (!item.href) return null;

    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          'focus:bg-accent focus:text-accent-foreground focus:outline-none',
          isActive(item.href) && 'bg-accent text-accent-foreground',
          isCollapsed && 'justify-center px-2',
          level > 0 && 'ml-4'
        )}
        onClick={() => setIsMobileOpen(false)}
      >
        <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-3')} />
        {!isCollapsed && <span>{item.title}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={toggleMobile}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-full border-r border-border bg-background transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          'md:relative md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center border-b border-border px-4">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-lg font-semibold">UPI Admin</h1>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto hidden md:flex"
              onClick={toggleCollapse}
            >
              {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4 py-4">
            <nav className="space-y-2">
              {navigationItems.map((item) => renderNavigationItem(item))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-border p-4">
            {!isCollapsed && (
              <div className="text-xs text-muted-foreground">
                <p>UPI Admin Dashboard</p>
                <p>v2.0.0</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}