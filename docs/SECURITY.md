# Security Guidelines

## Overview

The UPI Admin Dashboard implements multiple layers of security to protect user data, prevent unauthorized access, and ensure compliance with financial regulations. The system features a **hybrid authentication approach** with Upstash Redis and Clerk for enhanced security and performance.

**Author**: Sayem Abdullah Rihan (@code-craka)  
**Contributor**: Sajjadul Islam  
**Contact**: hello@techsci.io  
**Repository**: https://github.com/code-craka/upi-payment-app

## Security Architecture

### Hybrid Authentication Security

- **Clerk**: Source of truth for authentication and role management
- **Upstash Redis**: High-performance role cache with 30-second TTL  
- **Edge Security**: Instant role validation at edge with Redis-first approach
- **Automatic Failover**: Seamless fallback to Clerk when Redis unavailable
- **Dual Validation**: Both Redis and Clerk validate roles for critical operations

### Enhanced Session Management

- **Redis Cache Layer**: Sub-50ms role validation globally
- **TTL-Based Expiration**: 30-second cache expiration for security
- **Auto-Sync Mechanism**: Background synchronization between systems
- **Session Encryption**: Secure session data with TLS encryption
- **IP Address Tracking**: Location-based security monitoring

### UPI Payment Security

- **Deep Link Validation**: Secure UPI URL construction with parameter validation
- **Amount Protection**: Immutable amount display with copy protection
- **UTR Validation**: 12-digit UTR number format validation
- **Transaction Timeout**: Automatic order expiration with countdown timer
- **Payment Method Security**: Secure deep linking to verified UPI applications
- **State Management**: Secure payment status transitions with audit logging

### Authentication & Authorization

- **Clerk Integration**: Enterprise-grade authentication with MFA support
- **Role-Based Access Control (RBAC)**: Three-tier permission system (admin, merchant, viewer)
- **Real-time Role Updates**: Users receive role changes instantly via Redis cache
- **Permission Inheritance**: Admin role inherits all permissions automatically
- **JWT Tokens**: Secure token-based authentication with hybrid validation

### Data Protection

- **Upstash Redis Security**: REST API with TLS 1.3 and token authentication
- **MongoDB Encryption**: Encryption at rest for sensitive data  
- **Encryption in Transit**: TLS 1.3 for all communications
- **Input Sanitization**: DOMPurify integration for XSS prevention
- **NoSQL Injection Prevention**: Parameterized queries and Mongoose ODM

### API Security

- **CSRF Protection**: Token-based CSRF prevention for state-changing operations
- **Rate Limiting**: IP-based request throttling with Redis counters
- **Input Validation**: Zod schema validation for all API inputs
- **Security Headers**: Comprehensive security header implementation
- **Hybrid Validation**: Dual Redis/Clerk validation for enhanced security

## Enhanced Security Features

### Hybrid Role Management Security

```typescript
// Secure hybrid role validation
const authContext = await getHybridAuthContext(userId);

// Redis-first approach for performance
if (authContext.redis.cached && authContext.redis.ttl > 0) {
  return authContext.redis.role;
}

// Fallback to Clerk for reliability  
if (authContext.clerk.authenticated) {
  await syncRoleToRedis(userId, authContext.clerk.role);
  return authContext.clerk.role;
}

throw new UnauthorizedError('Authentication failed');
```

### Real-time Permission Validation

```typescript
// Instant permission checks with cache
const userRole = await getCachedUserRole(userId);
if (!hasPermission(userRole, 'orders:write')) {
  await auditLog({
    action: 'permission_denied',
    userId,
    permission: 'orders:write',
    ipAddress: request.ip
  });
  throw new ForbiddenError('Insufficient permissions');
}
```

### Secure Admin Bootstrap

```typescript
// Dual-write for role assignments
await Promise.all([
  updateClerkRole(userId, newRole),    // Source of truth
  cacheUserRole(userId, newRole, 30),  // Performance cache
  auditLog({
    action: 'role_assigned',
    userId,
    newRole,
    adminId: currentUser.id
  })
]);
```

