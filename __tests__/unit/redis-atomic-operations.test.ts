/**
 * Redis Atomic Operations Tests
 * 
 * Tests the atomic Lua script operations for role caching, invalidation,
 * and batch operations to prevent race conditions.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the Redis client before importing our modules
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
  })),
}));

// Mock circuit breaker
jest.mock('@/lib/redis/circuit-breaker', () => ({
  redisCircuitBreaker: {
    execute: jest.fn(async (fn: () => any) => await fn()),
  },
}));

import { Redis } from '@upstash/redis';
import { 
  cacheUserRole, 
  invalidateUserRole, 
  batchInvalidateRoles,
  getCachedUserRole,
  REDIS_KEYS,
  type RedisSessionData
} from '@/lib/redis';

describe('Redis Atomic Operations', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mocked Redis instance
    mockRedis = new Redis({} as any) as jest.Mocked<Redis>;
    
    // Setup default mock responses
    mockRedis.ping.mockResolvedValue('PONG');
    mockRedis.eval.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.incr.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cacheUserRole', () => {
    it('should cache user role with atomic version increment', async () => {
      const userId = 'test-user-123';
      const role = 'admin';
      const metadata = { source: 'test' };

      mockRedis.eval.mockResolvedValueOnce(5); // Mock version number

      await cacheUserRole(userId, role, metadata);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local version = redis.call(\'INCR\', KEYS[2])'),
        [
          REDIS_KEYS.USER_ROLE(userId),
          REDIS_KEYS.USER_ROLE_VERSION(userId),
          REDIS_KEYS.SESSION_SYNC(userId)
        ],
        expect.arrayContaining([
          expect.stringContaining('"role":"admin"'),
          '30',
          expect.any(String)
        ])
      );
    });

    it('should handle atomic operation failure gracefully', async () => {
      const userId = 'test-user-123';
      const role = 'admin';

      mockRedis.eval.mockRejectedValueOnce(new Error('Redis connection failed'));

      // Should not throw
      await expect(cacheUserRole(userId, role)).resolves.not.toThrow();
    });

    it('should enforce 30-second TTL consistently', async () => {
      const userId = 'test-user-123';
      const role = 'merchant';

      mockRedis.eval.mockResolvedValueOnce(1);

      await cacheUserRole(userId, role);

      // Verify the TTL is set to 30 seconds
      const call = mockRedis.eval.mock.calls[0];
      const args = call[2] as string[];
      expect(args[1]).toBe('30'); // TTL argument
    });
  });

  describe('invalidateUserRole', () => {
    it('should atomically invalidate user cache keys', async () => {
      const userId = 'test-user-123';

      mockRedis.eval.mockResolvedValueOnce(3); // Mock number of deleted keys

      await invalidateUserRole(userId);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call(\'DEL\', keys[i])'),
        [
          REDIS_KEYS.USER_ROLE(userId),
          REDIS_KEYS.SESSION_SYNC(userId),
          REDIS_KEYS.ROLE_CACHE(userId),
          REDIS_KEYS.INVALIDATION_LOG(userId)
        ],
        [expect.any(String)] // Timestamp
      );
    });

    it('should handle Redis failure during invalidation', async () => {
      const userId = 'test-user-123';

      mockRedis.eval.mockRejectedValueOnce(new Error('Network timeout'));

      // Should not throw
      await expect(invalidateUserRole(userId)).resolves.not.toThrow();
    });
  });

  describe('batchInvalidateRoles', () => {
    it('should atomically invalidate multiple user roles', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      mockRedis.eval.mockResolvedValueOnce(12); // 4 keys per user * 3 users

      await batchInvalidateRoles(userIds);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('for i = 1, userCount do'),
        [],
        [...userIds, expect.any(String)] // User IDs + timestamp
      );
    });

    it('should handle empty user list', async () => {
      const userIds: string[] = [];

      await batchInvalidateRoles(userIds);

      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it('should handle large batch sizes efficiently', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      mockRedis.eval.mockResolvedValueOnce(400); // All keys deleted

      await batchInvalidateRoles(userIds);

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      
      // Verify all user IDs are included in the args
      const args = mockRedis.eval.mock.calls[0][2] as string[];
      expect(args.slice(0, -1)).toEqual(userIds); // All userIds except timestamp
    });
  });

  describe('getCachedUserRole', () => {
    it('should retrieve cached role successfully', async () => {
      const userId = 'test-user-123';
      const cachedData: RedisSessionData = {
        userId,
        role: 'admin',
        lastSync: Date.now(),
        clerkSync: true,
        version: 1,
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await getCachedUserRole(userId);

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith(REDIS_KEYS.USER_ROLE(userId));
    });

    it('should return null for non-existent role', async () => {
      const userId = 'non-existent-user';

      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getCachedUserRole(userId);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(REDIS_KEYS.USER_ROLE(userId));
    });

    it('should handle invalid JSON gracefully', async () => {
      const userId = 'test-user-123';

      mockRedis.get.mockResolvedValueOnce('invalid-json');

      const result = await getCachedUserRole(userId);

      expect(result).toBeNull(); // Graceful fallback
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 'test-user-123';

      mockRedis.get.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await getCachedUserRole(userId);

      expect(result).toBeNull(); // Graceful fallback
    });

    it('should validate data integrity', async () => {
      const userId = 'test-user-123';
      const invalidData = { invalid: 'data' }; // Missing userId and role

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(invalidData));

      const result = await getCachedUserRole(userId);

      expect(result).toBeNull(); // Should reject invalid data
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent race conditions during concurrent role updates', async () => {
      const userId = 'test-user-123';
      const role1 = 'admin';
      const role2 = 'merchant';

      // Simulate concurrent operations
      const operation1 = cacheUserRole(userId, role1);
      const operation2 = cacheUserRole(userId, role2);

      // Both operations should use atomic Lua scripts
      mockRedis.eval.mockResolvedValue(1);

      await Promise.all([operation1, operation2]);

      // Verify both operations used atomic Lua scripts
      expect(mockRedis.eval).toHaveBeenCalledTimes(2);
      
      // Both calls should include version increment
      mockRedis.eval.mock.calls.forEach(call => {
        expect(call[0]).toContain('redis.call(\'INCR\', KEYS[2])');
      });
    });

    it('should maintain consistency during invalidation and caching', async () => {
      const userId = 'test-user-123';
      
      // Setup mocks for concurrent operations
      mockRedis.eval.mockResolvedValue(1);

      // Simulate concurrent invalidation and caching
      const invalidateOp = invalidateUserRole(userId);
      const cacheOp = cacheUserRole(userId, 'admin');

      await Promise.all([invalidateOp, cacheOp]);

      // Both operations should be atomic
      expect(mockRedis.eval).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete operations within reasonable time', async () => {
      const startTime = performance.now();
      
      mockRedis.eval.mockResolvedValueOnce(1);
      await cacheUserRole('test-user', 'admin');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Operations should complete quickly (mocked, but validates the pattern)
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle Redis timeout gracefully', async () => {
      const userId = 'test-user-123';

      // Simulate timeout
      mockRedis.eval.mockImplementationOnce(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      // Should not throw
      await expect(cacheUserRole(userId, 'admin')).resolves.not.toThrow();
    });
  });

  describe('REDIS_KEYS consistency', () => {
    it('should use consistent key patterns', () => {
      const userId = 'test-user-123';

      expect(REDIS_KEYS.USER_ROLE(userId)).toBe('user_role:test-user-123');
      expect(REDIS_KEYS.USER_ROLE_VERSION(userId)).toBe('user_role_version:test-user-123');
      expect(REDIS_KEYS.SESSION_SYNC(userId)).toBe('session_sync:test-user-123');
      expect(REDIS_KEYS.ROLE_CACHE(userId)).toBe('role_cache:test-user-123');
    });

    it('should handle special characters in user IDs', () => {
      const userId = 'user@example.com';

      expect(REDIS_KEYS.USER_ROLE(userId)).toBe('user_role:user@example.com');
      expect(REDIS_KEYS.USER_ROLE_VERSION(userId)).toBe('user_role_version:user@example.com');
    });
  });
});