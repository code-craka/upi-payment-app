import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { auth } from "@clerk/nextjs/server"

/**
 * Debug endpoint to examine session claims structure
 * This helps diagnose role validation issues
 */
export async function GET(request: NextRequest) {
  try {
    // Get both currentUser and auth data
    const [user, authData] = await Promise.all([
      currentUser(),
      auth()
    ])

    if (!user) {
      return NextResponse.json({
        error: "Not authenticated",
        message: "User must be signed in to view session claims"
      }, { status: 401 })
    }

    // Extract all available data
    const debugInfo = {
      timestamp: new Date().toISOString(),
      userInfo: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      },
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
      unsafeMetadata: user.unsafeMetadata,
      authData: {
        userId: authData.userId,
        sessionId: authData.sessionId,
        orgId: authData.orgId,
        orgRole: authData.orgRole,
        orgSlug: authData.orgSlug,
      },
      sessionClaims: authData.sessionClaims,
      roleExtractionTests: {
        fromUser: user.publicMetadata?.role,
        fromSessionClaims: (authData.sessionClaims as any)?.publicMetadata?.role,
        fromSessionClaimsMetadata: (authData.sessionClaims as any)?.metadata?.role,
        fromSessionClaimsCustom: (authData.sessionClaims as any)?.custom_claims?.role,
      },
      rawSessionClaims: authData.sessionClaims
    }

    // Check if role exists anywhere in the user object
    const roleSearch = {
      searchResults: findRoleInObject(user, 'role'),
      userStringified: JSON.stringify(user, null, 2),
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      roleSearch: roleSearch,
      recommendations: [
        "Check if role is set in Clerk Dashboard for this user",
        "Verify publicMetadata contains the role field",
        "Confirm middleware is reading from correct claims path"
      ]
    }, { status: 200 })

  } catch (error) {
    console.error("Debug session claims error:", error)
    return NextResponse.json({
      error: "Debug failed",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * Recursively search for role field in any object
 */
function findRoleInObject(obj: any, searchKey: string, path = ''): Array<{path: string, value: any}> {
  const results: Array<{path: string, value: any}> = []
  
  if (obj === null || obj === undefined) {
    return results
  }

  if (typeof obj !== 'object') {
    return results
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    
    if (key === searchKey) {
      results.push({ path: currentPath, value })
    }
    
    if (typeof value === 'object' && value !== null) {
      results.push(...findRoleInObject(value, searchKey, currentPath))
    }
  }

  return results
}