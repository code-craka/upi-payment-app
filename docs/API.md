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

The system uses a hybrid authentication approach with **Redis-first session management** and Clerk fallback:

### Session-Based Authentication (Recommended)

Include the session token in the Authorization header:

\`\`\`http
Authorization: Bearer <session_token>
\`\`\`

### Redis Session Management

- **Primary Storage**: Redis for instant role updates and high performance
- **Fallback**: Clerk authentication when Redis is unavailable
- **Auto-Refresh**: 30-day TTL with automatic extension on activity
- **Real-time Updates**: Role changes apply immediately without logout

### Session Endpoints

#### Get Session Info
\`\`\`http
GET /api/session/refresh
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "role": "admin",
    "permissions": ["users:read", "users:write", "orders:read", "orders:write"],
    "sessionSource": "redis",
    "expiresAt": "2025-10-16T10:30:00Z",
    "lastRefreshed": "2025-09-16T10:30:00Z"
  }
}
\`\`\`

#### Debug Session (Development Only)
\`\`\`http
GET /api/debug/session
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "clerkUser": { /* Clerk user object */ },
    "redisSession": { /* Redis session data */ },
    "effectiveRole": "admin",
    "sessionSource": "redis",
    "redisConnected": true,
    "clerkConnected": true,
    "permissionsCount": 25
  }
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
