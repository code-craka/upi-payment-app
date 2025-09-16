import type React from "react"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()

  if (!user) {
    redirect("/sign-in")
  }

  const userRole = user.publicMetadata?.role as string
  if (!userRole || !["admin", "merchant", "viewer"].includes(userRole)) {
    redirect("/unauthorized")
  }

  return (
    <SidebarProvider>
      <AdminSidebar userRole={userRole as "admin" | "merchant" | "viewer"} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
