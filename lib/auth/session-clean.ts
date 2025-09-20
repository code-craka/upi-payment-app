// This file is deprecated - using session-edge.ts for Edge Runtime compatibility
// Keeping this file for backward compatibility but redirecting all functions

import type { SessionData, AuthUser } from './session-edge';
export type { SessionData, AuthUser };

// Re-export all functions from session-edge
export {
  createSession,
  getSession,
  deleteSession,
  updateSession,
  getUserFromSession,
  authenticateUser,
  clearUserSessions
} from './session-edge';

// Legacy functions that might be used by existing code
export async function hashPassword(password: string): Promise<string> {
  // For backward compatibility only - should not be used in Edge Runtime
  throw new Error('hashPassword not available in Edge Runtime - use dedicated Node.js API routes');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // For backward compatibility only - should not be used in Edge Runtime  
  throw new Error('verifyPassword not available in Edge Runtime - use dedicated Node.js API routes');
}

export async function getUserSessions(_userId: string): Promise<string[]> {
  // For backward compatibility only
  throw new Error('getUserSessions not available in Edge Runtime - use clearUserSessions instead');
}