"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Search, UserPlus, Edit, Trash2, Shield } from "lucide-react"
import type { User } from "@/lib/types"

// Mock data - replace with actual API calls
const mockUsers: User[] = [
  {
    id: "1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    createdAt: new Date("2024-01-15"),
    lastActive: new Date("2024-01-20"),
  },
  {
    id: "2",
    email: "merchant1@example.com",
    firstName: "John",
    lastName: "Merchant",
    role: "merchant",
    createdAt: new Date("2024-01-16"),
    lastActive: new Date("2024-01-19"),
  },
  {
    id: "3",
    email: "viewer@example.com",
    firstName: "Jane",
    lastName: "Viewer",
    role: "viewer",
    createdAt: new Date("2024-01-17"),
    lastActive: new Date("2024-01-18"),
  },
  {
    id: "4",
    email: "merchant2@example.com",
    firstName: "Mike",
    lastName: "Johnson",
    role: "merchant",
    createdAt: new Date("2024-01-18"),
    lastActive: new Date("2024-01-20"),
  },
]

interface UserTableProps {
  onCreateUser: () => void
  onEditUser: (user: User) => void
  onDeleteUser: (userId: string) => void
  onChangeRole: (userId: string, newRole: string) => void
}

export function UserTable({ onCreateUser, onEditUser, onDeleteUser, onChangeRole }: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [users, setUsers] = useState<User[]>(mockUsers)

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "merchant":
        return "default"
      case "viewer":
        return "secondary"
      default:
        return "outline"
    }
  }

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers(
      users.map((user) => (user.id === userId ? { ...user, role: newRole as "admin" | "merchant" | "viewer" } : user)),
    )
    onChangeRole(userId, newRole)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user accounts, roles, and permissions</CardDescription>
          </div>
          <Button onClick={onCreateUser} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName} {user.lastName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                </TableCell>
                <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                <TableCell>{user.lastActive?.toLocaleDateString() || "Never"}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onEditUser(user)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit User
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "admin")}
                        disabled={user.role === "admin"}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "merchant")}
                        disabled={user.role === "merchant"}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Merchant
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(user.id, "viewer")}
                        disabled={user.role === "viewer"}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Viewer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDeleteUser(user.id)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No users found matching your search.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
