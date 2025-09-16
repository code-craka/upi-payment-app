# API Documentation

## Overview

The UPI Admin Dashboard provides a comprehensive RESTful API for payment processing, order management, and administrative functions. This system features advanced Redis-based session management for instant role updates and high-performance authentication.

**Author**: Sayem Abdullah Rihan (@code-craka)  
**Contributor**: Sajjadul Islam  
**Contact**: hello@techsci.io  
**Repository**: https://github.com/code-craka/upi-payment-app

## Base URL

\`\`\`
Production: https://your-domain.com/api
Development: http://localhost:3000/api
\`\`\`

## Authentication

The system uses a **hybrid authentication approach** combining **Clerk authentication** with **Upstash Redis caching** for instant role access and enhanced performance:

### Hybrid Role Management

- **Clerk**: Source of truth for user roles and authentication  
- **Upstash Redis**: High-performance cache layer with 30-second TTL  
- **Middleware**: Edge-safe role validation with Redis-first, Clerk fallback  
- **Real-time Updates**: Role changes apply instantly via automatic sync  
- **Auto-Refresh**: React hooks refresh roles every 30 seconds

### Authentication Flow

1. **Clerk Authentication**: User signs in via Clerk
2. **Role Caching**: Middleware caches user role in Redis (30s TTL)  
3. **Route Protection**: Instant role checks via Redis cache
4. **Auto-Sync**: Background sync ensures data consistency between systems

### Admin Bootstrap API

#### Assign User Role

\`\`\`http
POST /api/admin-bootstrap
\`\`\`

**Request Body:**

\`\`\`json
{
  "userEmail": "user@example.com",
  "targetRole": "admin",
  "reason": "Initial admin setup",
  "force": false
}
\`\`\`

**Response:**

\`\`\`json
{
  "success": true,
  "userId": "user_123",
  "previousRole": null,
  "newRole": "admin",
  "clerkUpdated": true,
  "redisUpdated": true,
  "message": "Successfully assigned role to admin",
  "timestamp": 1726574400000
}
\`\`\`

#### Get Bootstrap Statistics

\`\`\`http
GET /api/admin-bootstrap
\`\`\`

**Response:**

\`\`\`json
{
  "success": true,
  "stats": {
    "admin": 2,
    "merchant": 15,
    "viewer": 45,
    "total": 62,
    "unassigned": 0,
    "synced": 60,
    "unsynced": 2
  },
  "syncHealth": {
    "score": 97,
    "synced": 60,
    "unsynced": 2,
    "total": 62
  },
  "canBootstrap": true,
  "unsyncedUsers": ["user_456", "user_789"],
  "timestamp": 1726574400000
}
\`\`\`

### Session Debug API

#### Debug Session (Development & Admin)

\`\`\`http
GET /api/debug/session
\`\`\`

**Response:**

\`\`\`json
{
  "userId": "user_123",
  "userEmail": "user@example.com",
  "clerkData": {
    "role": "admin",
    "publicMetadata": {},
    "lastUpdated": 1726574400000
  },
  "redisData": {
    "cached": true,
    "role": "admin",
    "lastSync": 1726574400000,
    "ttl": 28,
    "sessionData": {}
  },
  "synchronization": {
    "inSync": true,
    "discrepancy": null,
    "recommendation": "✅ Session is properly configured and roles match."
  },
  "performance": {
    "clerkLatency": 150,
    "redisLatency": 25,
    "totalLatency": 175
  },
  "timestamp": 1726574400000
}
\`\`\`

#### Manual Role Sync

\`\`\`http
POST /api/debug/session
\`\`\`

**Request Body:**

\`\`\`json
{
  "action": "sync",
  "force": true
}
\`\`\`

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit information included in response headers
- **Exceeded**: Returns 429 status code with retry information

## Error Handling

### Error Response Format

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "amount",
      "issue": "Must be a positive number"
    }
  }
}
\`\`\`

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Orders API

### Create Order

Create a new payment order.

\`\`\`http
POST /api/orders
\`\`\`

**Request Body:**
\`\`\`json
{
  "amount": 1000,
  "description": "Product purchase",
  "customerInfo": {
    "name": "John Doe",
    "email": "<john@example.com>",
    "phone": "+91-9876543210"
  },
  "expiresIn": 540000,
  "metadata": {
    "productId": "prod_123",
    "category": "electronics"
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "amount": 1000,
    "description": "Product purchase",
    "status": "pending",
    "paymentUrl": "<https://your-domain.com/pay/order_abc123>",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "upiId": "merchant@upi",
    "merchantName": "Your Store Name",
    "expiresAt": "2024-12-15T10:30:00Z",
    "createdAt": "2024-12-15T10:21:00Z"
  }
}
\`\`\`

### Get Order

Retrieve order details.

\`\`\`http
GET /api/orders/{orderId}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "amount": 1000,
    "description": "Product purchase",
    "status": "pending",
    "customerInfo": {
      "name": "John Doe",
      "email": "<john@example.com>"
    },
    "createdAt": "2024-12-15T10:21:00Z",
    "expiresAt": "2024-12-15T10:30:00Z"
  }
}
\`\`\`

### Submit UTR

Submit UTR for order verification.

\`\`\`http
POST /api/orders/{orderId}/utr
\`\`\`

**Request Body:**
\`\`\`json
{
  "utr": "123456789012",
  "paymentMethod": "gpay",
  "notes": "Payment completed via Google Pay"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "orderId": "order_abc123",
    "status": "pending-verification",
    "utr": "123456789012",
    "submittedAt": "2024-12-15T10:25:00Z"
  }
}
\`\`\`

## Payment Interface

### UPI Deep Linking

The payment interface supports direct deep linking to UPI applications for seamless payment experience:

**Supported UPI Apps:**
- **PhonePe**: `phonepe://pay?pa={upiId}&pn={merchantName}&am={amount}&tr={orderId}&cu=INR`
- **Paytm**: `paytmmp://pay?pa={upiId}&pn={merchantName}&am={amount}&tr={orderId}&cu=INR`
- **Google Pay**: `tez://upi/pay?pa={upiId}&pn={merchantName}&am={amount}&tr={orderId}&cu=INR`
- **Generic UPI**: `upi://pay?pa={upiId}&pn={merchantName}&am={amount}&tr={orderId}&cu=INR`

