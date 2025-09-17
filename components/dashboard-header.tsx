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
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2">
          {displayBreadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {displayBreadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}

          {title && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <h1 className="text-lg font-semibold">{title}</h1>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <NoSSR>
            <AuthNavigation showSignInButton={false} />
          </NoSSR>
        </div>
      </div>
    </header>
  );
}
