# UPI Admin Dashboard - Enterprise Payment Management System

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-green?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Cache-Upstash_Redis-red?style=for-the-badge&logo=redis)](https://upstash.com)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-purple?style=for-the-badge&logo=clerk)](https://clerk.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](http://makeapullrequest.com)

> A comprehensive, enterprise-grade UPI payment management system with **hybrid role management**, Upstash Redis caching, and enterprise-level security features.

---

## 🚀 **Overview**

The UPI Admin Dashboard is a next-generation payment processing platform built with **Next.js 14**, featuring **hybrid role management** with Upstash Redis, comprehensive audit logging, and enterprise-level security. Perfect for businesses requiring robust payment management with instant role updates.

### ✨ **Key Highlights**

- 🔄 **Hybrid Role Management** - Upstash Redis + Clerk with instant role updates (no sign-out required)
- 🛡️ **Enterprise Security** - CSRF protection, rate limiting, and comprehensive audit trails
- 📊 **Real-time Analytics** - Advanced payment insights with interactive dashboards
- 🎯 **Edge Performance** - Sub-50ms role validation globally with Redis-first caching
- ⚡ **High Availability** - Automatic failover from Redis to Clerk for reliability
- 🔍 **Full Audit Trail** - Complete activity tracking with IP and user context

---

## 🏗️ **Architecture**

### **Core Technologies**

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | Full-stack React framework | 14 (App Router) |
| **TypeScript** | Type-safe development | 5.0+ |
| **MongoDB** | Primary database | 5.0+ |
| **Upstash Redis** | Hybrid role management cache | Edge optimized |
| **Clerk** | Authentication provider | Latest |
| **TailwindCSS** | Styling framework | v4 |
| **ShadCN/UI** | Component library | Latest |

### **System Flow**

```mermaid
graph TB
    A[User Login] --> B[Clerk Authentication]
    B --> C{Role Assignment}
    C -->|Admin| D[Redis Session + Clerk Metadata]
    C -->|Merchant| E[Redis Session + Clerk Metadata]
    C -->|Viewer| F[Redis Session + Clerk Metadata]
    D --> G[Middleware Validation]
    E --> G
    F --> G
    G --> H[API Route Access]
    H --> I[Audit Logging]
    I --> J[MongoDB Storage]
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

- ✅ **Hybrid Role Management** - Upstash Redis (30s cache) + Clerk (source of truth)
- ✅ **Instant Role Updates** - No logout required after role changes via Redis sync
- ✅ **Edge Performance** - Global role validation in <50ms via Upstash Edge
- ✅ **High Availability** - Automatic fallback to Clerk when Redis unavailable  
- ✅ **Granular Permissions** - 25+ distinct permissions across roles
- ✅ **Multi-factor Authentication** - Enhanced security options via Clerk

### **📊 Admin Dashboard**

- ✅ **Real-time Analytics** - Payment statistics and trends
- ✅ **User Management** - Role assignment and permission control
- ✅ **Audit Log Viewer** - Comprehensive activity tracking
- ✅ **System Health** - Redis and database monitoring
- ✅ **Security Settings** - CSRF, rate limiting configuration

### **🛡️ Security Features**

- ✅ **CSRF Protection** - Token-based request validation
- ✅ **Rate Limiting** - IP-based request throttling
- ✅ **Input Sanitization** - XSS prevention with DOMPurify
- ✅ **Audit Logging** - Complete user activity tracking
- ✅ **Session Invalidation** - Immediate role change enforcement

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

## 📖 **API Documentation**

### **Authentication Flow**

```typescript
// Client-side session management
import { useSessionRole } from '@/hooks/use-session-role'

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

## ✨ Key Features

### 💳 Payment Processing

- **Multi-UPI Integration**: Support for GPay, PhonePe, Paytm, BHIM, and other UPI apps
- **QR Code Generation**: Dynamic QR codes for seamless payments
- **Payment Links**: Shareable payment links with expiration timers
- **UTR Verification**: Manual transaction verification system
- **Real-time Status**: Live payment status updates and notifications

### 🔐 Security & Authentication

- **Role-Based Access**: Admin, Merchant, and Viewer roles with granular permissions
- **CSRF Protection**: Token-based CSRF prevention
- **Rate Limiting**: Configurable rate limits per endpoint
- **Audit Logging**: Complete activity tracking with IP/User-Agent logging
- **Input Sanitization**: XSS prevention with DOMPurify integration

### 📊 Admin Dashboard

- **Order Management**: Complete order lifecycle management
- **User Administration**: User role management and permissions
- **Analytics Dashboard**: Comprehensive payment statistics and metrics
- **Audit Trail Viewer**: Detailed activity logs with advanced filtering
- **System Settings**: Configurable payment timers and UPI app settings

### 🏗️ Technical Architecture

- **Next.js 15**: App Router with React 19 and Server Components
- **TypeScript**: 100% type-safe with Zod validation
- **MongoDB**: Mongoose ODM with optimized indexing
- **Clerk Authentication**: Enterprise-grade authentication system
- **TailwindCSS v4**: Modern styling with ShadCN UI components

## 🛠️ Installation

### Prerequisites

- Node.js 18+
- MongoDB database
- Clerk account for authentication
- pnpm (recommended package manager)

### Quick Start

1. **Clone the repository**
   \`\`\`bash
   git clone <https://github.com/your-username/upi-payment-system.git>
   cd upi-payment-system
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   pnpm install
   \`\`\`

3. **Environment Setup**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

   Configure the following environment variables:
   \`\`\`env

   # Database

   MONGODB_URI=mongodb://localhost:27017/upi-payment-system

   # Clerk Authentication

   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

   # Security

   CSRF_SECRET=your-csrf-secret-key
   RATE_LIMIT_MAX=100
   RATE_LIMIT_WINDOW=900000

   # Payment Configuration

   DEFAULT_PAYMENT_TIMEOUT=540000
   UPI_ID=merchant@upi
   \`\`\`

4. **Database Setup**
   \`\`\`bash

   # Start MongoDB locally or use MongoDB Atlas

   # The application will automatically create indexes on first run

   \`\`\`

5. **Run Development Server**
   \`\`\`bash
   pnpm dev
   \`\`\`

6. **Access the Application**
   - Main Application: <http://localhost:3000>
   - Admin Dashboard: <http://localhost:3000/admin>
   - Payment Pages: <http://localhost:3000/pay/[orderId>]

## 📖 API Documentation

### Authentication

All API routes require proper authentication via Clerk. Admin routes require `admin` role.

### Core Endpoints

#### Orders API

\`\`\`typescript
// Create new order
POST /api/orders
Body: { amount: number, description: string, customerInfo: object }

// Get order details
GET /api/orders/[orderId]

// Submit UTR for verification
POST /api/orders/[orderId]/utr
Body: { utr: string }

// Admin: Update order status
PATCH /api/admin/orders/[orderId]/status
Body: { status: 'completed' | 'failed', notes?: string }
\`\`\`

#### Admin API

\`\`\`typescript
// Get audit logs
GET /api/admin/audit-logs
Query: { page?, limit?, action?, entity?, startDate?, endDate? }

// Get system analytics
GET /api/admin/analytics
Query: { period: 'day' | 'week' | 'month' | 'year' }
\`\`\`

#### Security API

\`\`\`typescript
// Get CSRF token
GET /api/csrf-token
Response: { token: string }
\`\`\`

## 🏗️ Architecture

### Database Schema

#### Orders Collection

\`\`\`typescript
{
  orderId: string (unique)
  amount: number
  description: string
  status: 'pending' | 'pending-verification' | 'completed' | 'failed' | 'expired'
  utr?: string
  customerInfo: object
  createdBy: string
  expiresAt: Date
  timestamps: { createdAt, updatedAt }
}
\`\`\`

#### Audit Logs Collection

\`\`\`typescript
{
  action: string
  entity: string
  entityId: string
  userId: string
  userEmail: string
  ipAddress: string
  userAgent: string
  details: object
  timestamp: Date
}
\`\`\`

### Security Layers

1. **Authentication**: Clerk-based user authentication
2. **Authorization**: Role-based access control (RBAC)
3. **CSRF Protection**: Token-based request validation
4. **Rate Limiting**: IP-based request throttling
5. **Input Validation**: Zod schema validation
6. **Audit Logging**: Complete activity tracking

## 🧪 Testing

### Running Tests

\`\`\`bash

# Unit tests

pnpm test

# Integration tests

pnpm test:integration

# E2E tests

pnpm test:e2e

# Coverage report

pnpm test:coverage
\`\`\`

### Test Structure

- `__tests__/`: Unit tests for components and utilities
- `tests/integration/`: API integration tests
- `tests/e2e/`: End-to-end user flow tests

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

\`\`\`bash

# Build the application

pnpm build

# Start production server

pnpm start
\`\`\`

### Environment Variables for Production

Ensure all environment variables are properly configured in your production environment, including database connections, authentication keys, and security secrets.

## 🔧 Configuration

### Payment Settings

Configure payment timeouts, UPI app integrations, and merchant details in the admin settings panel.

### Security Settings

Adjust rate limiting, CSRF protection, and audit logging settings through the admin interface.

### Role Management

Assign user roles and permissions through the admin user management interface.

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the API documentation above

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 🙏 Acknowledgments

- Next.js team for the excellent framework
- Clerk for authentication services
- MongoDB for database solutions
- Vercel for hosting and deployment
- ShadCN for UI components
