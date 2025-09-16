import { type NextRequest, NextResponse } from "next/server"
import { generateCSRFToken, validateCSRFToken } from "./security"

export function createCSRFMiddleware() {
  return async function csrfMiddleware(request: NextRequest) {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return NextResponse.next()
    }

    // Skip CSRF for non-API routes (forms will be handled separately)
    if (!request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.next()
    }

    // Skip CSRF for bootstrap API (for initial admin setup)
    if (request.nextUrl.pathname === "/api/admin-bootstrap") {
      return NextResponse.next()
    }

    // Skip CSRF for system status API (for diagnostics)
    if (request.nextUrl.pathname === "/api/system-status") {
      return NextResponse.next()
    }

    // Get session ID from cookies or headers
    const sessionId = request.cookies.get("__session")?.value || request.headers.get("x-session-id") || "anonymous"

    // Check for CSRF token in headers
    const csrfToken = request.headers.get("x-csrf-token") || request.headers.get("x-xsrf-token")

    if (!csrfToken) {
      return new NextResponse(
        JSON.stringify({
          error: "CSRF Token Missing",
          message: "CSRF token is required for this request",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (!validateCSRFToken(sessionId, csrfToken)) {
      return new NextResponse(
        JSON.stringify({
          error: "Invalid CSRF Token",
          message: "CSRF token is invalid or expired",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    return NextResponse.next()
  }
}

// API route to get CSRF token
export async function getCSRFToken(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.cookies.get("__session")?.value || request.headers.get("x-session-id") || "anonymous"

  const token = generateCSRFToken(sessionId)

  return NextResponse.json({
    csrfToken: token,
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })
}