**Deep Link Parameters:**
- `pa`: Payee Address (UPI ID)
- `pn`: Payee Name (Merchant Name, URL encoded)
- `am`: Amount
- `tr`: Transaction Reference (Order ID)
- `cu`: Currency (INR)

**Implementation Features:**
- Automatic app detection and selection
- Radio button interface for UPI app selection
- Real-time countdown timer
- Copy-to-clipboard functionality for amount and UPI ID
- UTR submission form with validation
- Mobile-responsive design
- Toast notifications for user feedback

### Payment Page Features

The payment interface includes:

1. **Timer Section**: Countdown timer showing order expiry
2. **Amount Section**: Displays amount with copy button
3. **VPA/UPI Section**: Shows UPI ID with copy button
4. **Notice Section**: Important payment instructions
5. **UPI App Selection**: Radio buttons with logos for app selection
6. **UTR Form**: Input field for UTR submission after payment
7. **Customer Support**: Contact information for assistance

## Admin API

### Get Orders

Retrieve orders with filtering and pagination.

\`\`\`http
GET /api/admin/orders
\`\`\`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status
- `startDate` - Filter from date
- `endDate` - Filter to date
- `search` - Search in order ID or customer info

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
\`\`\`

### Update Order Status

Update order status (Admin only).

\`\`\`http
PATCH /api/admin/orders/{orderId}/status
\`\`\`

**Request Body:**
\`\`\`json
{
  "status": "completed",
  "notes": "Payment verified successfully",
  "verifiedBy": "admin_user_id"
}
\`\`\`

### Get Analytics

Retrieve payment analytics.

\`\`\`http
GET /api/admin/analytics
\`\`\`

**Query Parameters:**
- `period` - Time period (day, week, month, year)
- `startDate` - Custom start date
- `endDate` - Custom end date

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "totalOrders": 1250,
    "totalAmount": 125000,
    "completedOrders": 1100,
    "pendingOrders": 50,
    "failedOrders": 100,
    "conversionRate": 88.0,
    "chartData": [...]
  }
}
\`\`\`

### Get Audit Logs

Retrieve audit logs (Admin only).

\`\`\`http
GET /api/admin/audit-logs
\`\`\`

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `action` - Filter by action type
- `entity` - Filter by entity type
- `userId` - Filter by user ID
- `startDate` - Filter from date
- `endDate` - Filter to date

## Security API

### Get CSRF Token

Retrieve CSRF token for state-changing operations.

\`\`\`http
GET /api/csrf-token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "token": "csrf_token_here"
  }
}
\`\`\`

## Webhooks

### Order Status Update

Webhook payload for order status changes.

\`\`\`json
{
  "event": "order.status_updated",
  "data": {
    "orderId": "order_abc123",
    "previousStatus": "pending",
    "currentStatus": "completed",
    "updatedAt": "2024-12-15T10:30:00Z"
  },
  "timestamp": "2024-12-15T10:30:00Z"
}
\`\`\`

### Payment Received

Webhook payload for payment confirmation.

\`\`\`json
{
  "event": "payment.received",
  "data": {
    "orderId": "order_abc123",
    "amount": 1000,
    "utr": "123456789012",
    "receivedAt": "2024-12-15T10:25:00Z"
  },
  "timestamp": "2024-12-15T10:25:00Z"
}
\`\`\`

## SDK Examples

### JavaScript/Node.js

\`\`\`javascript
const UPIPaymentAPI = require('upi-payment-sdk');

const client = new UPIPaymentAPI({
  apiKey: 'your_api_key',
  baseURL: '<https://your-domain.com/api>'
});

// Create order
const order = await client.orders.create({
  amount: 1000,
  description: 'Product purchase',
  customerInfo: {
    name: 'John Doe',
    email: '<john@example.com>'
  }
});

console.log('Payment URL:', order.paymentUrl);
\`\`\`

### Python

\`\`\`python
from upi_payment_sdk import UPIPaymentClient

client = UPIPaymentClient(
    api_key='your_api_key',
    base_url='<https://your-domain.com/api>'
)

# Create order

order = client.orders.create({
    'amount': 1000,
    'description': 'Product purchase',
    'customerInfo': {
        'name': 'John Doe',
        'email': '<john@example.com>'
    }
})

print(f"Payment URL: {order['paymentUrl']}")
\`\`\`

## Testing

### Test Environment

\`\`\`
Base URL: <https://test.your-domain.com/api>
Test API Key: test_key_123
\`\`\`

### Test Cards

Use these test UTR numbers for testing:
- `123456789012` - Success
- `123456789013` - Failure
- `123456789014` - Pending

## Support

For API support:
- Documentation: <https://docs.your-domain.com>
- Support Email: <api-support@upipayment.com>
- Status Page: <https://status.your-domain.com>
