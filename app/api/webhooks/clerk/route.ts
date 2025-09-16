import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { Webhook } from "svix"
import { connectDB } from "@/lib/db/connection"
import { AuditLogModel } from "@/lib/db/models/AuditLog"

type ClerkWebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string
    last_name?: string
    public_metadata?: Record<string, any>
    created_at?: number
    updated_at?: number
  }
}

async function handleUserCreated(data: ClerkWebhookEvent['data']) {
  await connectDB()
  
  const userEmail = data.email_addresses?.[0]?.email_address || ""
  const userName = `${data.first_name || ""} ${data.last_name || ""}`.trim()
  
  // Create audit log for new user registration
  await AuditLogModel.create({
    action: "user_registered",
    entityType: "User",
    entityId: data.id,
    userId: data.id,
    userEmail,
    ipAddress: "clerk_webhook",
    userAgent: "clerk_webhook",
    metadata: {
      userId: data.id,
      userEmail,
      userName,
      registrationDate: data.created_at ? new Date(data.created_at) : new Date(),
      role: data.public_metadata?.role || "viewer",
    },
  })

  console.log(`[Clerk Webhook] New user registered: ${userEmail} (${data.id})`)
  
  return {
    userId: data.id,
    userEmail,
    message: "User registration logged",
  }
}

async function handleUserUpdated(data: ClerkWebhookEvent['data']) {
  await connectDB()
  
  const userEmail = data.email_addresses?.[0]?.email_address || ""
  const userName = `${data.first_name || ""} ${data.last_name || ""}`.trim()
  
  // Create audit log for user profile update
  await AuditLogModel.create({
    action: "user_profile_updated",
    entityType: "User",
    entityId: data.id,
    userId: data.id,
    userEmail,
    ipAddress: "clerk_webhook",
    userAgent: "clerk_webhook",
    metadata: {
      userId: data.id,
      userEmail,
      userName,
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
      role: data.public_metadata?.role,
    },
  })

  console.log(`[Clerk Webhook] User profile updated: ${userEmail} (${data.id})`)
  
  return {
    userId: data.id,
    userEmail,
    message: "User profile update logged",
  }
}

async function handleUserDeleted(data: ClerkWebhookEvent['data']) {
  await connectDB()
  
  // Create audit log for user deletion
  await AuditLogModel.create({
    action: "user_deleted",
    entityType: "User",
    entityId: data.id,
    userId: data.id,
    userEmail: "deleted_user",
    ipAddress: "clerk_webhook",
    userAgent: "clerk_webhook",
    metadata: {
      userId: data.id,
      deletedAt: new Date(),
    },
  })

  console.log(`[Clerk Webhook] User deleted: ${data.id}`)
  
  return {
    userId: data.id,
    message: "User deletion logged",
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const svixId = headersList.get("svix-id")
    const svixTimestamp = headersList.get("svix-timestamp")
    const svixSignature = headersList.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: "Missing svix headers" },
        { status: 400 }
      )
    }

    const body = await request.text()
    
    // Verify the webhook using Svix
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      )
    }

    const wh = new Webhook(webhookSecret)
    let event: ClerkWebhookEvent

    try {
      event = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkWebhookEvent
    } catch (err) {
      console.error("[Clerk Webhook] Error verifying webhook:", err)
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      )
    }

    let result
    
    switch (event.type) {
      case "user.created":
        result = await handleUserCreated(event.data)
        break
        
      case "user.updated":
        result = await handleUserUpdated(event.data)
        break
        
      case "user.deleted":
        result = await handleUserDeleted(event.data)
        break
        
      default:
        console.log(`[Clerk Webhook] Unhandled event type: ${event.type}`)
        return NextResponse.json(
          { message: `Event type ${event.type} not handled` },
          { status: 200 }
        )
    }

    return NextResponse.json({
      success: true,
      event: event.type,
      result,
      processedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error("[Clerk Webhook] Error processing webhook:", error)
    return NextResponse.json(
      { 
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// Health check endpoint  
export async function GET() {
  return NextResponse.json({
    status: "active",
    webhook: "clerk-webhook",
    timestamp: new Date().toISOString(),
    events: [
      "user.created",
      "user.updated", 
      "user.deleted"
    ],
  })
}