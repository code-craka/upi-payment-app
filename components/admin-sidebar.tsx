"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, ShoppingCart, BarChart3, Settings, CreditCard, Activity } from "lucide-react"
import { AuthNavigation } from "@/components/auth-navigation"
import { NoSSR } from "@/components/no-ssr"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Orders",
    url: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Audit Logs",
    url: "/admin/audit-logs",
    icon: Activity,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

const merchantMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Payment Links",
    url: "/dashboard/links",
    icon: CreditCard,
  },
  {
    title: "My Orders",
    url: "/dashboard/orders",
    icon: ShoppingCart,
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: Activity,
  },
]

const viewerMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Orders",
    url: "/dashboard/orders",
    icon: ShoppingCart,
  },
]

interface AdminSidebarProps {
  userRole: "admin" | "merchant" | "viewer"
}

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname()
  
  const getMenuItems = () => {
    switch (userRole) {
      case "admin":
        return adminMenuItems
      case "merchant":
        return merchantMenuItems
      case "viewer":
        return viewerMenuItems
      default:
        return merchantMenuItems
    }
  }
  
  const menuItems = getMenuItems()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">UPI Payment</span>
            <span className="text-xs text-muted-foreground capitalize">{userRole} Panel</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-center p-2">
          <NoSSR>
            <AuthNavigation showSignInButton={false} />
          </NoSSR>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
