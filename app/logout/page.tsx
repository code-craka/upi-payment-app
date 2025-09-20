'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

export default function LogoutPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(true);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call logout API endpoint
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        setIsLoggingOut(false);
        // Redirect to login page
        router.push('/login');
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <LogOut className="h-6 w-6" />
            {isLoggingOut ? 'Signing out...' : 'Signed out'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLoggingOut 
              ? 'Please wait while we sign you out of your account.'
              : 'Redirecting to login page...'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600"></div>
        </CardContent>
      </Card>
    </div>
  );
}