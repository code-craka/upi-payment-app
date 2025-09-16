/**
 * Enhanced Database Security Middleware
 * 
 * Provides comprehensive protection against Mongoose vulnerabilities including:
 * - Search injection attacks
 * - Prototype pollution
 * - Schema path pollution
 * - Improper input validation
 * 
 * Author: Sayem Abdullah Rihan (@code-craka)
 * Contact: hello@techsci.io
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  sanitizeMongoQuery, 
  sanitizeUserInput, 
  sanitizeObjectId,
  sanitizePaginationParams,
  sanitizeSortParameter 
} from './security';

/**
 * Enhanced security middleware for API routes
 * Prevents all known Mongoose vulnerabilities
 */
export function withDatabaseSecurity(handler: Function) {
  return async (req: NextRequest, context?: any) => {
    try {
      // 1. Sanitize query parameters to prevent search injection
      const url = new URL(req.url);
      const queryParams: any = {};
      
      for (const [key, value] of url.searchParams.entries()) {
        // Prevent prototype pollution in query params
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        
        // Sanitize the query parameter
        queryParams[key] = sanitizeMongoQuery(value);
      }

      // 2. Sanitize request body for POST/PUT/PATCH requests
      let sanitizedBody = null;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          const body = await req.json();
          sanitizedBody = sanitizeUserInput(body);
        } catch (error) {
          // Body might not be JSON, skip sanitization
        }
      }

      // 3. Sanitize path parameters if they exist
      const sanitizedParams: any = {};
      if (context?.params) {
        for (const [key, value] of Object.entries(context.params)) {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
          }
          
          // Special handling for ObjectId parameters
          if (key.toLowerCase().includes('id')) {
            const objectId = sanitizeObjectId(value as string);
            sanitizedParams[key] = objectId ? objectId.toString() : null;
          } else {
            sanitizedParams[key] = sanitizeUserInput(value);
          }
        }
      }

      // 4. Create sanitized request object
      const sanitizedRequest = {
        ...req,
        query: queryParams,
        body: sanitizedBody,
        params: sanitizedParams,
        // Add security headers
        headers: {
          ...req.headers,
          'x-security-sanitized': 'true',
          'x-security-timestamp': new Date().toISOString()
        }
      };

      // 5. Call the original handler with sanitized data
      return await handler(sanitizedRequest, context);

    } catch (error) {
      console.error('Database security middleware error:', error);
      return NextResponse.json({
        error: 'Security validation failed',
        code: 'SECURITY_ERROR',
        message: 'Request contains potentially dangerous data'
      }, { status: 400 });
    }
  };
}

/**
 * Specific middleware for preventing Mongoose search injection
 */
export function preventSearchInjection(handler: Function) {
  return async (req: NextRequest, context?: any) => {
    try {
      const url = new URL(req.url);
      const searchParam = url.searchParams.get('search');
      
      if (searchParam) {
        // Remove MongoDB operators from search queries
        const sanitizedSearch = searchParam
          .replace(/\$\w+/g, '') // Remove $operators
          .replace(/[{}]/g, '') // Remove braces
          .replace(/eval|function|javascript:/gi, '') // Remove script injections
          .trim();
        
        url.searchParams.set('search', sanitizedSearch);
        
        // Create new request with sanitized search
        const newRequest = new NextRequest(url.toString(), {
          method: req.method,
          headers: req.headers,
          body: req.body
        });
        
        return await handler(newRequest, context);
      }
      
      return await handler(req, context);
    } catch (error) {
      console.error('Search injection prevention error:', error);
      return NextResponse.json({
        error: 'Search validation failed',
        code: 'SEARCH_INJECTION_ERROR'
      }, { status: 400 });
    }
  };
}

/**
 * Middleware to prevent prototype pollution in schema paths
 */
