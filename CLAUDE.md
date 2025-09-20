# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise-grade UPI payment management system built with Next.js 15, TypeScript, MongoDB, Upstash Redis, and custom authentication. Features Redis-based session management, role-based access control, comprehensive monitoring, and production-ready security with admin-only account creation.

**🔥 MAJOR UPDATE: Clerk authentication has been completely removed and replaced with a custom authentication system built on Redis sessions, bcrypt password hashing, and role-based access control.**

## Development Commands

```bash
# Development server
pnpm dev

# Build for production
pnpm build

# Production server
pnpm start

# Code quality
pnpm lint            # ESLint checks
pnpm lint:fix        # Auto-fix ESLint issues
pnpm type-check      # TypeScript compilation check

# Testing
pnpm test                # Run all tests
pnpm test:watch      # Watch mode
pnpm test:coverage   # Coverage report
pnpm test:unit       # Unit tests only
pnpm test:integration # Integration tests only

# Markdown linting
pnpm lint:md         # Check markdown files
pnpm lint:md:fix     # Auto-fix markdown issues

# Security & Maintenance
pnpm audit           # Security audit
pnpm security:check  # Check for vulnerabilities
pnpm clean           # Clean build artifacts

# Database Bootstrap (Development)
node scripts/create-test-accounts.cjs  # Create test accounts
node scripts/fix-database-indexes.cjs  # Fix database indexes
```

## Architecture

### Core Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Upstash Redis with circuit breaker pattern
- **Authentication**: Custom session-based authentication with Redis caching
- **Styling**: TailwindCSS v4 + ShadCN/UI components
- **Icons**: Lucide React with custom IconWrapper

### Authentication System
Custom session-based authentication with Redis storage (Clerk completely removed):
- **Session Storage**: Redis with 24-hour TTL and auto-refresh
- **Password Security**: bcrypt hashing with 12 salt rounds
- **Cookie Management**: HTTP-only session cookies with secure flags
- **Account Creation**: Admin-only account creation (no public signup)
- **Edge Runtime**: Compatible session validation for middleware
- **Session Token**: Stored in 'session' cookie for consistent access
- **Role Management**: Real-time role switching and permission checking

### Key Directories
- `app/` - Next.js App Router pages and API routes
- `components/` - React components organized by feature
- `lib/` - Core business logic and utilities
  - `auth/` - Authentication and authorization
  - `db/` - Database models and connections
  - `session/` - Redis session management
  - `types/` - TypeScript type definitions
  - `monitoring/` - Health checks and performance metrics
  - `redis/` - Circuit breaker and Redis utilities
- `middleware.ts` - Route protection and authentication

### Role-Based Access Control

Three role hierarchy with granular permissions:
- **admin**: Full system access (40+ permissions)
- **merchant**: Order and payment management (12+ permissions)
- **user**: Read-only access to own orders and basic data (4+ permissions)

Permission checking via Redis-cached sessions with database validation.

### Test Accounts (Development)
After running the bootstrap script, use these test credentials:
- **Admin**: `admin@test.com` / `admin123456`
- **Merchant**: `merchant@test.com` / `merchant123456`
- **User**: `user@test.com` / `user123456`

## Environment Variables

Required environment variables (see `VERCEL_ENV_SETUP.md` for complete list):

