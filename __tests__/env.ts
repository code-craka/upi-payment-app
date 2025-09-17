// Test environment setup
// Load environment variables for testing
process.env.NODE_ENV = 'test';
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://test-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test-token';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'test-clerk-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/test';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';

// Mock Next.js environment
global.process.env.NEXT_RUNTIME = 'nodejs';

export {};