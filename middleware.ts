import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserEdge, hasRoleEdge } from '@/lib/auth/edge-auth';

// Define route patterns
const isAdminRoute = (pathname: string) => pathname.startsWith('/admin');
const isApiAdminRoute = (pathname: string) => pathname.startsWith('/api/admin');
const isPublicRoute = (pathname: string) => {
  const publicRoutes = [
    '/',
    '/login',
    '/logout',
    '/pay/',
    '/payment-success/',
    '/api/csrf-token',
    '/api/health',
    '/api/orders/',  // Some order routes are public for payment processing
  ];

  return publicRoutes.some(route => {
    if (route.endsWith('/')) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  try {
    // Check authentication first
    const user = await getCurrentUserEdge(req);

    if (!user) {
      // Redirect to login for unauthenticated users
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // For admin routes, require admin role
    if (isAdminRoute(pathname) || isApiAdminRoute(pathname)) {
      const isAdmin = await hasRoleEdge('admin', req);

      if (!isAdmin) {
        // Redirect to unauthorized page
        const unauthorizedUrl = new URL('/unauthorized', req.url);
        return NextResponse.redirect(unauthorizedUrl);
      }
    }

    // User is authenticated and authorized
    return NextResponse.next();

  } catch (error) {
    console.error('[Middleware] Authentication error:', error);

    // On auth error, redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)', // Always apply to APIs
  ],
};