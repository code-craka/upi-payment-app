import { getSafeUser } from '@/lib/auth/safe-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default async function DebugPage() {
  const user = await getSafeUser();

  const envVars = {
    MONGODB_URI: !!process.env.MONGODB_URI,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">System Debug Information</h1>
        <p className="text-muted-foreground mt-2">
          Check system configuration and authentication status
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Authentication Status
            </CardTitle>
            <CardDescription>Current user authentication information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>User ID:</span>
              <Badge variant={user ? 'default' : 'destructive'}>
                {user ? 'Authenticated' : 'Not Authenticated'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>User Role:</span>
              <Badge variant={user?.role ? 'default' : 'secondary'}>{user?.role || 'No Role'}</Badge>
            </div>
            {user && (
              <div className="text-muted-foreground text-sm">
                <p>User ID: {user.id}</p>
                <p>Email: {user.email}</p>
                <p>Name: {user.firstName} {user.lastName}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Environment Variables
            </CardTitle>
            <CardDescription>
              Check if required environment variables are configured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="font-mono text-sm">{key}:</span>
                <div className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <Badge variant={value ? 'default' : 'destructive'}>
                    {value ? 'Set' : 'Missing'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>Recommendations based on current configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {!user && (
              <p className="text-sm text-red-600">• Please sign in to test authentication</p>
            )}
            {!envVars.MONGODB_URI && (
              <p className="text-sm text-red-600">
                • Configure MONGODB_URI in environment variables
              </p>
            )}
            {!envVars.SESSION_SECRET && (
              <p className="text-sm text-red-600">
                • Configure SESSION_SECRET in environment variables
              </p>
            )}
            {!envVars.UPSTASH_REDIS_REST_URL && (
              <p className="text-sm text-red-600">
                • Configure UPSTASH_REDIS_REST_URL in environment variables
              </p>
            )}
            {user && user.role && Object.values(envVars).every(Boolean) && (
              <p className="text-sm text-green-600">✓ All systems configured correctly!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
