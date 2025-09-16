# UPI Admin Dashboard - Comprehensive AI Agent Instructions

## Architecture Overview

Enterprise-grade UPI payment system built with **Next.js 14 App Router**.
Supports multi-role authentication, audit logging, and advanced security for payment processing, order management, and administrative operations.

### Core Technology Stack

- **Framework**: Next.js 14 with App Router (never use pages/ or _app.tsx)
- **Authentication**: Clerk with role-based permissions (`admin`, `merchant`, `viewer`)
- **Database**: MongoDB with Mongoose ODM and optimized indexes
- **Security**: CSRF protection, rate limiting, and comprehensive audit logging
- **UI**: TailwindCSS v4 with ShadCN components and custom styling
- **TypeScript**: 100% TypeScript coverage with Zod validation

---

## 🔐 Authentication & Authorization

### Core Authentication Patterns

```typescript
import { getSafeUser, requireRole, requirePermission } from "@/lib/auth/safe-auth";
import { currentUser } from "@clerk/nextjs/server";
import { hasPermission, PERMISSIONS } from "@/lib/types";
```

### Implementation Rules

- **✅ Always use**: `currentUser()` from `@clerk/nextjs/server` for auth checks
- **✅ Clerk Provider**: Wrap app in `<ClerkProvider>` in `app/layout.tsx`
- **✅ Type Safety**: Use `getSafeUser()` for type-safe authentication
- **✅ Role Storage**: Roles stored in `user.publicMetadata?.role`
- **✅ Role Validation**: Via `publicMetadata?.role` string comparison
- **✅ Permissions**: Enforce via `requireRole()` and `requirePermission()`
- **❌ Never use**: Old Clerk APIs, pages/ directory, or _app.tsx

### Role-Based UI Rendering

```typescript
const userRole = user.publicMetadata?.role as string;
if (userRole === "admin") {
  // Admin-specific UI components
}
```

---

## 🛡️ Middleware & Security Chain

### Middleware Execution Order (Critical)

```typescript
// middleware.ts - EXACT ORDER REQUIRED:
export default clerkMiddleware((auth, req) => {
  // 1. Security middleware: Rate limiting, basic protections
  // 2. CSRF validation: Skip GET requests and public routes
  // 3. Clerk authentication: Session validation
  // 4. Role-based protection: Admin routes require admin role
});
```

### Security Configuration

- **Rate Limiting**: Apply to all routes
- **CSRF Protection**: Required for POST/PUT/PATCH/DELETE requests
- **Public Routes**: System-status, diagnostic APIs can skip auth
- **Admin Protection**: `/admin/*` routes require exact `admin` role
- **Request Validation**: Basic security headers and input sanitization

### CSRF Implementation

```typescript
// Skip CSRF for specific routes
if (request.nextUrl.pathname === "/api/system-status") {
  return NextResponse.next()
}
```

---

## 🗄️ Database & Models

### Database Operations Pattern

```typescript
import { connectDB } from "@/lib/db/connection";

// Always connect before queries
await connectDB();

// Use static methods for queries
const activeOrders = await OrderModel.findActiveOrders(userId);
const stats = await OrderModel.getOrderStats();

// Instance methods for business logic
order.isExpired();        // Instance method
order.canBeVerified();    // Business logic validation
```

### Model Structure Requirements

- **Location**: `lib/db/models/`
- **Features**: Include validation, indexes, static methods, and instance methods
- **Performance**: Create indexes for frequently queried fields
- **Business Logic**: Implement domain logic as instance/static methods

### Data Validation

- **Input Validation**: Always use Zod schemas for request validation
- **Runtime Safety**: Zod for runtime type checking
- **Sanitization**: Automatic via Zod validation pipelines

---

## 🚀 API Route Development

