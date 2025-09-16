"use client"

import React from "react"
import { ThemeProvider } from "@/components/theme-provider"

interface ClientProvidersProps {
  children: React.ReactNode
}

/**
 * Client-side providers wrapper to prevent hydration issues
 * This component handles all client-side providers that need to be rendered
 * after hydration to avoid mismatches between server and client
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem 
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}