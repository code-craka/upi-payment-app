import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

/**
 * Simple Clerk test endpoint
 */
export async function GET() {
  try {
    const user = await currentUser();
    
    return NextResponse.json({
      success: true,
      authenticated: !!user,
      userId: user?.id || null,
      email: user?.emailAddresses?.[0]?.emailAddress || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clerk test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}