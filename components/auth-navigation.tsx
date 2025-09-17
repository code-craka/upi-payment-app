'use client';

import React, { Suspense } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePathname, useRouter } from 'next/navigation';

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
  const { user, isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  // Get user role for role-based UI
  const userRole = user?.publicMetadata?.role as string;

  if (!isLoaded) {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-20"></div>
      </div>
    );
  }

  const handleSignInClick = () => {
    router.push('/sign-in');
  };

  const handleSignUpClick = () => {
    router.push('/sign-up');
  };

  const handleDashboardClick = () => {
    router.push(userRole === 'admin' ? '/admin' : '/dashboard');
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {!isSignedIn && (
        <>
          {showSignInButton && (
            <>
              <Button variant="ghost" onClick={handleSignInClick}>
                Sign In
              </Button>
              <Button onClick={handleSignUpClick} className="bg-blue-600 hover:bg-blue-700">
                Get Started
              </Button>
            </>
          )}
        </>
      )}

      {isSignedIn && user && userRole && (
        <div className="flex items-center space-x-3">
          {/* Role badge */}
          <Badge variant={userRole === 'admin' ? 'default' : 'secondary'} className="capitalize">
            {userRole}
          </Badge>

          {/* Dashboard link based on role */}
          {!pathname.startsWith('/admin') && !pathname.startsWith('/dashboard') && (
            <Button variant="outline" size="sm" onClick={handleDashboardClick}>
              Dashboard
            </Button>
          )}

          {/* User button with Suspense */}
          {showUserButton && (
            <Suspense fallback={<div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />}>
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
            </Suspense>
          )}
        </div>
      )}
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
