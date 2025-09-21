import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { UserModel } from '@/lib/db/models/User';
import { getUserFromSession } from '@/lib/auth/session-edge';
import { cookies } from 'next/headers';
import { roleHasPermission } from '@/lib/types/roles';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(sessionCookie.value);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check if user has permission to delete users
    if (!roleHasPermission(user.role, 'delete_users')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await connectDB();

    const { userId } = params;

    // Prevent self-deletion
    if (user.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userToDelete = await UserModel.findById(userId);
    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deletion of admin users by non-admins
    if (userToDelete.role === 'admin' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 403 }
      );
    }

    // Delete the user
    await UserModel.findByIdAndDelete(userId);

    // Log the activity
    console.log(`User deleted: ${userToDelete.email} by ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(sessionCookie.value);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check if user has permission to edit users
    if (!roleHasPermission(user.role, 'edit_users')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await connectDB();

    const { userId } = params;
    const body = await request.json();
    const { name, email, role, isActive } = body;

    // Check if user exists
    const userToUpdate = await UserModel.findById(userId);
    if (!userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent role changes to admin by non-admins
    if ((role === 'admin' || userToUpdate.role === 'admin') && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot modify admin users' },
        { status: 403 }
      );
    }

    // Update user
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        name,
        email,
        role,
        isActive,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // Remove password from response
    const { password, ...userResponse } = updatedUser.toObject();

    console.log(`User updated: ${updatedUser.email} by ${user.email}`);

    return NextResponse.json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}