# UPI Admin Dashboard - Enterprise Payment Management System

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-green?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Cache-Upstash_Redis-red?style=for-the-badge&logo=redis)](https://upstash.com)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-purple?style=for-the-badge&logo=clerk)](https://clerk.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](http://makeapullrequest.com)

> A comprehensive, enterprise-grade UPI payment management system with **hybrid role management**, Upstash Redis caching, circuit breaker pattern, and enterprise-level security features.

---

## 🚀 **Overview**

The UPI Admin Dashboard is a next-generation payment processing platform built with **Next.js 14**, featuring **hybrid role management** with Upstash Redis, comprehensive audit logging, and enterprise-level security. Perfect for businesses requiring robust payment management with instant role updates.

### ✨ **Key Highlights**

- 🔄 **Hybrid Role Management** - Upstash Redis (30s cache) + Clerk with instant role updates (no sign-out required)
- 🛡️ **Enterprise Security** - CSRF protection, rate limiting, circuit breaker pattern, and comprehensive audit trails
- ⚡ **Circuit Breaker Pattern** - Fault-tolerant Redis operations with automatic failure recovery
- 🔄 **Dual Write Operations** - Real-time synchronization between Clerk and Redis
- 📊 **Real-time Analytics** - Advanced payment insights with interactive dashboards
- 🎯 **Edge Performance** - Sub-30ms role validation globally with Redis-first caching
- 🛡️ **High Availability** - Automatic failover from Redis to Clerk for reliability
- 🔍 **Full Audit Trail** - Complete activity tracking with IP and user context

---

## 🏗️ **Architecture**

### **Core Technologies**

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | Full-stack React framework | 14 (App Router) |
| **TypeScript** | Type-safe development | 5.0+ |
| **MongoDB** | Primary database | 5.0+ |
| **Upstash Redis** | Hybrid role management cache with circuit breaker | Edge optimized |
| **Circuit Breaker** | Fault-tolerant Redis operations | Custom implementation |
| **Clerk** | Authentication provider with webhook integration | Latest |
| **TailwindCSS** | Styling framework | v4 |
| **ShadCN/UI** | Component library | Latest |

### **System Flow**

```mermaid
graph TB
    A[User Login] --> B[Clerk Authentication]
    B --> C{Circuit Breaker}
    C -->|CLOSED| D[Redis Cache Check]
    C -->|OPEN| E[Direct Clerk Fallback]
    D -->|Cache Hit| F[Return Cached Role]
    D -->|Cache Miss| G[Fetch from Clerk]
    G --> H[Dual Write to Redis]
    H --> I[Return Role]
    E --> I
    F --> J[Webhook Sync]
    I --> J
    J --> K[Audit Logging]
    K --> L[MongoDB Storage]
```

---

## 🎯 **Features**

### **💳 Payment Management**

- ✅ **UPI Deep Linking** - Direct app integration with PhonePe, Paytm, Google Pay, and generic UPI
- ✅ **Mobile-First UI** - Responsive payment interface optimized for mobile devices
- ✅ **Copy-to-Clipboard** - Easy amount and UPI ID copying for manual payments
- ✅ **Countdown Timers** - Visual payment expiration with real-time countdown
- ✅ **UTR Verification** - 12-digit UTR validation with secure submission
- ✅ **Payment Status** - Real-time status updates with visual indicators
- ✅ **Dynamic QR Codes** - Auto-generated payment QR codes
- ✅ **Payment Tracking** - Complete payment lifecycle management

### **🔐 Authentication & Authorization**

- ✅ **Hybrid Role Management** - Upstash Redis (30s cache) + Clerk with instant role updates (no sign-out required)
- ✅ **Circuit Breaker Protection** - Fault-tolerant Redis operations with automatic recovery
- ✅ **Dual Write Operations** - Real-time synchronization between Clerk and Redis
- ✅ **Instant Role Updates** - No logout required after role changes via Redis sync
- ✅ **Edge Performance** - Sub-30ms role validation globally with Redis-first caching
- ✅ **High Availability** - Automatic failover from Redis to Clerk for reliability
- ✅ **Granular Permissions** - 25+ distinct permissions across roles
- ✅ **Multi-factor Authentication** - Enhanced security options via Clerk

### **📊 Performance Benchmarking & Validation**

- ✅ **Redis vs Clerk Benchmarking** - Multi-region performance comparison with statistical analysis
- ✅ **Cache Hit Ratio Validation** - Real-time cache performance monitoring under various load patterns
- ✅ **Sub-30ms Response Validation** - Statistical validation of response time claims with percentile analysis
- ✅ **Concurrent User Testing** - Race condition detection and system behavior under high concurrency
- ✅ **Network Failure Simulation** - Circuit breaker effectiveness testing with recovery time measurement
- ✅ **Load Testing Framework** - Peak traffic simulation with realistic user patterns
- ✅ **Performance Analytics** - Comprehensive performance reports with actionable insights
- ✅ **Real-time Monitoring** - Live system health indicators and performance metrics

### **📊 Admin Dashboard**

- ✅ **Real-time Analytics** - Payment statistics and trends
- ✅ **User Management** - Role assignment and permission control
- ✅ **Audit Log Viewer** - Comprehensive activity tracking
- ✅ **System Health** - Redis and database monitoring
- ✅ **Security Settings** - CSRF, rate limiting configuration

### **🛡️ Security Features**

- ✅ **Circuit Breaker Pattern** - Fault-tolerant Redis operations with automatic recovery
- ✅ **Dual Write Operations** - Real-time synchronization between Clerk and Redis
- ✅ **CSRF Protection** - Token-based request validation
- ✅ **Rate Limiting** - IP-based request throttling with Redis backing
- ✅ **Input Sanitization** - XSS prevention with DOMPurify
- ✅ **Audit Logging** - Complete user activity tracking with dual write audit trails
- ✅ **Session Invalidation** - Immediate role change enforcement
- ✅ **IP Tracking** - Enhanced security context in all operations

---

## � **Payment Interface Features**

### **UPI Deep Linking**

The payment interface features comprehensive UPI deep linking for seamless mobile payments:

```typescript
// Supported UPI Applications
const upiApps = {
  phonepe: 'phonepe://pay',
  paytm: 'paytmmp://pay', 
  gpay: 'tez://upi/pay',
  upi: 'upi://pay'
}

// Auto-generated deep links with order data
const deepLink = `${appScheme}?pa=${upiId}&pn=${merchantName}&am=${amount}&tr=${orderId}&cu=INR`
```

### **Payment Page Components**

- **⏱️ Countdown Timer**: Visual blue boxes showing minutes:seconds remaining
- **💰 Amount Display**: Large, clear amount with copy-to-clipboard functionality
- **🆔 VPA Section**: UPI ID display with copy button for manual entry
- **⚠️ Notice Section**: Important payment instructions and warnings
- **📱 UPI App Selection**: Radio buttons with authentic app logos for selection
- **📝 UTR Form**: Secure 12-digit UTR submission with validation
- **🆘 Customer Support**: Contact information and help text

### **Mobile-First Design**

- **📱 Responsive Layout**: Optimized for mobile screens with proper touch targets
- **🎨 Professional UI**: Clean, branded interface matching payment gateway standards
- **⚡ Fast Loading**: Optimized images and minimal JavaScript for quick loading
- **🔄 Real-time Updates**: Live countdown and status updates without page refresh

---

## �🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+ and pnpm
- MongoDB 5.0+ (Atlas recommended)
- Redis 7.0+ (Redis Cloud recommended)
- Clerk account for authentication

### **Installation**

```bash
# Clone the repository
git clone https://github.com/code-craka/upi-payment-app.git
cd upi-payment-app

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
```

### **Environment Configuration**

```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/upi-dashboard

# Redis Session Management
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Security
CSRF_SECRET=your-32-character-secret-key
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### **Development**

```bash
# Start development server
pnpm dev

# Run with debugging
DEBUG=* pnpm dev

# Build for production
pnpm build
```

### **First-time Setup**

1. **Create Admin User**

   ```bash
   curl -X POST http://localhost:3000/api/admin-bootstrap \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@yourcompany.com", "action": "make-admin"}'
   ```

2. **Verify Installation**
   - Visit <http://localhost:3000>
   - Sign in with your admin account
   - Access admin dashboard at <http://localhost:3000/admin>

---

---

## 📖 **API Documentation**

### **Authentication Flow**

```typescript
// Client-side session management
import { useSessionRole } from '@/hooks/useSessionRole'

function AdminComponent() {
  const { role, permissions, loading } = useSessionRole()
  
  if (role === 'admin') {
    return <AdminDashboard />
  }
  
  return <AccessDenied />
}
```

### **Core Endpoints**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/orders` | Create payment order | ✅ |
| `GET` | `/api/orders/[id]` | Get order details | ✅ |
| `POST` | `/api/admin-bootstrap` | Assign user roles | ❌ (First-time) |
| `GET` | `/api/admin/audit-logs` | View activity logs | Admin only |
| `POST` | `/api/session/refresh` | Refresh user session | ✅ |
| `GET` | `/api/debug/session` | Debug session info | ✅ |
| `PUT` | `/api/users/[userId]/role` | Update user role (Dual Write) | Admin only |
| `GET` | `/api/users/[userId]/role` | Get user role | Admin only |
| `POST` | `/api/performance/benchmark/redis-vs-clerk` | Redis vs Clerk performance benchmark | Admin/Manager |
| `POST` | `/api/performance/benchmark/cache-hit-ratio` | Cache hit ratio validation | Admin/Manager |
| `POST` | `/api/performance/benchmark/sub-30ms` | Sub-30ms response validation | Admin/Manager |
| `POST` | `/api/performance/benchmark/concurrent-users` | Concurrent user testing | Admin/Manager |
| `POST` | `/api/performance/benchmark/load-test` | Comprehensive load testing | Admin/Manager |
| `POST` | `/api/performance/benchmark/network-failures` | Network failure simulation | Admin only |
| `POST` | `/api/performance/benchmark/full-suite` | Complete benchmark suite | Admin/Manager |
| `GET` | `/api/performance/benchmark/status` | Performance testing status | ✅ |

### **Role Permissions**

```typescript
// Available permissions by role
const permissions = {
  admin: [
    'manage_users', 'view_audit_logs', 'system_configuration',
    'view_all_orders', 'process_refunds', 'access_debug_tools'
  ],
  merchant: [
    'create_orders', 'view_own_orders', 'verify_own_payments'
  ],
  viewer: [
    'view_public_data', 'view_own_profile'
  ]
}
```

---

## 🧪 **Testing**

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e

# Integration tests
pnpm test:integration
```

---

## 🚀 **Deployment**

### **Vercel (Recommended)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/code-craka/upi-payment-app)

### **Docker**

```bash
# Build and run
docker build -t upi-dashboard .
docker run -p 3000:3000 upi-dashboard
```

### **Manual Deployment**

```bash
# Build application
pnpm build

# Start production server
pnpm start
```

---

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### **Development Workflow**

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👥 **Team**

### **Author**

**Sayem Abdullah Rihan**  

- GitHub: [@code-craka](https://github.com/code-craka)
- Email: <hello@techsci.io>
- Role: Lead Developer & System Architect

### **Contributor**

**Sajjadul Islam**  

- Role: Frontend Development & UI/UX
- Contributions: Component design, user experience optimization

### **Contact**

For questions, support, or business inquiries:

- 📧 **General**: <hello@techsci.io>
- 🐛 **Issues**: [GitHub Issues](https://github.com/code-craka/upi-payment-app/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/code-craka/upi-payment-app/discussions)

---

## 📊 **Project Stats**

[![GitHub stars](https://img.shields.io/github/stars/code-craka/upi-payment-app?style=social)](https://github.com/code-craka/upi-payment-app/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/code-craka/upi-payment-app?style=social)](https://github.com/code-craka/upi-payment-app/network/members)
[![GitHub issues](https://img.shields.io/github/issues/code-craka/upi-payment-app)](https://github.com/code-craka/upi-payment-app/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/code-craka/upi-payment-app)](https://github.com/code-craka/upi-payment-app/pulls)

---

## 🔗 **Links**

- 📖 [Documentation](docs/)
- 🚀 [Deployment Guide](docs/DEPLOYMENT.md)
- 🔒 [Security Policy](docs/SECURITY.md)
- 📋 [API Reference](docs/API.md)
- 📝 [Changelog](CHANGELOG.md)

---

<div align="center">

### ⭐ **Star this repository if it helped you!**

Made with ❤️ by [Sayem Abdullah Rihan](https://github.com/code-craka)

</div>


