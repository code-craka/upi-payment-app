/**
 * Database Migration Utility for UPI Payment System
 * 
 * Ensures all collections, indexes, and constraints are properly set up
 * 
 * Author: Sayem Abdullah Rihan (@code-craka)
 * Contact: hello@techsci.io
 */

import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'
import { UserModel } from '@/lib/db/models/User'
import { AuditLogModel } from '@/lib/db/models/AuditLog'

interface MigrationResult {
  collection: string
  status: 'success' | 'error'
  message: string
  indexes?: string[]
}

/**
 * Run all database migrations
 */
export async function runMigrations(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = []

  try {
    await connectDB()

    // Migrate Order collection
    results.push(await migrateOrderCollection())

    // Migrate User collection
    results.push(await migrateUserCollection())

    // Migrate AuditLog collection
    results.push(await migrateAuditLogCollection())

    // Create additional indexes if needed
    results.push(await createPerformanceIndexes())

    return results

  } catch (error) {
    console.error('❌ Migration failed:', error)
    results.push({
      collection: 'migration',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return results
  }
}

/**
 * Migrate Order collection and indexes
 */
async function migrateOrderCollection(): Promise<MigrationResult> {
  try {
    // Ensure the model is registered and create collection if needed
    await OrderModel.createCollection()

    // Create indexes
    const indexes = []
    
    // Basic indexes
    await OrderModel.collection.createIndex({ orderId: 1 }, { unique: true })
    indexes.push('orderId_1_unique')

    await OrderModel.collection.createIndex({ status: 1, expiresAt: 1 })
    indexes.push('status_1_expiresAt_1')

    await OrderModel.collection.createIndex({ createdBy: 1, createdAt: -1 })
    indexes.push('createdBy_1_createdAt_-1')

    await OrderModel.collection.createIndex({ utrNumber: 1 }, { sparse: true })
    indexes.push('utrNumber_1_sparse')

    // Performance indexes for queries
    await OrderModel.collection.createIndex({ status: 1 })
    indexes.push('status_1')

    await OrderModel.collection.createIndex({ expiresAt: 1 })
    indexes.push('expiresAt_1')

    return {
      collection: 'orders',
      status: 'success',
      message: 'Order collection and indexes created successfully',
      indexes,
    }

  } catch (error) {
    return {
      collection: 'orders',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Migrate User collection and indexes
 */
async function migrateUserCollection(): Promise<MigrationResult> {
  try {
    // Ensure the model is registered and create collection if needed
    await UserModel.createCollection()

    // Create indexes
    const indexes = []
    
    await UserModel.collection.createIndex({ clerkId: 1 }, { unique: true })
    indexes.push('clerkId_1_unique')

    await UserModel.collection.createIndex({ email: 1 }, { unique: true })
    indexes.push('email_1_unique')

    await UserModel.collection.createIndex({ role: 1 })
    indexes.push('role_1')

    return {
      collection: 'users',
      status: 'success',
      message: 'User collection and indexes created successfully',
      indexes,
    }

  } catch (error) {
    return {
      collection: 'users',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Migrate AuditLog collection and indexes
 */
async function migrateAuditLogCollection(): Promise<MigrationResult> {
  try {
    // Ensure the model is registered and create collection if needed
    await AuditLogModel.createCollection()

    // Create indexes
    const indexes = []
    
    await AuditLogModel.collection.createIndex({ timestamp: -1 })
    indexes.push('timestamp_-1')

    await AuditLogModel.collection.createIndex({ userId: 1, timestamp: -1 })
    indexes.push('userId_1_timestamp_-1')

    await AuditLogModel.collection.createIndex({ action: 1, timestamp: -1 })
    indexes.push('action_1_timestamp_-1')

    await AuditLogModel.collection.createIndex({ entityType: 1, entityId: 1 })
    indexes.push('entityType_1_entityId_1')

    return {
      collection: 'auditlogs',
      status: 'success',
      message: 'AuditLog collection and indexes created successfully',
      indexes,
    }

  } catch (error) {
    return {
      collection: 'auditlogs',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create additional performance indexes
 */
async function createPerformanceIndexes(): Promise<MigrationResult> {
  try {
    const indexes = []

    // Compound index for common Order queries
    await OrderModel.collection.createIndex({ 
      createdBy: 1, 
      status: 1, 
      createdAt: -1 
    })
    indexes.push('createdBy_1_status_1_createdAt_-1')

    // Text index for Order description search
    await OrderModel.collection.createIndex({ 
      description: 'text',
      customerName: 'text',
      customerEmail: 'text'
    })
    indexes.push('text_search_orders')

    return {
      collection: 'performance',
      status: 'success',
      message: 'Performance indexes created successfully',
      indexes,
    }

  } catch (error) {
    return {
      collection: 'performance',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check database health and constraints
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'warning' | 'error'
  checks: Array<{
    name: string
    status: 'pass' | 'fail'
    message: string
    details?: any
  }>
}> {
  const checks = []

  try {
    await connectDB()

    // Check connection
    checks.push({
      name: 'Database Connection',
      status: 'pass',
      message: 'Successfully connected to MongoDB',
    })

    // Check collections exist
    const collections = await OrderModel.db.listCollections().toArray()
    const collectionNames = collections.map(c => c.name)
    
    const requiredCollections = ['orders', 'users', 'auditlogs']
    for (const collectionName of requiredCollections) {
      if (collectionNames.includes(collectionName)) {
        checks.push({
          name: `Collection: ${collectionName}`,
          status: 'pass',
          message: `Collection ${collectionName} exists`,
        })
      } else {
        checks.push({
          name: `Collection: ${collectionName}`,
          status: 'fail',
          message: `Collection ${collectionName} missing`,
        })
      }
    }

    // Check indexes
    const orderIndexes = await OrderModel.collection.indexes()
    checks.push({
      name: 'Order Indexes',
      status: orderIndexes.length > 5 ? 'pass' : 'fail',
      message: `Found ${orderIndexes.length} indexes on orders collection`,
      details: orderIndexes.map(idx => idx.name),
    })

    // Test basic operations
    await OrderModel.findOne({}).limit(1)
    checks.push({
      name: 'Database Read Operation',
      status: 'pass',
      message: 'Successfully performed read operation',
    })

    // Check validation
    try {
      await OrderModel.create({
        orderId: 'test-invalid',
        amount: -1, // Should fail validation
        description: 'Test',
        upiId: 'invalid-upi',
        createdBy: 'test',
        expiresAt: new Date(),
      })
      checks.push({
        name: 'Schema Validation',
        status: 'fail',
        message: 'Schema validation is not working properly',
      })
    } catch {
      checks.push({
        name: 'Schema Validation',
        status: 'pass',
        message: 'Schema validation is working correctly',
      })
    }

    const failedChecks = checks.filter(c => c.status === 'fail').length
    const status = failedChecks === 0 ? 'healthy' : failedChecks <= 2 ? 'warning' : 'error'

    return { status, checks }

  } catch (error) {
    checks.push({
      name: 'Database Health Check',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    return { status: 'error', checks }
  }
}

/**
 * Clean up expired orders (maintenance task)
 */
export async function cleanupExpiredOrders(): Promise<{
  expiredCount: number
  deletedCount: number
}> {
  await connectDB()

  // Mark expired orders
  const expiredCount = await OrderModel.markExpiredOrders()

  // Optionally delete very old expired orders (older than 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const deleteResult = await OrderModel.deleteMany({
    status: 'expired',
    expiresAt: { $lt: thirtyDaysAgo },
  })

  return {
    expiredCount,
    deletedCount: deleteResult.deletedCount || 0,
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  collections: Array<{
    name: string
    documentCount: number
    indexCount: number
    size: string
  }>
  totalSize: string
}> {
  await connectDB()

  const collections = []
  const collectionNames = ['orders', 'users', 'auditlogs']

  for (const name of collectionNames) {
    try {
      const collection = OrderModel.db.collection(name)
      const documentCount = await collection.countDocuments()
      const indexes = await collection.indexes()
      const stats = await collection.stats()
      
      collections.push({
        name,
        documentCount,
        indexCount: indexes.length,
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      })
    } catch (error) {
      collections.push({
        name,
        documentCount: 0,
        indexCount: 0,
        size: '0 MB',
      })
    }
  }

  const dbStats = await OrderModel.db.stats()
  const totalSize = `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`

  return { collections, totalSize }
}