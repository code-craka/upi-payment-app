/**
 * Simple Database Migration API for UPI Payment System
 * 
 * Ensures all collections and indexes are properly set up
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'

export async function GET(_request: NextRequest) {
  try {
    await connectDB()

    const results = []

    // Test Order model validation
    try {
      // Try to create a valid order to test the model
      const testOrder = new OrderModel({
        orderId: 'test-order-validation-' + Date.now(),
        amount: 100,
        description: 'Test order for validation',
        upiId: process.env.UPI_ID || 'merchant@paytm',
        status: 'pending',
        createdBy: 'system',
        expiresAt: new Date(Date.now() + 540000), // 9 minutes
      })

      await testOrder.validate()
      results.push({
        test: 'Order Model Validation',
        status: 'success',
        message: 'Order model validation working correctly',
      })

      // Clean up test order (don't save it)
      
    } catch (error) {
      results.push({
        test: 'Order Model Validation',
        status: 'error',
        message: error instanceof Error ? error.message : 'Validation error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Test database connection
    try {
      const orderCount = await OrderModel.countDocuments()
      results.push({
        test: 'Database Connection',
        status: 'success',
        message: `Connected successfully. Found ${orderCount} orders.`,
      })
    } catch (error) {
      results.push({
        test: 'Database Connection',
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection error',
      })
    }

    // Check indexes
    try {
      const indexes = await OrderModel.collection.getIndexes()
      results.push({
        test: 'Database Indexes',
        status: 'success',
        message: `Found ${Object.keys(indexes).length} indexes`,
        indexes: Object.keys(indexes),
      })
    } catch (error) {
      results.push({
        test: 'Database Indexes',
        status: 'error',
        message: error instanceof Error ? error.message : 'Index error',
      })
    }

    // Test environment variables
    const envCheck = {
      MONGODB_URI: !!process.env.MONGODB_URI,
      UPI_ID: !!process.env.UPI_ID,
      MERCHANT_NAME: !!process.env.MERCHANT_NAME,
    }

    results.push({
      test: 'Environment Variables',
      status: Object.values(envCheck).every(Boolean) ? 'success' : 'warning',
      message: 'Environment variables check',
      details: envCheck,
    })

    return NextResponse.json({
      success: true,
      message: 'Migration check completed',
      results,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Migration check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    await connectDB()

    const results = []

    // Create basic indexes if they don't exist
    try {
      // Ensure unique index on orderId
      await OrderModel.collection.createIndex({ orderId: 1 }, { unique: true })
      results.push('Created orderId unique index')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('orderId index already exists')
      } else {
        results.push(`Failed to create orderId index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      // Create status index
      await OrderModel.collection.createIndex({ status: 1 })
      results.push('Created status index')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('status index already exists')
      } else {
        results.push(`Failed to create status index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      // Create compound index for common queries
      await OrderModel.collection.createIndex({ createdBy: 1, createdAt: -1 })
      results.push('Created createdBy + createdAt index')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('createdBy + createdAt index already exists')
      } else {
        results.push(`Failed to create compound index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}