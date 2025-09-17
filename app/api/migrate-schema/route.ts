/**
 * MongoDB Schema Migration API
 * 
 * Updates collection validation schema to match our Mongoose models
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'

export async function POST(_request: NextRequest) {
  try {
    await connectDB()

    const db = OrderModel.db
    const results = []

    // Drop existing validation schema if it exists
    try {
      await db.collection('orders').drop()
      results.push('Dropped existing orders collection with old schema')
    } catch (error) {
      if (error instanceof Error && error.message.includes('ns not found')) {
        results.push('Orders collection does not exist, will create fresh')
      } else {
        results.push(`Warning: Could not drop collection: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    // Create new collection with proper JSON schema validation
    try {
      await db.createCollection('orders', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['orderId', 'amount', 'description', 'upiId', 'status', 'createdBy', 'expiresAt'],
            properties: {
              orderId: {
                bsonType: 'string',
                description: 'Unique order identifier',
              },
              amount: {
                bsonType: 'number',
                minimum: 1,
                description: 'Order amount in INR',
              },
              description: {
                bsonType: 'string',
                maxLength: 500,
                description: 'Order description',
              },
              customerName: {
                bsonType: ['string', 'null'],
                maxLength: 100,
                description: 'Customer name (optional)',
              },
              customerEmail: {
                bsonType: ['string', 'null'],
                description: 'Customer email (optional)',
              },
              customerPhone: {
                bsonType: ['string', 'null'],
                description: 'Customer phone (optional)',
              },
              upiId: {
                bsonType: 'string',
                description: 'UPI ID for payment',
              },
              status: {
                bsonType: 'string',
                enum: ['pending', 'pending-verification', 'completed', 'expired', 'failed'],
                description: 'Order status',
              },
              utrNumber: {
                bsonType: ['string', 'null'],
                description: 'UTR number (optional)',
              },
              createdBy: {
                bsonType: 'string',
                description: 'User who created the order',
              },
              expiresAt: {
                bsonType: 'date',
                description: 'Order expiration time',
              },
              verifiedAt: {
                bsonType: ['date', 'null'],
                description: 'Verification timestamp (optional)',
              },
              verifiedBy: {
                bsonType: ['string', 'null'],
                description: 'Who verified the order (optional)',
              },
            },
          },
        },
        validationLevel: 'strict',
        validationAction: 'error',
      })

      results.push('Created orders collection with updated JSON schema validation')
    } catch (error) {
      results.push(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown'}`)
    }

    // Create all necessary indexes
    try {
      await db.collection('orders').createIndex({ orderId: 1 }, { unique: true })
      results.push('Created index: orderId (unique)')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('Index already exists: orderId')
      } else {
        results.push(`Failed to create orderId index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      await db.collection('orders').createIndex({ status: 1 })
      results.push('Created index: status')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('Index already exists: status')
      } else {
        results.push(`Failed to create status index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      await db.collection('orders').createIndex({ expiresAt: 1 })
      results.push('Created index: expiresAt')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('Index already exists: expiresAt')
      } else {
        results.push(`Failed to create expiresAt index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      await db.collection('orders').createIndex({ createdBy: 1, createdAt: -1 })
      results.push('Created index: createdBy + createdAt')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('Index already exists: createdBy + createdAt')
      } else {
        results.push(`Failed to create compound index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    try {
      await db.collection('orders').createIndex({ utrNumber: 1 }, { sparse: true })
      results.push('Created index: utrNumber (sparse)')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        results.push('Index already exists: utrNumber')
      } else {
        results.push(`Failed to create utrNumber index: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    // Test the new schema by creating a test document
    try {
      const testOrder = {
        orderId: 'test-schema-' + Date.now(),
        amount: 100,
        description: 'Schema validation test',
        upiId: process.env.UPI_ID || 'merchant@paytm',
        status: 'pending',
        createdBy: 'system',
        expiresAt: new Date(Date.now() + 540000), // 9 minutes
      }

      await db.collection('orders').insertOne(testOrder)
      // Clean up test document
      await db.collection('orders').deleteOne({ orderId: testOrder.orderId })
      
      results.push('Schema validation test: PASSED')
    } catch (error) {
      results.push(`Schema validation test: FAILED - ${error instanceof Error ? error.message : 'Unknown'}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Schema migration completed',
      results,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Schema migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}