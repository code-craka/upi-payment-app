/**
 * Fallback Authentication Strategies
 * 
 * Provides robust fallback strategies for the hybrid authentication system
 * to ensure user experience is preserved during partial service outages.
 */

import { redis } from '@/lib/redis';
import { currentUser, type User } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db/connection';
import { UserModel } from '@/lib/db/models/User';
import { withTimeoutAndDegradation } from './timeout-wrappers';
import { OPERATION_CONFIGS } from './timeout-config';
import { performanceMonitor } from './performance-monitor';
import type { FallbackStrategy } from './graceful-degradation-service';

export interface AuthContext {
  userId?: string;
  role?: string;
  email?: string;
  isAuthenticated: boolean;
  source: 'redis' | 'clerk' | 'database' | 'cache' | 'degraded';
  cached: boolean;
  latency: number;
  fallbackLevel: number; // 0 = primary, 1+ = fallback level
}

export interface DegradedAuthMode {
  allowCachedRoles: boolean;
  allowStaleData: boolean;
  maxStaleAgeMinutes: number;
  allowReadOnlyMode: boolean;
  allowGuestMode: boolean;
  cacheExtendedTTL: number; // Extended TTL for emergencies
}

class FallbackAuthService {
  private static instance: FallbackAuthService;
  private degradedMode: DegradedAuthMode = {
    allowCachedRoles: true,
    allowStaleData: true,
    maxStaleAgeMinutes: 30,
    allowReadOnlyMode: true,
    allowGuestMode: false,
    cacheExtendedTTL: 3600 // 1 hour
  };
  
  private constructor() {}
  
  public static getInstance(): FallbackAuthService {
    if (!FallbackAuthService.instance) {
      FallbackAuthService.instance = new FallbackAuthService();
    }
    return FallbackAuthService.instance;
  }
  
  /**
   * Main authentication method with comprehensive fallback chain
   */
  public async authenticate(userId?: string): Promise<AuthContext> {
    const startTime = performance.now();
    
    // Create fallback strategies in priority order
    const fallbackStrategies: FallbackStrategy<AuthContext>[] = [
      {
        name: 'redis-cache',
        priority: 1,
        canRetry: true,
        execute: () => this.authenticateFromRedis(userId)
      },
      {
        name: 'clerk-api',
        priority: 2,
        canRetry: true,
        execute: () => this.authenticateFromClerk(userId)
      },
      {
        name: 'database',
        priority: 3,
        canRetry: false,
        execute: () => this.authenticateFromDatabase(userId)
      },
      {
        name: 'stale-cache',
        priority: 4,
        canRetry: false,
        execute: () => this.authenticateFromStaleCache(userId)
      },
      {
        name: 'degraded-mode',
        priority: 5,
        canRetry: false,
        execute: () => this.authenticateInDegradedMode(userId)
      }
    ];
    
    try {
      // Try primary strategy first (Redis)
      return await this.tryFallbackStrategies(fallbackStrategies, startTime);
    } catch (error) {
      console.error('All authentication strategies failed:', error);
      
      // Final emergency fallback
      const latency = performance.now() - startTime;
      performanceMonitor.recordMetric({
        operationName: 'auth_emergency_fallback',
        service: 'auth',
        duration: latency,
        timestamp: new Date(),
        success: false,
        errorType: 'AuthenticationFailure',
        fallbackUsed: true
      });
      
      return {
        isAuthenticated: false,
        source: 'degraded',
        cached: false,
        latency,
        fallbackLevel: 5
      };
    }
  }
  
  /**
   * Try fallback strategies in order until one succeeds
   */
  private async tryFallbackStrategies(
    strategies: FallbackStrategy<AuthContext>[],
    startTime: number
  ): Promise<AuthContext> {
    const errors: Error[] = [];
    
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      
      try {
        console.log(`Trying authentication strategy: ${strategy.name} (priority ${strategy.priority})`);
        
        const result = await withTimeoutAndDegradation(
          strategy.execute,
          {
            operationConfig: OPERATION_CONFIGS.CLERK_AUTH_CHECK,
            enableGracefulDegradation: false, // We're handling fallbacks ourselves
            timeoutMessage: `Authentication strategy ${strategy.name} timed out`
          }
        );
        
        // Add fallback level to result
        const finalResult = {
          ...result,
          latency: performance.now() - startTime,
          fallbackLevel: i
        };
        
        // Record successful authentication
        performanceMonitor.recordMetric({
          operationName: `auth_${strategy.name}`,
          service: 'auth',
          duration: finalResult.latency,
          timestamp: new Date(),
          success: true,
          fallbackUsed: i > 0
        });
        
        console.log(`Authentication successful using strategy: ${strategy.name}`);
        return finalResult;
        
      } catch (error) {
        errors.push(error as Error);
        console.warn(`Authentication strategy ${strategy.name} failed:`, error);
        
        // Record failed attempt
        performanceMonitor.recordMetric({
          operationName: `auth_${strategy.name}`,
          service: 'auth',
          duration: performance.now() - startTime,
          timestamp: new Date(),
          success: false,
          errorType: (error as Error).constructor.name,
          fallbackUsed: i > 0
        });
        
        // Continue to next strategy
      }
    }
    