### CSRF Protection

\`\`\`typescript
// Automatic CSRF token validation
const csrfToken = await getCsrfToken();
fetch('/api/orders', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
\`\`\`

### Upstash Redis Security

- **REST API Security**: HTTPS-only with bearer token authentication
- **Global Edge Security**: TLS 1.3 encryption across all edge locations  
- **Token-Based Auth**: Secure REST API tokens with rotation capability
- **Rate Limiting**: Built-in DDoS protection and request throttling
- **Data Encryption**: AES-256 encryption at rest and in transit
- **Access Control**: IP whitelisting and VPC peering support
- **Audit Logging**: Complete request and response logging
- **Compliance**: SOC 2 Type II, ISO 27001, and GDPR compliant

### Redis Security Best Practices

\`\`\`typescript
// Secure Redis configuration
export const redisConfig = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 3,
    delay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000)
  },
  timeout: 5000,
  headers: {
    'User-Agent': 'UPI-Admin-Dashboard/1.0'
  }
};

// Secure data storage with TTL
await redis.setex(
  \`role:\${userId}\`, 
  30,  // 30-second TTL for security
  JSON.stringify({
    role,
    timestamp: Date.now(),
    source: 'clerk'
  })
);
\`\`\`

### Rate Limiting
- **Default Limits**: 100 requests per 15 minutes per IP
- **Configurable**: Adjustable through environment variables
- **Endpoint-Specific**: Different limits for different endpoints
- **User-Based**: Additional limits for authenticated users

### Audit Logging
All security-relevant events are logged:
- Authentication attempts
- Authorization failures
- Data access and modifications
- Administrative actions
- System configuration changes

## Security Headers

### Content Security Policy (CSP)
\`\`\`
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.clerk.dev;
\`\`\`

### Additional Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## Vulnerability Management

### Regular Security Audits
- Automated dependency scanning
- Code security analysis
- Penetration testing (recommended quarterly)
- Security code reviews

### Dependency Management
\`\`\`bash
# Regular security audits
pnpm audit
npm audit --audit-level moderate

# Update dependencies
pnpm update
\`\`\`

## Incident Response

### Security Incident Procedure
1. **Detection**: Monitor logs and alerts
2. **Assessment**: Evaluate severity and impact
3. **Containment**: Isolate affected systems
4. **Investigation**: Analyze root cause
5. **Recovery**: Restore normal operations
6. **Documentation**: Record lessons learned

### Emergency Contacts
- Security Team: security@upipayment.com
- Development Team: dev@upipayment.com
- System Administrator: admin@upipayment.com

## Compliance

### Data Protection
- GDPR compliance for EU users
- PCI DSS considerations for payment data
- Local data protection regulations

### Financial Regulations
- KYC (Know Your Customer) requirements
- AML (Anti-Money Laundering) compliance
- Transaction reporting requirements

## Security Best Practices

### For Developers
- Never commit secrets to version control
- Use environment variables for configuration
- Implement proper error handling
- Follow secure coding practices
- Regular security training

### For Administrators
- Regular security updates
- Monitor system logs
- Implement backup procedures
- Access control reviews
- Security awareness training

### For Users
- Strong password requirements
- Multi-factor authentication
- Regular password updates
- Secure device usage
- Phishing awareness

## Security Testing

### Automated Testing
- SAST (Static Application Security Testing)
- DAST (Dynamic Application Security Testing)
- Dependency vulnerability scanning
- Container security scanning

### Manual Testing
- Code security reviews
- Penetration testing
- Social engineering assessments
- Physical security reviews

## Reporting Security Issues

### Responsible Disclosure
1. Email: security@upipayment.com
2. Include detailed description
3. Provide reproduction steps
4. Allow reasonable time for response
5. Do not publicly disclose until resolved

### Bug Bounty Program
- Scope: All production systems
- Rewards: Based on severity
- Rules: Responsible disclosure required
- Contact: bounty@upipayment.com