```bash
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database

# Redis Session Management
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Security
NEXTAUTH_SECRET=32-char-secret-key
CSRF_SECRET=csrf-secret-key

# UPI Payment
UPI_ID=your-upi@bank
MERCHANT_NAME=Your Business Name

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Key Patterns

### Circuit Breaker Pattern
Redis operations are protected by circuit breaker pattern in `lib/redis/circuit-breaker.ts`:
- **CLOSED**: Normal Redis operations
- **OPEN**: Fallback to database validation
- **HALF_OPEN**: Testing Redis recovery

### Session Management
Custom session handling with Redis storage:
1. Login creates encrypted session token
2. Session data stored in Redis with TTL
3. Automatic session refresh on access
4. Secure cookie with HTTP-only flags

### Performance Monitoring
Comprehensive benchmarking system in `lib/testing/performance-benchmarking.ts`:
- Redis vs database response time comparison
- Cache hit ratio validation
- Concurrent user load testing
- Network failure simulation

### Error Handling
Graceful degradation with fallback mechanisms:
- Redis unavailable → Direct database validation
- Database errors → Cached responses when possible
- Authentication failures → Safe redirects to login

## Development Notes

### TypeScript Configuration
- Strict mode enabled with enhanced type coverage
- Build errors ignored in `next.config.mjs` for development
- 319 ESLint errors remaining (significant improvement from 358)

### Testing Strategy
- Unit tests for utility functions
- Integration tests for API routes
- Performance benchmarks for critical paths
- E2E tests (to be implemented)

### Code Quality
- ESLint v9 flat config with TypeScript, React, and Next.js rules
- Prettier with Tailwind plugin
- Markdownlint for documentation
- No console.log in production code (except server-side)

### Security Features
- CSRF protection with token validation
- Rate limiting with Redis backing
- Input sanitization and XSS prevention
- Audit logging for all user actions
- IP tracking and session management

### Performance Optimizations
- Redis caching with 30s TTL
- Circuit breaker pattern for fault tolerance
- Lazy loading and code splitting
- Image optimization and compression
- Server-side logging with structured format

## Common Tasks

### Adding New Role Permissions
1. Update `lib/types/roles.ts` with new permissions
2. Add to appropriate role in `rolePermissions` object
3. Update UI components to check new permissions
4. Test with role switching in admin panel

### Creating New API Endpoints
1. Add route in `app/api/` directory
2. Implement authentication middleware
3. Add proper error handling and logging
4. Include audit logging for sensitive operations
5. Add TypeScript types for request/response

### Debugging Authentication Issues
1. Check Redis connection via health endpoint `/api/system-status`
2. Review server logs for session creation/validation errors
3. Check database connections and user account status
4. Monitor circuit breaker status for Redis failures
5. Verify session cookie is being set correctly in browser

### Performance Testing
Use built-in benchmarking endpoints:
- `/api/performance/benchmark/redis-vs-database` - Compare response times
- `/api/performance/benchmark/cache-hit-ratio` - Validate cache performance
- `/api/performance/benchmark/concurrent-users` - Load testing
- `/api/performance/benchmark/full-suite` - Complete benchmark

### Bootstrap Development Environment
1. Run `node scripts/create-test-accounts.cjs` to create test accounts
2. Use test credentials provided above for development
3. Run `node scripts/fix-database-indexes.cjs` if encountering index conflicts

Always run lint and type-check commands before committing code changes.

## Recent Major Changes (v3.0.0)

### 🔥 Complete Clerk Removal & Custom Authentication

**What Changed:**
- ✅ **Removed all Clerk dependencies** - Zero Clerk imports or references
- ✅ **Custom authentication system** - Redis-based sessions with bcrypt
- ✅ **Role-based access control** - Admin, Merchant, User with proper data isolation
- ✅ **Enhanced dashboards** - Role-specific dashboards with appropriate features
- ✅ **Payment links system** - Full CRUD for merchants and admins
- ✅ **Advanced analytics** - Role-based analytics and reporting

**New Authentication Flow:**
1. **Login**: `/login` page with email/password authentication
2. **Session Creation**: Redis-stored session with 24-hour TTL
3. **Middleware Protection**: Edge-runtime compatible auth checking
4. **Role-based Routing**: Different dashboards based on user roles
5. **Logout**: Proper session cleanup and redirect

**Key Files Added/Modified:**
- `lib/auth/session-edge.ts` - Edge-compatible session management
- `lib/auth/edge-auth.ts` - Middleware authentication
- `app/api/auth/*` - Custom auth API endpoints
- `app/dashboard/*` - Role-based dashboards
- `components/admin-sidebar.tsx` - Dynamic navigation based on roles

**Migration Notes:**
- No more Clerk webhooks or API calls
- Session tokens stored in 'session' cookie
- User management through admin interface only
- All authentication handled by custom Redis-based system

**Dashboard Access:**
- **Admin**: `/admin/*` - Full system access and management
- **Merchant**: `/dashboard/*` - Payment links, orders, analytics
- **User**: `/dashboard/*` - Personal orders and basic features