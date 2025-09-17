'use client';

import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function UserDebugInfo() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    window.location.reload();
  };

  if (!isLoaded) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <p>Loading user info...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4">
          <p>No user signed in</p>
        </CardContent>
      </Card>
    );
  }

  const userRole = user.publicMetadata?.role as string;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">User Debug Info</CardTitle>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>User ID:</strong>
            <p className="font-mono text-xs break-all">{user.id}</p>
          </div>
          <div>
            <strong>Email:</strong>
            <p>{user.emailAddresses[0]?.emailAddress}</p>
          </div>
          <div>
            <strong>Name:</strong>
            <p>
              {user.firstName} {user.lastName}
            </p>
          </div>
          <div>
            <strong>Role:</strong>
            {userRole ? (
              <Badge variant={userRole === 'admin' ? 'default' : 'secondary'} className="text-xs">
                {userRole}
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                No Role
              </Badge>
            )}
          </div>
        </div>

        <div>
          <strong>Public Metadata:</strong>
          <pre className="mt-1 overflow-auto rounded bg-gray-100 p-2 text-xs">
            {JSON.stringify(user.publicMetadata, null, 2)}
          </pre>
        </div>

        <div>
          <strong>Created:</strong>
          <p>{new Date(user.createdAt!).toLocaleString()}</p>
        </div>

        <div>
          <strong>Updated:</strong>
          <p>{new Date(user.updatedAt!).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