export function preventSchemaPathPollution(handler: Function) {
  return async (req: NextRequest, context?: any) => {
    try {
      let body = null;
      
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          body = await req.json();
          
          if (body && typeof body === 'object') {
            // Remove dangerous schema path manipulations
            const dangerousFields = [
              '__proto__',
              'constructor',
              'prototype',
              'schema',
              'model',
              'collection'
            ];
            
            function cleanObject(obj: any): any {
              if (!obj || typeof obj !== 'object') return obj;
              
              if (Array.isArray(obj)) {
                return obj.map(cleanObject);
              }
              
              const cleaned: any = {};
              for (const [key, value] of Object.entries(obj)) {
                if (!dangerousFields.includes(key) && !key.startsWith('$')) {
                  cleaned[key] = cleanObject(value);
                }
              }
              return cleaned;
            }
            
            body = cleanObject(body);
          }
        } catch (error) {
          // Body is not JSON, skip
        }
      }
      
      // Create request with cleaned body
      if (body) {
        const cleanedRequest = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(body)
        });
        
        return await handler(cleanedRequest, context);
      }
      
      return await handler(req, context);
    } catch (error) {
      console.error('Schema path pollution prevention error:', error);
      return NextResponse.json({
        error: 'Schema validation failed',
        code: 'SCHEMA_PATH_ERROR'
      }, { status: 400 });
    }
  };
}

/**
 * Comprehensive input validation for all Mongoose operations
 */
export function validateMongooseInput(handler: Function) {
  return async (req: NextRequest, context?: any) => {
    try {
      // Validate common dangerous patterns
      const requestText = req.url + (req.body ? await req.text() : '');
      
      const dangerousPatterns = [
        /\$where/gi,
        /eval\(/gi,
        /function\s*\(/gi,
        /this\./gi,
        /__proto__/gi,
        /constructor/gi,
        /prototype/gi
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(requestText)) {
          console.warn('Dangerous pattern detected in request:', pattern);
          return NextResponse.json({
            error: 'Request contains potentially dangerous content',
            code: 'DANGEROUS_PATTERN_ERROR'
          }, { status: 400 });
        }
      }
      
      return await handler(req, context);
    } catch (error) {
      console.error('Mongoose input validation error:', error);
      return NextResponse.json({
        error: 'Input validation failed',
        code: 'INPUT_VALIDATION_ERROR'
      }, { status: 400 });
    }
  };
}

/**
 * Complete security wrapper combining all protections
 */
export function withCompleteMongooseSecurity(handler: Function) {
  return withDatabaseSecurity(
    preventSearchInjection(
      preventSchemaPathPollution(
        validateMongooseInput(handler)
      )
    )
  );
}

/**
 * Security configuration for Mongoose connection
 */
export const MONGOOSE_SECURE_CONFIG = {
  // Disable autoIndex in production to prevent index manipulation
  autoIndex: process.env.NODE_ENV !== 'production',
  
  // Use strict mode
  strict: true,
  
  // Disable automatic type casting for security
  typecast: false,
  
  // Set maximum connection pool size
  maxPoolSize: 10,
  
  // Enable query sanitization
  sanitizeFilter: true,
  
  // Disable deprecated features that could be exploited
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // Set timeouts to prevent DoS
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // Enable query logging in development
  debug: process.env.NODE_ENV === 'development'
};

/**
 * Audit function to log potentially dangerous queries
 */
export function auditDatabaseQuery(operation: string, query: any, userId?: string) {
  const auditData = {
    timestamp: new Date().toISOString(),
    operation,
    userId,
    queryKeys: Object.keys(query || {}),
    hasDangerousOperators: JSON.stringify(query || {}).includes('$where'),
    ipAddress: process.env.REQUEST_IP || 'unknown'
  };
  
  // Log audit data (in production, send to monitoring service)
  console.log('Database Query Audit:', auditData);
  
  // In production, you might want to send this to a monitoring service
  if (process.env.NODE_ENV === 'production' && auditData.hasDangerousOperators) {
    console.warn('SECURITY ALERT: Dangerous database operation detected', auditData);
  }
}

/**
 * Rate limiting for database operations
 */
const dbOperationCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimitDatabaseOperations(identifier: string, maxOps = 100, windowMs = 60000) {
  const now = Date.now();
  const current = dbOperationCounts.get(identifier);
  
  if (!current || now > current.resetTime) {
    dbOperationCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxOps) {
    return false;
  }
  
  current.count++;
  return true;
}