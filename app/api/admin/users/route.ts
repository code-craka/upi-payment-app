import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import { connectDB } from '@/lib/db/connection';
import { UserModel } from '@/lib/db/models/User';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['admin', 'merchant', 'user']),
});

export async function POST(request: NextRequest) {
  try {
    // Require admin role
    await requireRole('admin', request);

    const body = await request.json();
    const userData = CreateUserSchema.parse(body);

    // Connect to database
    await connectDB();

    // Check if user already exists
    const existingUser = await UserModel.findOne({
      email: userData.email.toLowerCase()
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create new user
    const newUser = await UserModel.createUser({
      email: userData.email,
      password: userData.password,
      name: userData.name,
      role: userData.role,
    });

    // Return success response (without sensitive data)
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('[Admin] Create user error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: error.errors
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Role')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require admin role
    await requireRole('admin', request);

    // Connect to database
    await connectDB();

    // Get all users (excluding password hash)
    const users = await UserModel.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: user.stats,
      }))
    });

  } catch (error) {
    console.error('[Admin] Get users error:', error);

    if (error instanceof Error && error.message.includes('Role')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}