### Standard API Route Structure

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 2. Role validation
    const userRole = user.publicMetadata?.role as string;
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 3. Request validation
    const schema = z.object({ /* schema definition */ });
    const validatedData = schema.parse(await request.json());

    // 4. Database operations
    await connectDB();
    const result = await Model.performOperation(validatedData);

    // 5. Audit logging
    await AuditLogModel.create({
      action: 'operation_performed',
      entityType: 'Entity',
      entityId: result.id,
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for'),
    });

    // 6. Success response
    return NextResponse.json({ success: true, data: result }, { status: 200 });

  } catch (error) {
    // 7. Error handling
    console.error('Operation failed:', error);
    return NextResponse.json({
      error: "Operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
```

### HTTP Status Code Standards

- **200**: Success with data
- **201**: Resource created successfully
- **400**: Bad request / validation error
- **401**: Authentication required
- **403**: Insufficient permissions
- **500**: Server error

---

## 🎨 Component Development

### Component Guidelines

- **Server Components**: Default choice for static content and data fetching
- **Client Components**: Use `"use client"` only when absolutely necessary
- **ShadCN Integration**: Use `@/components/ui/` consistently
- **Role Rendering**: Conditional rendering based on user roles
- **Hydration Safety**: Use `NoSSR` wrapper for client-only components

### Component Structure

```typescript
// Server Component (preferred)
export default async function AdminDashboard() {
  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  const userRole = user.publicMetadata?.role as string;
  if (userRole !== "admin") {
    redirect("/unauthorized");
  }

  return <AdminContent />;
}

// Client Component (when needed)
"use client"
export function InteractiveComponent() {
  // Use hooks and browser APIs here
}
```

### Hydration Prevention Patterns

```typescript
// Wrap client-only components to prevent hydration issues
import { NoSSR } from "@/components/no-ssr"
import { AuthNavigation } from "@/components/auth-navigation"

<NoSSR fallback={<StaticFallback />}>
  <AuthNavigation />
</NoSSR>

// Use suppressHydrationWarning for dynamic content
<html lang="en" suppressHydrationWarning>
  <body suppressHydrationWarning>
```

### Authentication Components

- **AuthNavigation**: Client component for `<UserButton>`, `<SignedIn>`, `<SignedOut>`
- **RoleGuard**: Conditional rendering based on user roles
- **ClientProviders**: Wraps theme and other client providers
- **NoSSR**: Prevents hydration mismatches for client-only content

---

## 💼 Payment Flow Integration

### Core Payment Workflow

1. **Order Creation** → Generate unique order ID and QR code
2. **QR Code Display** → Show payment QR with countdown timer
3. **Payment Processing** → User completes UPI payment
4. **UTR Verification** → Validate payment with UTR number
5. **Status Update** → Update order status and notify user
6. **Audit Logging** → Log each step with user context

### Payment Components

- **QR Code Generation**: Dynamic QR with order details
- **Countdown Timer**: Automatic expiration handling
- **UTR Form**: User input for payment verification
- **Status Tracking**: Real-time payment status updates

---

## 📊 Audit Logging Pattern

### Audit Implementation

```typescript
await AuditLogModel.create({
  action: 'order_created',           // Action identifier
  entityType: 'Order',               // Entity type
  entityId: orderId,                 // Entity ID
  userId: user.id,                   // User performing action
  ipAddress: request.headers.get('x-forwarded-for'), // IP tracking
  metadata: { /* additional context */ }, // Extra data
});
```

### Audit Requirements

- **All Sensitive Operations**: Track data modifications
- **User Context**: Include user ID and IP address
- **Action Details**: Descriptive action names
- **Entity Tracking**: Link to affected entities

---

## 📁 Project Structure & Conventions

### Directory Organization

```bash
lib/
├── types.ts                 # TypeScript interfaces & Zod schemas
├── utils.ts                 # Utility functions
├── auth/                    # Authentication utilities & safe wrappers
├── db/
│   ├── connection.ts        # Database connection
│   └── models/             # Mongoose models
└── middleware/             # Security middleware

components/
├── ui/                     # ShadCN UI components
├── admin/                  # Admin-specific components
├── landing/               # Landing page components (header, footer, hero, etc.)
├── payment/               # Payment-related components
├── user-management/       # User management components
├── auth-navigation.tsx    # Client-side auth components (UserButton, SignedIn/Out)
├── client-providers.tsx   # Client-side providers wrapper
├── dashboard-header.tsx   # Dashboard header with breadcrumbs
├── no-ssr.tsx            # Hydration prevention wrapper
└── role-protected-page.tsx # Role-based page protection

app/                       # Next.js App Router structure
├── api/                   # API routes
├── admin/                 # Admin dashboard pages
├── dashboard/            # User dashboard
└── (auth)/              # Authentication pages
```

### Import Conventions

- **Absolute Imports**: Always use `@/` prefix
- **Type Imports**: Use `import type` for type-only imports
- **Consistent Paths**: Reference `lib/types.ts` for shared types

---

## ⚡ Development Commands

```bash
pnpm dev      # Development with hot reload
pnpm build    # Production build
pnpm lint     # ESLint checking
pnpm start    # Production server
```

---

## 🚨 Critical Rules & Gotchas

### Absolute Requirements

- **✅ Database Connection**: Always `await connectDB()` before queries
- **✅ Role Validation**: Check roles via `publicMetadata?.role`
- **✅ CSRF Protection**: Required for state-changing requests
- **✅ Audit Logging**: Track all sensitive operations
- **✅ Error Handling**: Use try-catch with descriptive errors
- **✅ TypeScript**: 100% coverage with proper typing

### Common Pitfalls to Avoid

- **❌ Server Components**: Cannot use hooks or browser APIs
- **❌ Old Patterns**: Never use pages/, _app.tsx, or old Clerk APIs
- **❌ Missing Auth**: All admin routes must verify exact "admin" role
- **❌ Direct DB**: Always use model methods, not direct MongoDB calls
- **❌ Hardcoded Values**: Use environment variables for configuration

### Security Checklist

- **✅ Input Validation**: Zod schemas for all request bodies
- **✅ Role Verification**: Exact role matching for protected routes
- **✅ Rate Limiting**: Applied to all API endpoints
- **✅ CSRF Tokens**: Required for state-changing operations
- **✅ Audit Trails**: Logged with user context and IP addresses

---

## 🧪 Testing Approach

### Testing Standards

- **Clerk Auth**: Mock Clerk authentication in tests
- **Database**: Use separate test database
- **Role-Based Access**: Test all permission levels
- **Audit Verification**: Ensure sensitive actions create audit logs
- **Integration**: Test complete user workflows

---

## 🔧 Environment & Configuration

### Required Environment Variables

```bash
# Database
MONGODB_URI=mongodb://...

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Security
NEXTAUTH_SECRET=...
```

### Configuration Validation

- All environment variables must be validated at startup
- Missing configuration should fail gracefully with clear error messages
- Development vs production configuration handling

---

This comprehensive guide ensures consistent, secure, and maintainable code generation for the UPI Admin Dashboard. Always follow these patterns and conventions when creating or modifying any part of the system.
