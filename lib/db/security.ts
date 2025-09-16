/**
 * Database Security Utilities
 * 
 * Provides security utilities to prevent MongoDB injection attacks,
 * prototype pollution, and other database-related vulnerabilities.
 * 
 * Author: Sayem Abdullah Rihan (@code-craka)
 * Contact: hello@techsci.io
 */

import { Types } from 'mongoose';

/**
 * Sanitizes MongoDB queries to prevent injection attacks
 */
export function sanitizeMongoQuery(query: any): any {
  if (query === null || query === undefined) {
    return query;
  }

  // Handle arrays
  if (Array.isArray(query)) {
    return query.map(sanitizeMongoQuery);
  }

  // Handle objects
  if (typeof query === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(query)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      // Sanitize MongoDB operators that could be dangerous
      if (key.startsWith('$') && !isAllowedMongoOperator(key)) {
        continue;
      }

      sanitized[key] = sanitizeMongoQuery(value);
    }

    return sanitized;
  }

  // Handle strings - remove potential injection patterns
  if (typeof query === 'string') {
    return query.replace(/[\$]/g, ''); // Remove $ characters
  }

  return query;
}

/**
 * List of allowed MongoDB operators
 */
const ALLOWED_MONGO_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
  '$and', '$or', '$not', '$nor',
  '$exists', '$type', '$regex', '$options',
  '$all', '$elemMatch', '$size',
  '$text', '$search',
  '$where' // Use with extreme caution
];

function isAllowedMongoOperator(operator: string): boolean {
  return ALLOWED_MONGO_OPERATORS.includes(operator);
}

/**
 * Validates and sanitizes ObjectId
 */
export function sanitizeObjectId(id: string): Types.ObjectId | null {
  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    // Remove any potentially dangerous characters
    const sanitizedId = id.replace(/[^\w]/g, '');
    
    if (!Types.ObjectId.isValid(sanitizedId)) {
      return null;
    }

    return new Types.ObjectId(sanitizedId);
  } catch (error) {
    return null;
  }
}

/**
 * Sanitizes sort parameters to prevent injection
 */
export function sanitizeSortParameter(sort: any): any {
  if (!sort || typeof sort !== 'object') {
    return {};
  }

  const sanitized: any = {};
  const allowedSortValues = [1, -1, 'asc', 'desc'];

  for (const [field, direction] of Object.entries(sort)) {
    // Only allow valid field names (no $ operators or prototype pollution)
    if (field.startsWith('$') || 
        field === '__proto__' || 
        field === 'constructor' || 
        field === 'prototype') {
      continue;
    }

    // Only allow valid sort directions
    if (!allowedSortValues.includes(direction)) {
      continue;
    }

    // Limit field name length to prevent abuse
    if (field.length > 50) {
      continue;
    }

    sanitized[field] = direction;
  }

  return sanitized;
}

/**
 * Validates pagination parameters
 */
export function sanitizePaginationParams(page?: number, limit?: number) {
  const DEFAULT_PAGE = 1;
  const DEFAULT_LIMIT = 20;
  const MAX_LIMIT = 100;

  const sanitizedPage = Math.max(1, Math.floor(Number(page) || DEFAULT_PAGE));
  const sanitizedLimit = Math.min(
    MAX_LIMIT, 
    Math.max(1, Math.floor(Number(limit) || DEFAULT_LIMIT))
  );

  return {
    page: sanitizedPage,
    limit: sanitizedLimit,
    skip: (sanitizedPage - 1) * sanitizedLimit
  };
}

/**
 * Removes dangerous fields from user input
 */
export function sanitizeUserInput(input: any): any {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeUserInput);
  }

  if (typeof input === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(input)) {
      // Remove prototype pollution vectors
      if (key === '__proto__' || 
          key === 'constructor' || 
          key === 'prototype' ||
          key.startsWith('$')) {
        continue;
      }

      // Recursively sanitize nested objects
      sanitized[key] = sanitizeUserInput(value);
    }

    return sanitized;
  }

  return input;
}

/**
 * Security headers for database operations
 */
export const MONGOOSE_SECURITY_OPTIONS = {
  // Disable automatic index creation in production
  autoIndex: process.env.NODE_ENV !== 'production',
  
  // Use strict mode to prevent flexible schema
  strict: true,
  
  // Disable version key to prevent version conflicts
  versionKey: false,
  
  // Set collection options
  collection: {
    // Use strict mode for collections
    strict: true
  }
};

/**
 * Safe aggregation pipeline builder
 */
export function buildSafeAggregationPipeline(stages: any[]): any[] {
  const safePipeline: any[] = [];
  
  for (const stage of stages) {
    if (!stage || typeof stage !== 'object') {
      continue;
    }

    // Only allow safe aggregation stages
    const stageKeys = Object.keys(stage);
    const safeStages = [
      '$match', '$project', '$sort', '$limit', '$skip', '$group', 
      '$unwind', '$lookup', '$addFields', '$count', '$facet'
    ];

    const isStageAllowed = stageKeys.every(key => safeStages.includes(key));
    
    if (isStageAllowed) {
      safePipeline.push(sanitizeMongoQuery(stage));
    }
  }

  return safePipeline;
}

/**
 * Input validation middleware for Express routes
 */
export function validateDatabaseInput(req: any, res: any, next: any) {
  try {
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeMongoQuery(req.query);
    }

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeUserInput(req.body);
    }

    // Sanitize params
    if (req.params) {
      req.params = sanitizeUserInput(req.params);
    }

    next();
  } catch (error) {
    console.error('Database input validation error:', error);
    res.status(400).json({ 
      error: 'Invalid input data', 
      code: 'VALIDATION_ERROR' 
    });
  }
}

/**
 * Mongoose plugin to add security measures
 */
export function mongooseSecurityPlugin(schema: any) {
  // Add pre-save middleware to sanitize data
  schema.pre('save', function(next: any) {
    try {
      // Sanitize the document before saving
      const sanitized = sanitizeUserInput(this.toObject());
      Object.assign(this, sanitized);
      next();
    } catch (error) {
      next(error);
    }
  });

  // Add pre-find middleware to sanitize queries
  schema.pre(['find', 'findOne', 'findOneAndUpdate'], function(next: any) {
    try {
      // Sanitize the query
      const sanitizedQuery = sanitizeMongoQuery(this.getQuery());
      this.setQuery(sanitizedQuery);
      next();
    } catch (error) {
      next(error);
    }
  });
}