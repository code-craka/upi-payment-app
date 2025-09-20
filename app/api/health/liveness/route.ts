import { NextRequest, NextResponse } from 'next/server';

/**
 * Liveness Health Check
 *
 * Basic health check to determine if the application is running.
 * This is used by container orchestrators (Kubernetes, Docker, etc.)
 * to determine if the application should be restarted.
 *
 * Returns 200 if the application is running, 503 if not.
 */
export async function GET(_request: NextRequest) {
  try {
    // Basic liveness check - just verify the service is responding

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (_error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Application is not responding',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