    // All strategies failed
    throw new Error(`All authentication strategies failed: ${errors.map(e => e.message).join(', ')}`);
  }
  
  /**
   * Primary: Authenticate from Redis cache
   */
  private async authenticateFromRedis(userId?: string): Promise<AuthContext> {
    if (!userId) {
      // Try to get current user ID from Clerk first
      const user = await currentUser();
      userId = user?.id;
    }
    
    if (!userId) {
      throw new Error('No user ID available for Redis authentication');
    }
    
    const roleKey = `user_role:${userId}`;
    const role = await redis.get(roleKey);
    
    if (!role) {
      throw new Error('No cached role found in Redis');
    }
    
    // Get additional cached user data if available
    const userDataKey = `user_data:${userId}`;
    const cachedUserData = await redis.get(userDataKey);
    const userData = cachedUserData ? JSON.parse(cachedUserData as string) : {};
    
    return {
      userId,
      role: role as string,
      email: userData.email,
      isAuthenticated: true,
      source: 'redis',
      cached: true,
      latency: 0, // Will be set by caller
      fallbackLevel: 0
    };
  }
  
  /**
   * Secondary: Authenticate from Clerk API
   */
  private async authenticateFromClerk(userId?: string): Promise<AuthContext> {
    const user = await currentUser();
    
    if (!user) {
      throw new Error('No authenticated user from Clerk');
    }
    
    const role = user.publicMetadata?.role as string || 'user';
    
    // Cache the result for future use
    await this.cacheUserData(user.id, {
      role,
      email: user.emailAddresses[0]?.emailAddress,
      updatedAt: new Date().toISOString()
    });
    
    return {
      userId: user.id,
      role,
      email: user.emailAddresses[0]?.emailAddress,
      isAuthenticated: true,
      source: 'clerk',
      cached: false,
      latency: 0, // Will be set by caller
      fallbackLevel: 1
    };
  }
  
  /**
   * Tertiary: Authenticate from database
   */
  private async authenticateFromDatabase(userId?: string): Promise<AuthContext> {
    if (!userId) {
      throw new Error('No user ID available for database authentication');
    }
    
    await connectDB();
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found in database');
    }
    
    // Cache the result
    await this.cacheUserData(userId, {
      role: user.role,
      email: user.email,
      updatedAt: new Date().toISOString()
    });
    
    return {
      userId,
      role: user.role,
      email: user.email,
      isAuthenticated: true,
      source: 'database',
      cached: false,
      latency: 0, // Will be set by caller
      fallbackLevel: 2
    };
  }
  
  /**
   * Quaternary: Authenticate from stale cache
   */
  private async authenticateFromStaleCache(userId?: string): Promise<AuthContext> {
    if (!userId || !this.degradedMode.allowStaleData) {
      throw new Error('Stale cache authentication not allowed or no user ID');
    }
    
    const staleDataKey = `stale_user_data:${userId}`;
    const staleData = await redis.get(staleDataKey);
    
    if (!staleData) {
      throw new Error('No stale cached data available');
    }
    
    const userData = JSON.parse(staleData as string);
    const updatedAt = new Date(userData.updatedAt);
    const ageMinutes = (Date.now() - updatedAt.getTime()) / (1000 * 60);
    
    if (ageMinutes > this.degradedMode.maxStaleAgeMinutes) {
      throw new Error(`Stale data too old: ${ageMinutes} minutes (max: ${this.degradedMode.maxStaleAgeMinutes})`);
    }
    
    console.warn(`Using stale cached data (${ageMinutes.toFixed(1)} minutes old) for user ${userId}`);
    
    return {
      userId,
      role: userData.role,
      email: userData.email,
      isAuthenticated: true,
      source: 'cache',
      cached: true,
      latency: 0, // Will be set by caller
      fallbackLevel: 3
    };
  }
  
  /**
   * Final: Authenticate in degraded mode
   */
  private async authenticateInDegradedMode(userId?: string): Promise<AuthContext> {
    if (this.degradedMode.allowGuestMode) {
      console.warn('Falling back to guest mode authentication');
      
      return {
        userId: userId || 'guest',
        role: 'guest',
        isAuthenticated: false,
        source: 'degraded',
        cached: false,
        latency: 0, // Will be set by caller
        fallbackLevel: 4
      };
    }
    
    if (this.degradedMode.allowReadOnlyMode && userId) {
      console.warn('Falling back to read-only mode for existing user');
      
      return {
        userId,
        role: 'readonly',
        isAuthenticated: true,
        source: 'degraded',
        cached: false,
        latency: 0, // Will be set by caller
        fallbackLevel: 4
      };
    }
    
    throw new Error('Degraded mode authentication not configured');
  }
  
  /**
   * Cache user data for future fallback use
   */
  private async cacheUserData(
    userId: string,
    userData: { role: string; email?: string; updatedAt: string }
  ): Promise<void> {
    try {
      // Cache fresh data with standard TTL
      const userDataKey = `user_data:${userId}`;
      await redis.setex(userDataKey, 300, JSON.stringify(userData)); // 5 minutes
      
      // Cache as stale data with extended TTL for emergency use
      const staleDataKey = `stale_user_data:${userId}`;
      await redis.setex(staleDataKey, this.degradedMode.cacheExtendedTTL, JSON.stringify(userData));
      
      // Cache role separately for faster access
      const roleKey = `user_role:${userId}`;
      await redis.setex(roleKey, 300, userData.role);
      
    } catch (error) {
      console.warn('Failed to cache user data:', error);
      // Don't throw - caching failure shouldn't break authentication
    }
  }
  
  /**
   * Check if authentication result should be trusted for sensitive operations
   */
  public shouldTrustForSensitiveOperations(authContext: AuthContext): boolean {
    // Only trust fresh data from primary sources
    if (authContext.fallbackLevel > 1) return false;
    if (authContext.source === 'cache' && !authContext.cached) return false;
    if (authContext.latency > 5000) return false; // Very slow responses are suspicious
    
    return authContext.isAuthenticated;
  }
  
  /**
   * Get user-friendly degradation explanation
   */
  public getDegradationExplanation(authContext: AuthContext): string {
    switch (authContext.source) {
      case 'redis':
        return 'Authentication using fast cache';
      case 'clerk':
        return 'Authentication using primary service';
      case 'database':
        return 'Authentication using backup database';
      case 'cache':
        return 'Authentication using cached data - some features may be limited';
      case 'degraded':
        if (authContext.role === 'guest') {
          return 'Running in guest mode - please try again later for full access';
        }
        if (authContext.role === 'readonly') {
          return 'Running in read-only mode - modifications are temporarily disabled';
        }
        return 'Service temporarily degraded - some features may be limited';
      default:
        return 'Authentication status unknown';
    }
  }
  
  /**
   * Configure degraded mode settings
   */
  public configureDegradedMode(config: Partial<DegradedAuthMode>): void {
    this.degradedMode = { ...this.degradedMode, ...config };
    console.log('Degraded mode configuration updated:', this.degradedMode);
  }
  
  /**
   * Get current degraded mode configuration
   */
  public getDegradedModeConfig(): DegradedAuthMode {
    return { ...this.degradedMode };
  }
  
  /**
   * Health check for fallback authentication system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      redisAvailable: boolean;
      clerkAvailable: boolean;
      databaseAvailable: boolean;
      staleCacheSize: number;
      degradedModeEnabled: boolean;
    };
  }> {
    const checks = await Promise.allSettled([
      // Test Redis
      redis.ping().then(() => true).catch(() => false),
      
      // Test Clerk
      currentUser().then(() => true).catch(() => false),
      
      // Test Database
      connectDB().then(() => true).catch(() => false),
      
      // Check stale cache size
      redis.keys('stale_user_data:*').then(keys => keys.length).catch(() => 0)
    ]);
    
    const redisAvailable = checks[0].status === 'fulfilled' && checks[0].value === true;
    const clerkAvailable = checks[1].status === 'fulfilled' && checks[1].value === true;
    const databaseAvailable = checks[2].status === 'fulfilled' && checks[2].value === true;
    const staleCacheSize = checks[3].status === 'fulfilled' ? checks[3].value as number : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!redisAvailable && !clerkAvailable && !databaseAvailable) {
      status = 'unhealthy';
    } else if (!redisAvailable || !clerkAvailable) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        redisAvailable,
        clerkAvailable,
        databaseAvailable,
        staleCacheSize,
        degradedModeEnabled: this.degradedMode.allowStaleData || this.degradedMode.allowReadOnlyMode
      }
    };
  }
}

/**
 * Singleton instance
 */
export const fallbackAuth = FallbackAuthService.getInstance();

/**
 * Convenience function to get authentication context with fallbacks
 */
export async function getAuthContextWithFallbacks(userId?: string): Promise<AuthContext> {
  return fallbackAuth.authenticate(userId);
}

/**
 * Convenience function to check if operation should be allowed based on auth context
 */
export function shouldAllowOperation(
  authContext: AuthContext,
  operationType: 'read' | 'write' | 'admin' | 'sensitive'
): boolean {
  if (!authContext.isAuthenticated && operationType !== 'read') {
    return false;
  }
  
  // Guest mode restrictions
  if (authContext.role === 'guest') {
    return operationType === 'read';
  }
  
  // Read-only mode restrictions
  if (authContext.role === 'readonly') {
    return operationType === 'read';
  }
  
  // Sensitive operations require fresh authentication
  if (operationType === 'sensitive' || operationType === 'admin') {
    return fallbackAuth.shouldTrustForSensitiveOperations(authContext);
  }
  
  // Standard role-based checks for admin operations
  if (operationType === 'admin') {
    return (authContext.role === 'admin' || authContext.role === 'super_admin') &&
           fallbackAuth.shouldTrustForSensitiveOperations(authContext);
  }
  
  return true;
}