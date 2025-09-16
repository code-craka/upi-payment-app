import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { generateQRCode, generateUPIString } from "@/lib/utils/upi-utils"
import { createAuditLogFromRequest } from "@/lib/utils/audit"

interface TestResult {
  test: string
  status: "passed" | "failed" | "pending"
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const testResults: TestResult[] = []

    // Test 1: Database Connection
    testResults.push({ test: "Database Connection", status: "pending" })
    try {
      await connectDB()
      testResults[testResults.length - 1].status = "passed"
      testResults[testResults.length - 1].message = "Successfully connected to MongoDB"
    } catch (error) {
      testResults[testResults.length - 1].status = "failed"
      testResults[testResults.length - 1].message = `Database connection failed: ${error}`
    }

    // Test 2: UPI Utils
    testResults.push({ test: "UPI Utilities", status: "pending" })
    try {
      const upiString = generateUPIString({
        payeeAddress: process.env.UPI_MERCHANT_ID || "test@upi",
        payeeName: process.env.UPI_MERCHANT_NAME || "Test Merchant",
        amount: 100,
        transactionNote: "Test Payment",
        transactionRef: "test_ref"
      })
      const qrCodeData = await generateQRCode(upiString)
      
      if (upiString.includes("upi://pay") && qrCodeData.startsWith("data:image/png")) {
        testResults[testResults.length - 1].status = "passed"
        testResults[testResults.length - 1].message = "UPI string and QR code generation working"
      } else {
        testResults[testResults.length - 1].status = "failed"
        testResults[testResults.length - 1].message = "UPI utilities not working properly"
      }
    } catch (error) {
      testResults[testResults.length - 1].status = "failed"
      testResults[testResults.length - 1].message = `UPI utilities error: ${error}`
    }

    // Test 3: Order Model
    testResults.push({ test: "Order Model", status: "pending" })
    try {
      const testOrder = new OrderModel({
        orderId: `test_${Date.now()}`,
        customerName: "Test Customer",
        amount: 100,
        paymentMethod: "UPI",
        status: "pending",
        expiresAt: new Date(Date.now() + 9 * 60 * 1000), // 9 minutes from now
      })

      await testOrder.save()
      
      const foundOrder = await OrderModel.findOne({ orderId: testOrder.orderId })
      
      if (foundOrder) {
        testResults[testResults.length - 1].status = "passed"
        testResults[testResults.length - 1].message = "Order creation and retrieval working"
        
        // Clean up test order
        await OrderModel.deleteOne({ orderId: testOrder.orderId })
      } else {
        testResults[testResults.length - 1].status = "failed"
        testResults[testResults.length - 1].message = "Order not found after creation"
      }
    } catch (error) {
      testResults[testResults.length - 1].status = "failed"
      testResults[testResults.length - 1].message = `Order model error: ${error}`
    }

    // Test 4: Audit Logging
    testResults.push({ test: "Audit Logging", status: "pending" })
    try {
      await createAuditLogFromRequest(
        request,
        "system_test_executed",
        "System",
        "test_system",
        "test_user",
        "test@example.com",
        { testRun: true, timestamp: new Date().toISOString() }
      )

      const auditLog = await AuditLogModel.findOne({ 
        action: "system_test_executed",
        entityId: "test_system" 
      }).sort({ createdAt: -1 })

      if (auditLog) {
        testResults[testResults.length - 1].status = "passed"
        testResults[testResults.length - 1].message = "Audit logging working"
      } else {
        testResults[testResults.length - 1].status = "failed"
        testResults[testResults.length - 1].message = "Audit log not created"
      }
    } catch (error) {
      testResults[testResults.length - 1].status = "failed"
      testResults[testResults.length - 1].message = `Audit logging error: ${error}`
    }

    const overallStatus = testResults.every(result => result.status === "passed") ? "PASSED" : "FAILED"
    const passedTests = testResults.filter(result => result.status === "passed").length
    const totalTests = testResults.length

    return NextResponse.json({
      success: true,
      overallStatus,
      summary: `${passedTests}/${totalTests} tests passed`,
      timestamp: new Date().toISOString(),
      testResults,
    })

  } catch (error) {
    console.error("System test error:", error)
    return NextResponse.json({
      success: false,
      error: "System test failed",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}