"use client"

import { useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { UserTable } from "@/components/user-management/user-table"
import { CreateUserDialog } from "@/components/user-management/create-user-dialog"
import { EditUserDialog } from "@/components/user-management/edit-user-dialog"
import type { User } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export default function UsersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { toast } = useToast()

  const handleCreateUser = () => {
    setCreateDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditDialogOpen(true)
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      toast({
        title: "User deleted",
        description: "The user has been successfully removed from the system.",
      })
    } catch (error) {
      toast({
        title: "Error deleting user",
        description: "There was a problem deleting the user. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      toast({
        title: "Role updated",
        description: `User role has been changed to ${newRole}.`,
      })
    } catch (error) {
      toast({
        title: "Error updating role",
        description: "There was a problem updating the user role. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUserCreated = (userData: any) => {
    // Handle the created user data
    console.log("User created:", userData)
  }

  const handleUserUpdated = (userData: User) => {
    // Handle the updated user data
    console.log("User updated:", userData)
  }

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

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onUserCreated={handleUserCreated} />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  )
}
