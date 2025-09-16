import { currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        message: "No user session found"
      }, { status: 401 })
    }

    const debugInfo = {
      authenticated: true,
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      publicMetadata: user.publicMetadata,
      role: user.publicMetadata?.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      sessionId: request.headers.get("authorization"),
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      user: debugInfo
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to get user info",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}