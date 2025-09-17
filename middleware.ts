import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSecurityMiddleware } from '@/lib/middleware/security';
import { createCSRFMiddleware } from '@/lib/middleware/csrf';
import { createAuthMiddleware } from '@/lib/middleware/auth';
import { serverLogger } from '@/lib/utils/server-logger';

// Centralize route definitions
const PUBLIC_ROUTES = [
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pay(.*)',
  '/api/admin/bootstrap',
  '/api/system-status',
  '/api/debug/user',
  '/api/debug/session-claims',
  '/api/debug/session',
  '/api/csrf-token',
];

const ADMIN_ROUTES = ['/admin(.*)', '/api/admin(.*)'];

// Initialize middleware
const securityMiddleware = createSecurityMiddleware({
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  csrf: {
    enabled: true,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
  },
});

const csrfMiddleware = createCSRFMiddleware();

const authMiddleware = createAuthMiddleware({
  redirectOnAuthFailure: true,
  redirectUrl: '/sign-in',
  publicRoutes: PUBLIC_ROUTES,
  adminRoutes: ADMIN_ROUTES,
});

export default clerkMiddleware(async (_auth, req) => {
  try {
    // Apply security
    const securityResponse = await securityMiddleware(req);
    if (securityResponse) return securityResponse;

    // Apply CSRF for non-GET methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfResponse = await csrfMiddleware(req);
      if (csrfResponse) return csrfResponse;
    }

    // Apply authentication
    const authResponse = await authMiddleware(req);
    if (authResponse) return authResponse;

    return NextResponse.next();
  } catch (err: unknown) {
    serverLogger.error('Error in middleware', err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message:
          err instanceof Error ? err.message : 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)', // Always apply to APIs
  ],
};