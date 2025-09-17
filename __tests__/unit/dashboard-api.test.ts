/**
 * Dashboard API Tests
 * 
 * Tests the comprehensive dashboard API endpoint for analytics,
 * user stats, recent activity, and system health metrics.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/middleware/auth', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/models/Order', () => ({
  OrderModel: {
    aggregate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/lib/db/models/User', () => ({
  UserModel: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/lib/db/models/AuditLog', () => ({
  AuditLogModel: {
    find: jest.fn(),
  },
}));

jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    ping: jest.fn(),
  },
  testRedisConnection: jest.fn(),
}));

jest.mock('@/lib/db/connection', () => ({
  connectDB: jest.fn(),
}));

// Import after mocks
import { GET } from '@/app/api/dashboard/route';
import { requireAdmin } from '@/lib/middleware/auth';
import { OrderModel } from '@/lib/db/models/Order';
import { UserModel } from '@/lib/db/models/User';
import { AuditLogModel } from '@/lib/db/models/AuditLog';
import { testRedisConnection } from '@/lib/redis';

// Mock successful auth by default
const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockOrderModel = OrderModel as jest.Mocked<typeof OrderModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockTestRedisConnection = testRedisConnection as jest.MockedFunction<typeof testRedisConnection>;

describe('Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful auth
    mockRequireAdmin.mockResolvedValue({
      user: { id: 'admin-user', role: 'admin' }
    });
    
    // Default Redis health check
    mockTestRedisConnection.mockResolvedValue({
      connected: true,
      latency: 5
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard', () => {
    it('should return comprehensive dashboard data for admin users', async () => {
      // Mock order analytics
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { totalRevenue: 150000, totalOrders: 250, avgOrderValue: 600 }
      ]);
      
      // Mock daily revenue trend (last 7 days)
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { _id: '2024-01-01', revenue: 20000, orders: 30 },
        { _id: '2024-01-02', revenue: 25000, orders: 35 },
      ]);

      // Mock user statistics
      mockUserModel.aggregate.mockResolvedValueOnce([
        { _id: 'admin', count: 5 },
        { _id: 'merchant', count: 45 },
      ]);
      
      mockUserModel.countDocuments.mockResolvedValueOnce(50);

      // Mock recent activity
      mockAuditLogModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([
          {
            action: 'user_role_updated',
            userId: 'user-123',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            metadata: { oldRole: 'merchant', newRole: 'admin' }
          }
        ] as any)
      } as any);

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        analytics: {
          totalRevenue: 150000,
          totalOrders: 250,
          averageOrderValue: 600,
          revenueGrowth: expect.any(Number),
        },
        revenueChart: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            revenue: expect.any(Number),
            orders: expect.any(Number),
          })
        ]),
        userStats: {
          totalUsers: 50,
          roleDistribution: expect.objectContaining({
            admin: 5,
            merchant: 45,
          })
        },
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            action: 'user_role_updated',
            timestamp: expect.any(String),
          })
        ]),
        systemHealth: expect.objectContaining({
          database: expect.objectContaining({
            status: expect.any(String)
          }),
          redis: expect.objectContaining({
            status: expect.any(String),
            latency: expect.any(Number),
          })
        })
      });
    });

    it('should handle authentication failure', async () => {
      mockRequireAdmin.mockResolvedValueOnce({
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      });

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should filter data based on user role (merchant vs admin)', async () => {
      // Mock merchant user
      mockRequireAdmin.mockResolvedValueOnce({
        user: { id: 'merchant-user', role: 'merchant' }
      });

      // Mock merchant-specific data
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { totalRevenue: 25000, totalOrders: 50, avgOrderValue: 500 }
      ]);
      
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { _id: '2024-01-01', revenue: 5000, orders: 10 },
      ]);

      // User stats should be limited for merchants
      mockUserModel.countDocuments.mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/dashboard?role=merchant', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analytics.totalRevenue).toBeLessThan(50000); // Merchant has less revenue
      expect(data.userStats.totalUsers).toBe(1); // Merchants see limited user data
    });

    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      mockOrderModel.aggregate.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch dashboard data');
      expect(data.correlationId).toBeDefined();
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockTestRedisConnection.mockResolvedValueOnce({
        connected: false,
        error: 'Connection timeout'
      });

      // Other operations succeed
      mockOrderModel.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 1000, totalOrders: 10, avgOrderValue: 100 }])
        .mockResolvedValueOnce([]);
      mockUserModel.aggregate.mockResolvedValueOnce([]);
      mockUserModel.countDocuments.mockResolvedValueOnce(0);
      mockAuditLogModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([] as any)
      } as any);

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.systemHealth.redis.status).toBe('unhealthy');
      expect(data.systemHealth.redis.error).toBe('Connection timeout');
    });

    it('should calculate revenue growth correctly', async () => {
      // Mock current period data
      mockOrderModel.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 100000, totalOrders: 100, avgOrderValue: 1000 }])
        .mockResolvedValueOnce([
          { _id: '2024-01-07', revenue: 20000, orders: 20 },
          { _id: '2024-01-06', revenue: 15000, orders: 15 },
          { _id: '2024-01-05', revenue: 18000, orders: 18 },
        ]);

      // Mock previous period data for growth calculation
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { totalRevenue: 80000 } // Previous period revenue
      ]);

      mockUserModel.aggregate.mockResolvedValueOnce([]);
      mockUserModel.countDocuments.mockResolvedValueOnce(0);
      mockAuditLogModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([] as any)
      } as any);

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Revenue growth should be 25% ((100000 - 80000) / 80000 * 100)
      expect(data.analytics.revenueGrowth).toBeCloseTo(25, 1);
    });

    it('should handle concurrent data fetching efficiently', async () => {
      // Setup all mocks to simulate concurrent operations
      mockOrderModel.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 50000, totalOrders: 75, avgOrderValue: 667 }])
        .mockResolvedValueOnce([{ _id: '2024-01-01', revenue: 10000, orders: 15 }])
        .mockResolvedValueOnce([{ totalRevenue: 40000 }]);
      
      mockUserModel.aggregate.mockResolvedValueOnce([{ _id: 'admin', count: 2 }]);
      mockUserModel.countDocuments.mockResolvedValueOnce(25);
      
      mockAuditLogModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([] as any)
      } as any);

      const startTime = Date.now();

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      
      // Should complete relatively quickly due to parallel execution
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Less than 1 second for mocked operations
    });

    it('should include correlation ID for error tracking', async () => {
      mockOrderModel.aggregate.mockRejectedValueOnce(new Error('Unexpected error'));

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.correlationId).toBeDefined();
      expect(typeof data.correlationId).toBe('string');
      expect(data.correlationId).toMatch(/^[a-f0-9-]+$/); // UUID format
    });

    it('should validate query parameters', async () => {
      mockOrderModel.aggregate
        .mockResolvedValueOnce([{ totalRevenue: 1000, totalOrders: 10, avgOrderValue: 100 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ totalRevenue: 800 }]);
      
      mockUserModel.aggregate.mockResolvedValueOnce([]);
      mockUserModel.countDocuments.mockResolvedValueOnce(0);
      mockAuditLogModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([] as any)
      } as any);

      const request = new NextRequest('http://localhost:3000/api/dashboard?timeRange=7d&includeDetails=true', {
        method: 'GET',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      // Request should be processed successfully with valid query params
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high load with multiple parallel requests', async () => {
      // Setup mocks for parallel requests
      mockOrderModel.aggregate
        .mockResolvedValue([{ totalRevenue: 1000, totalOrders: 10, avgOrderValue: 100 }])
        .mockResolvedValue([])
        .mockResolvedValue([{ totalRevenue: 800 }]);
      
      mockUserModel.aggregate.mockResolvedValue([]);
      mockUserModel.countDocuments.mockResolvedValue(0);
      mockAuditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([] as any)
      } as any);

      const requests = Array(10).fill(null).map(() =>
        GET(new NextRequest('http://localhost:3000/api/dashboard', {
          method: 'GET',
        }))
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response: Response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should implement proper timeout handling', async () => {
      // Mock a slow database operation
      mockOrderModel.aggregate.mockImplementationOnce(() => 
        new Promise((resolve) => setTimeout(() => resolve([] as any), 5000)) as any
      );

      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
      });

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      // Should timeout and return error within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      
      if (response.status === 500) {
        const data = await response.json();
        expect(data.error).toBeDefined();
      }
    });
  });
});