'use client';

import React, { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconWrapper } from '@/lib/icon-wrapper';
import { ShieldX } from 'lucide-react';

interface RoleProtectedPageProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Client-side role protection for pages
 * Complements server-side protection in layouts
 */
export function RoleProtectedPage({
  children,
  allowedRoles,
  redirectTo = '/unauthorized',
  fallback,
}: RoleProtectedPageProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (isLoaded && isSignedIn && user) {
      const userRole = user.publicMetadata?.role as string;
      if (!userRole || !allowedRoles.includes(userRole)) {
        router.push(redirectTo);
        return;
      }
    }
  }, [isLoaded, isSignedIn, user, allowedRoles, redirectTo, router]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      fallback || (
        <Alert>
          <IconWrapper icon={ShieldX} className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to access this page.
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={() => router.push('/sign-in')}
            >
              Sign In
            </Button>
          </AlertDescription>
        </Alert>
      )
    );
  }

  // Check role permissions
  const userRole = user?.publicMetadata?.role as string;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      fallback || (
        <Alert variant="destructive">
          <IconWrapper icon={ShieldX} className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to access this resource. Required roles:{' '}
            {allowedRoles.join(', ')}
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Higher-order component for role protection
 */
export function withRoleProtection<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: string[],
) {
  return function ProtectedComponent(props: P) {
    return (
      <RoleProtectedPage allowedRoles={allowedRoles}>
        <Component {...props} />
      </RoleProtectedPage>
    );
  };
}
