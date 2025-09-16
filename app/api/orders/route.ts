import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { 
  generateQRCode, 
  generateUPIString, 
  generateUPIDeepLinks, 
  generateOrderId, 
  calculateExpirationTime,
  getUPIConfig 
} from "@/lib/utils/upi-utils"

// Remove mock orders - we'll use real database now
const CreateOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").max(100),
  customerEmail: z.string().email("Invalid email format").optional(),
  customerPhone: z.string().regex(/^[+]?[\d\s-()]{10,15}$/, "Invalid phone format").optional(),
  amount: z.number().positive("Amount must be positive").max(100000, "Amount too large"),
  description: z.string().min(1, "Description is required").max(500),
  expiresInMinutes: z.number().min(1).max(60).default(9),
})

export async function GET(request: Request) {
  try {
    // Connect to database
    await connectDB()
    
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = user.publicMetadata?.role as string
    if (!["admin", "merchant", "viewer"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const search = searchParams.get("search")

    // Build query based on user role
    let query: any = {}
    
    // Non-admin users can only see their own orders
    if (userRole !== "admin") {
      query.createdBy = user.id
    }

    // Add status filter
    if (status && status !== "all") {
      query.status = status
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ]
    }

    // Get paginated results
    const skip = (page - 1) * limit
    const [orders, total] = await Promise.all([
      OrderModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrderModel.countDocuments(query),
    ])

    // Create audit log
    await AuditLogModel.create({
      action: "orders_viewed",
      entityType: "Order",
      entityId: "multiple",
      userId: user.id,
      userEmail: user.emailAddresses[0]?.emailAddress || "",
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      metadata: { query, total, page, limit },
    })

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("[Orders API] Error fetching orders:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch orders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    // Connect to database
    await connectDB()
    
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = user.publicMetadata?.role as string
    if (!["admin", "merchant"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = CreateOrderSchema.parse(body)

    // Get UPI configuration
    const upiConfig = getUPIConfig()
    
    // Generate unique order ID
    const orderId = generateOrderId()
    
    // Calculate expiration time
    const expiresAt = calculateExpirationTime(validatedData.expiresInMinutes)

    // Generate UPI payment string
    const upiPaymentData = {
      payeeAddress: upiConfig.upiId,
      payeeName: upiConfig.merchantName,
      amount: validatedData.amount,
      transactionNote: validatedData.description,
      transactionRef: orderId,
    }
    
    const upiString = generateUPIString(upiPaymentData)
    const qrCodeDataUrl = await generateQRCode(upiString)
    const deepLinks = generateUPIDeepLinks(upiString)

    // Create order in database
    const newOrder = await OrderModel.create({
      orderId,
      amount: validatedData.amount,
      description: validatedData.description,
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
      upiId: upiConfig.upiId,
      status: "pending",
      createdBy: user.id,
      expiresAt,
    })

    // Create audit log
    await AuditLogModel.create({
      action: "order_created",
      entityType: "Order",
      entityId: orderId,
      userId: user.id,
      userEmail: user.emailAddresses[0]?.emailAddress || "",
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      metadata: {
        amount: validatedData.amount,
        customerName: validatedData.customerName,
        expiresInMinutes: validatedData.expiresInMinutes,
      },
    })

    const response = {
      success: true,
      data: {
        orderId,
        amount: validatedData.amount,
        description: validatedData.description,
        status: "pending",
        paymentUrl: `/pay/${orderId}`,
        qrCode: qrCodeDataUrl,
        upiString,
        deepLinks,
        expiresAt: expiresAt.toISOString(),
        createdAt: newOrder.createdAt.toISOString(),
        timeRemaining: expiresAt.getTime() - Date.now(),
      },
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: error.errors 
        }, 
        { status: 400 }
      )
    }

    console.error("[Orders API] Order creation error:", error)
    return NextResponse.json(
      { 
        error: "Failed to create order",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
