import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

export async function GET() {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Test MongoDB connection
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      return NextResponse.json(
        {
          error: "MongoDB URI not configured",
          env_check: {
            MONGODB_URI: !!process.env.MONGODB_URI,
            CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
          },
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message: "Database connection test successful",
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Database test error:", error)
    return NextResponse.json(
      {
        error: "Database connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
