'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  const { user, isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-20"></div>
      </div>
    );
  }

  const handleSignInClick = () => {
    router.push('/login');
  };

  const handleSignUpClick = () => {
    router.push('/login');
  };

  const handleDashboardClick = () => {
    router.push(user?.role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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

      {isSignedIn && user && (
        <div className="flex items-center space-x-3">
          {/* Role badge */}
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
            {user.role}
          </Badge>

          {/* Dashboard link based on role */}
          {!pathname.startsWith('/admin') && !pathname.startsWith('/dashboard') && (
            <Button variant="outline" size="sm" onClick={handleDashboardClick}>
              Dashboard
            </Button>
          )}

          {/* User button with dropdown */}
          {showUserButton && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={user.name || user.email} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDashboardClick}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
  const { user, isLoaded } = useAuth();

  if (!isLoaded) {
    return null; // or loading spinner
  }

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
