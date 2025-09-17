import type { NextRequest } from 'next/server';
import { getCSRFToken } from '@/lib/middleware/csrf';

export async function GET(request: NextRequest) {
  return getCSRFToken(request);
}
