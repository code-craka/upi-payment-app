import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

// Mock user data for development
const mockUsers = [
  {
    id: '1',
    name: 'Code Craka',
    email: 'codecraka@gmail.com',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    lastLogin: '2024-01-20T14:22:00Z',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'merchant',
    status: 'active',
    createdAt: '2024-01-16T09:15:00Z',
    lastLogin: '2024-01-19T16:45:00Z',
  },
  {
    id: '3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    role: 'viewer',
    status: 'inactive',
    createdAt: '2024-01-17T11:20:00Z',
    lastLogin: '2024-01-18T13:30:00Z',
  },
];

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.publicMetadata?.role as string;
    if (!['admin', 'merchant'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    console.log('[v0] Users API called by:', user.id, 'with role:', userRole);

    return NextResponse.json({
      users: mockUsers,
      total: mockUsers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[v0] Users API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
