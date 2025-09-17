import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import { ClerkProvider } from '@/components/providers/clerk-provider';
import { ClientProviders } from '@/components/client-providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'UPI Dashboard - Streamline Your UPI Payments',
  description:
    'Enterprise-grade UPI payment management platform. Create, manage, and track UPI payment links with advanced analytics, security, and seamless integrations.',
  generator: 'UPI Dashboard',
  keywords: 'UPI payments, payment links, QR codes, payment management, fintech, India payments',
  authors: [{ name: 'UPI Dashboard Team' }],
  creator: 'UPI Dashboard',
  publisher: 'UPI Dashboard',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'UPI Dashboard - Streamline Your UPI Payments',
    description:
      'Enterprise-grade UPI payment management platform with advanced analytics and security.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'UPI Dashboard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UPI Dashboard',
    description: 'Enterprise-grade UPI payment management platform',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: 'hsl(219.2, 100%, 55.9%)', // Primary Blue
          colorDanger: 'hsl(0, 84.2%, 60.2%)', // Red-500
          fontFamily: 'var(--font-inter)',
          colorSuccess: 'hsl(142.1, 76.2%, 36.3%)', // Green-600
          colorWarning: 'hsl(32.1, 94.6%, 43.7%)', // Orange-500
        },
        elements: {
          formButtonPrimary: 'bg-primary hover:bg-primary-dark text-white transition-colors duration-200',
          card: 'shadow-lg border border-border bg-card',
          headerTitle: 'text-xl font-semibold text-foreground',
          headerSubtitle: 'text-muted-foreground',
          formFieldInput: 'border-input bg-background text-foreground focus:border-primary focus:ring-primary',
          footerActionLink: 'text-primary hover:text-primary-dark',
          socialButtonsBlockButton: 'border-border hover:border-primary transition-colors duration-200',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}
          suppressHydrationWarning
        >
          <ClientProviders>{children}</ClientProviders>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
