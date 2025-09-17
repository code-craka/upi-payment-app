'use client';

import { useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { UserTable } from '@/components/user-management/user-table';
import { CreateUserDialog } from '@/components/user-management/create-user-dialog';
import { EditUserDialog } from '@/components/user-management/edit-user-dialog';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function UsersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const handleCreateUser = () => {
    setCreateDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const executeUserAction = async (options: {
    action: () => Promise<void>;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
  }) => {
    try {
      await options.action();
      toast({
        title: options.successTitle,
        description: options.successDescription,
      });
    } catch {
      toast({
        title: options.errorTitle,
        description: options.errorDescription,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    await executeUserAction({
      action: () => new Promise((resolve) => setTimeout(resolve, 500)),
      successTitle: 'User deleted',
      successDescription: `User ${userId} has been successfully removed from the system.`,
      errorTitle: 'Error deleting user',
      errorDescription: 'There was a problem deleting the user. Please try again.',
    });
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await executeUserAction({
      action: () => new Promise((resolve) => setTimeout(resolve, 500)),
      successTitle: 'Role updated',
      successDescription: `User role has been changed to ${newRole}.`,
      errorTitle: 'Error updating role',
      errorDescription: 'There was a problem updating the user role. Please try again.',
    });
  };

  const handleUserCreated = (userData: User) => {
    // Handle the created user data
    console.warn('User created:', userData);
  };

  const handleUserUpdated = (userData: User) => {
    // Handle the updated user data
    console.warn('User updated:', userData);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      <UserTable
        onCreateUser={handleCreateUser}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        onChangeRole={handleChangeRole}
      />

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={handleUserCreated}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
