'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AuthNavigation } from '@/components/auth-navigation';
import { NoSSR } from '@/components/no-ssr';

const navigation = [
  { name: 'Features', href: '#features' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'Testimonials', href: '#testimonials' },
  { name: 'Contact', href: '#contact' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600">
                <span className="text-sm font-bold text-white">UP</span>
              </div>
              <span className="text-xl font-bold text-gray-900">UPI Dashboard</span>
            </Link>
            <Badge className="ml-3 bg-green-100 text-xs text-green-800">Live</Badge>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-8 md:flex">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="font-medium text-gray-700 transition-colors duration-200 hover:text-blue-600"
              >
                {item.name}
              </a>
            ))}
            <NoSSR
              fallback={
                <div className="ml-8 flex items-center space-x-4">
                  <Button variant="ghost" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link href="/register">Get Started</Link>
                  </Button>
                </div>
              }
            >
              <AuthNavigation className="ml-8" />
            </NoSSR>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 border-t border-gray-200 bg-white px-2 pt-2 pb-3">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 font-medium text-gray-700 hover:text-blue-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="space-y-2 pt-4">
                <NoSSR
                  fallback={
                    <>
                      <Button variant="outline" asChild className="w-full">
                        <Link href="/login">Sign In</Link>
                      </Button>
                      <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                        <Link href="/register">Get Started</Link>
                      </Button>
                    </>
                  }
                >
                  <AuthNavigation
                    showSignInButton={true}
                    className="flex-col space-y-2 space-x-0"
                  />
                </NoSSR>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
