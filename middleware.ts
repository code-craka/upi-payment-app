import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define route matchers
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isApiAdminRoute = createRouteMatcher(['/api/admin(.*)']);
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pay(.*)',
  '/test-clerk',
  '/api/test-clerk',
  '/api/orders(.*)',
  '/api/csrf-token(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For admin routes, require authentication and admin role
  if (isAdminRoute(req) || isApiAdminRoute(req)) {
    const { userId } = await auth();
    
    if (!userId) {
      // Redirect to sign-in for admin routes
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect', req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
    
    // TODO: Add role checking here when Redis is working
    // For now, just ensure authentication
    
    return NextResponse.next();
  }

  // For all other protected routes, require authentication
  const { userId } = await auth();
  
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)', // Always apply to APIs
  ],
};