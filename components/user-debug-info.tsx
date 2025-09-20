'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function UserDebugInfo() {
  const { user, isLoaded, isSignedIn } = useAuth();
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
            <p>{user.email}</p>
          </div>
          <div>
            <strong>Name:</strong>
            <p>{user.name || 'N/A'}</p>
          </div>
          <div>
            <strong>Role:</strong>
            {user.role ? (
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                {user.role}
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                No Role
              </Badge>
            )}
          </div>
        </div>

        <div>
          <strong>Created:</strong>
          <p>{new Date(user.createdAt).toLocaleString()}</p>
        </div>

        <div>
          <strong>Updated:</strong>
          <p>{new Date(user.updatedAt).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
