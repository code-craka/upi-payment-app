'use client';

import { useUser } from '@clerk/nextjs';
import { ReactNode } from 'react';

interface RoleGuardProps {
  allowedRoles: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-md rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 className="mb-4 text-2xl font-bold text-white">Access Denied</h1>
        <p className="mb-6 text-slate-400">
          You don't have permission to access this resource. Please contact your administrator if
          you believe this is an error.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="w-full rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 p-3 text-white transition-all duration-300 hover:from-slate-500 hover:to-slate-600"
          >
            Go Back
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white transition-all duration-300 hover:from-indigo-500 hover:to-purple-500"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoleGuard({ allowedRoles, fallback, children }: RoleGuardProps) {
  const { user, isLoaded } = useUser();

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-slate-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated
  if (!user) {
    return fallback || <UnauthorizedPage />;
  }

  // Get user role from Clerk metadata
  const userRole = user.publicMetadata?.role as string;

  // Check if user has required role
  if (!userRole || !allowedRoles.includes(userRole)) {
    return fallback || <UnauthorizedPage />;
  }

  // User has permission, render children
  return <>{children}</>;
}
