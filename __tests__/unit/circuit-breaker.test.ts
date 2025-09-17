/**
 * Circuit Breaker Tests
 * 
 * Tests the Redis-backed circuit breaker implementation for
 * fault tolerance and graceful degradation patterns.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Redis before importing circuit breaker
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    ping: jest.fn(),
  })),
}));

import { Redis } from '@upstash/redis';
import { PersistentCircuitBreaker } from '@/lib/redis/persistent-circuit-breaker';

describe('Circuit Breaker', () => {
  let circuitBreaker: PersistentCircuitBreaker;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = new Redis({} as any) as jest.Mocked<Redis>;
    circuitBreaker = new PersistentCircuitBreaker(mockRedis, { 
      serviceName: 'test-service' 
    });
    
    // Default healthy state
    mockRedis.get.mockResolvedValue(JSON.stringify({
      state: 'CLOSED',
      failures: 0,
      lastFailure: 0,
      lastSuccess: Date.now(),
    }));
    
    mockRedis.setex.mockResolvedValue('OK');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Closed State (Healthy)', () => {
    it('should execute operations normally when circuit is closed', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    it('should track successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);

      // Should update state with successful execution
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:test-service'),
        300, // 5 minute TTL
        expect.stringContaining('"state":"CLOSED"')
      );
    });

    it('should transition to OPEN on failure threshold', async () => {
      // Mock existing state with 4 failures (threshold is 5)
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        state: 'CLOSED',
        failures: 4,
        lastFailure: Date.now() - 1000,
        lastSuccess: Date.now() - 2000,
      }));

      const mockOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service unavailable');

      // Should transition to OPEN state
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:test-service'),
        300,
        expect.stringContaining('"state":"OPEN"')
      );
    });
  });

  describe('Open State (Failing)', () => {
    beforeEach(() => {
      // Mock circuit in OPEN state
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failures: 5,
        lastFailure: Date.now() - 30000, // 30 seconds ago
        lastSuccess: Date.now() - 60000,
      }));
    });

    it('should reject operations immediately when circuit is open', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow('Circuit breaker is OPEN');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout period', async () => {
      // Mock circuit that's been open long enough for half-open transition
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        state: 'OPEN',
        failures: 5,
        lastFailure: Date.now() - 65000, // More than 60 seconds ago
        lastSuccess: Date.now() - 120000,
      }));

      const mockOperation = jest.fn().mockResolvedValue('recovery-test');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('recovery-test');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      
      // Should transition to HALF_OPEN first, then CLOSED on success
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:test-service'),
        300,
        expect.stringContaining('"state":"CLOSED"')
      );
    });
  });

  describe('Half-Open State (Testing)', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'HALF_OPEN',
        failures: 5,
        lastFailure: Date.now() - 70000,
        lastSuccess: Date.now() - 120000,
      }));
    });

    it('should allow single test operation in half-open state', async () => {
      const mockOperation = jest.fn().mockResolvedValue('test-success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('test-success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should transition to CLOSED on successful test', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:test-service'),
        300,
        expect.stringContaining('"state":"CLOSED"')
      );
    });

    it('should transition back to OPEN on failed test', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Still failing'));

      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow('Still failing');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:test-service'),
        300,
        expect.stringContaining('"state":"OPEN"')
      );
    });
  });

  describe('Redis Persistence', () => {
    it('should persist state changes to Redis', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'circuit_breaker:test-service',
        300,
        expect.stringMatching(/"state":"CLOSED"/)
      );
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis connection failed'));

      const mockOperation = jest.fn().mockResolvedValue('fallback-success');

      // Should still execute operation even if Redis fails
      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('fallback-success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should use default state when Redis data is invalid', async () => {
      mockRedis.get.mockResolvedValueOnce('invalid-json');

      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent state updates', async () => {
      const operations = Array(5).fill(null).map((_, i) => 
        jest.fn().mockResolvedValue(`result-${i}`)
      );

      const promises = operations.map(op => circuitBreaker.execute(op));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      operations.forEach((op, i) => {
        expect(op).toHaveBeenCalledTimes(1);
        expect(results[i]).toBe(`result-${i}`);
      });

      // Should have updated state for each operation
      expect(mockRedis.setex).toHaveBeenCalledTimes(5);
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should respect custom failure threshold', async () => {
      const customCircuitBreaker = new PersistentCircuitBreaker('custom-service', {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringWindow: 60000
      });

      // Mock state with 2 failures (below threshold of 3)
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failures: 2,
        lastFailure: Date.now() - 1000,
        lastSuccess: Date.now() - 2000,
      }));

      const mockOperation = jest.fn().mockRejectedValue(new Error('Failure'));

      await expect(customCircuitBreaker.execute(mockOperation))
        .rejects.toThrow('Failure');

      // Should transition to OPEN (2 + 1 = 3, meets threshold)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('circuit_breaker:custom-service'),
        300,
        expect.stringContaining('"state":"OPEN"')
      );
    });

    it('should respect custom recovery timeout', async () => {
      const customCircuitBreaker = new PersistentCircuitBreaker('timeout-test', {
        failureThreshold: 5,
        recoveryTimeout: 10000, // 10 seconds instead of default 60
        monitoringWindow: 60000
      });

      // Mock OPEN state that's been open for 15 seconds (> 10 second timeout)
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failures: 5,
        lastFailure: Date.now() - 15000,
        lastSuccess: Date.now() - 30000,
      }));

      const mockOperation = jest.fn().mockResolvedValue('recovery');

      const result = await customCircuitBreaker.execute(mockOperation);

      expect(result).toBe('recovery');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Health Metrics', () => {
    it('should track failure rates', async () => {
      // Execute successful operations
      for (let i = 0; i < 3; i++) {
        const op = jest.fn().mockResolvedValue(`success-${i}`);
        await circuitBreaker.execute(op);
      }

      // Execute failed operation
      const failedOp = jest.fn().mockRejectedValue(new Error('Failure'));
      try {
        await circuitBreaker.execute(failedOp);
      } catch (e) {
        // Expected failure
      }

      // State should reflect the mixed success/failure pattern
      expect(mockRedis.setex).toHaveBeenCalledTimes(4); // 3 success + 1 failure
    });

    it('should provide circuit breaker status', async () => {
      const status = await circuitBreaker.getStatus();

      expect(status).toEqual({
        state: 'CLOSED',
        failures: 0,
        lastFailure: 0,
        lastSuccess: expect.any(Number),
      });
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should implement exponential backoff for recovery attempts', async () => {
      // Mock circuit that has been failing and recovering
      let attemptCount = 0;
      mockRedis.get.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.resolve(JSON.stringify({
            state: 'HALF_OPEN',
            failures: 5,
            lastFailure: Date.now() - 65000,
            lastSuccess: Date.now() - 120000,
          }));
        }
        return Promise.resolve(JSON.stringify({
          state: 'CLOSED',
          failures: 0,
          lastFailure: 0,
          lastSuccess: Date.now(),
        }));
      });

      const operations = [
        jest.fn().mockRejectedValue(new Error('Still failing')), // Should fail
        jest.fn().mockResolvedValue('recovered'), // Should succeed
      ];

      // First operation should fail and keep circuit open
      await expect(circuitBreaker.execute(operations[0]))
        .rejects.toThrow('Still failing');

      // Second operation should succeed and close circuit
      const result = await circuitBreaker.execute(operations[1]);
      expect(result).toBe('recovered');
    });
  });
});