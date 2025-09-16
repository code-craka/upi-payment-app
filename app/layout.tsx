import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import { ClientProviders } from "@/components/client-providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "UPI Dashboard - Streamline Your UPI Payments",
  description: "Enterprise-grade UPI payment management platform. Create, manage, and track UPI payment links with advanced analytics, security, and seamless integrations.",
  generator: "UPI Dashboard",
  keywords: "UPI payments, payment links, QR codes, payment management, fintech, India payments",
  authors: [{ name: "UPI Dashboard Team" }],
  creator: "UPI Dashboard",
  publisher: "UPI Dashboard",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  openGraph: {
    title: "UPI Dashboard - Streamline Your UPI Payments",
    description: "Enterprise-grade UPI payment management platform with advanced analytics and security.",
    type: "website",
    locale: "en_IN",
    siteName: "UPI Dashboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "UPI Dashboard",
    description: "Enterprise-grade UPI payment management platform",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: "#2563eb", // Blue-600
          colorDanger: "#dc2626", // Red-600
          fontFamily: "inherit",
        },
        elements: {
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
          card: "shadow-lg border",
          headerTitle: "text-xl font-semibold",
          headerSubtitle: "text-gray-600",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body 
          className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}
          suppressHydrationWarning
        >
          <ClientProviders>
            {children}
          </ClientProviders>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
