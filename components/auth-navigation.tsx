'use client';

import React from 'react';
import { UserButton, SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AuthNavigationProps {
  showUserButton?: boolean;
  showSignInButton?: boolean;
  className?: string;
}

/**
 * Client-side authentication navigation component
 * Handles all Clerk components that need client-side rendering
 */
export function AuthNavigation({
  showUserButton = true,
  showSignInButton = true,
  className = '',
}: AuthNavigationProps) {
  const { user } = useUser();
  const pathname = usePathname();

  // Get user role for role-based UI
  const userRole = user?.publicMetadata?.role as string;

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <SignedOut>
        {showSignInButton && (
          <>
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </>
        )}
      </SignedOut>

      <SignedIn>
        {user && userRole && (
          <div className="flex items-center space-x-3">
            {/* Role badge */}
            <Badge variant={userRole === 'admin' ? 'default' : 'secondary'} className="capitalize">
              {userRole}
            </Badge>

            {/* Dashboard link based on role */}
            {!pathname.startsWith('/admin') && !pathname.startsWith('/dashboard') && (
              <Button variant="outline" size="sm" asChild>
                <Link href={userRole === 'admin' ? '/admin' : '/dashboard'}>Dashboard</Link>
              </Button>
            )}

            {/* User button */}
            {showUserButton && (
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8',
                    userButtonPopoverCard: 'shadow-lg border',
                    userButtonPopoverActionButton: 'hover:bg-gray-100',
                  },
                }}
              />
            )}
          </div>
        )}
      </SignedIn>
    </div>
  );
}

/**
 * Role-based content wrapper
 * Only renders children if user has the required role
 */
interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return null; // or loading spinner
  }

  const userRole = user?.publicMetadata?.role as string;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
