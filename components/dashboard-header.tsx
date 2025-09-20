'use client';

import React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AuthNavigation } from '@/components/auth-navigation';
import { NoSSR } from '@/components/no-ssr';
import { usePathname } from 'next/navigation';

interface DashboardHeaderProps {
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export function DashboardHeader({ title, breadcrumbs, actions }: DashboardHeaderProps) {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname if not provided
  const defaultBreadcrumbs = pathname
    .split('/')
    .filter(Boolean)
    .map((segment, index, array) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: index === array.length - 1 ? undefined : '/' + array.slice(0, index + 1).join('/'),
    }));

  const displayBreadcrumbs = breadcrumbs || defaultBreadcrumbs;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">
      <SidebarTrigger className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md" />
      <Separator orientation="vertical" className="h-6 border-gray-300" />

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-3">
          {displayBreadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {displayBreadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator className="text-gray-400" />}
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink
                          href={crumb.href}
                          className="text-gray-600 hover:text-gray-900 font-medium"
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="text-gray-900 font-semibold">
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}

          {title && (
            <>
              <Separator orientation="vertical" className="h-6 border-gray-300" />
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <NoSSR>
            <AuthNavigation showSignInButton={false} />
          </NoSSR>
        </div>
      </div>
    </header>
  );
}
