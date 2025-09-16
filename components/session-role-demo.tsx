"use client"

import { useSessionRole, useRequireRole, useRequirePermission } from '@/hooks/use-session-role'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, Shield, User, CheckCircle, XCircle } from 'lucide-react'
import { useState } from 'react'

/**
 * Demo component showing real-time role updates with the new session system
 */
export function SessionRoleDemo() {
  const { 
    role, 
    permissions, 
    hasSession, 
    loading, 
    error, 
    refresh 
  } = useSessionRole(10000) // Refresh every 10 seconds for demo

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Example role checks
  const adminAccess = useRequireRole('admin')
  const merchantAccess = useRequireRole('merchant')
  
  // Example permission checks
  const canViewAuditLogs = useRequirePermission('view_audit_logs')
  const canManageUsers = useRequirePermission('manage_users')

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } catch (error) {
      console.error('Manual refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Session...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            Session Error
          </CardTitle>
          <CardDescription className="text-red-500">
            {error.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleManualRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Current Session Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Current Session
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Real-time session information with automatic updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              {hasSession ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active Session
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  No Session
                </Badge>
              )}
            </div>
            
            {role && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Role:</span>
                <Badge variant="outline" className="capitalize">
                  <Shield className="h-3 w-3 mr-1" />
                  {role}
                </Badge>
              </div>
            )}
          </div>

          {permissions.length > 0 && (
            <div>
              <span className="font-medium">Permissions ({permissions.length}):</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {permissions.slice(0, 10).map((permission) => (
                  <Badge key={permission} variant="secondary" className="text-xs">
                    {permission.replace(/_/g, ' ')}
                  </Badge>
                ))}
                {permissions.length > 10 && (
                  <Badge variant="secondary" className="text-xs">
                    +{permissions.length - 10} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Access Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            {adminAccess.hasRequiredRole ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  ✅ You have admin access
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  ❌ Admin access denied
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merchant Access</CardTitle>
          </CardHeader>
          <CardContent>
            {merchantAccess.hasRequiredRole ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  ✅ You have merchant access
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  ❌ Merchant access denied
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Permission Access Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">View Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {canViewAuditLogs.hasRequiredPermission ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  ✅ Can view audit logs
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  ❌ Cannot view audit logs
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Users</CardTitle>
          </CardHeader>
          <CardContent>
            {canManageUsers.hasRequiredPermission ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  ✅ Can manage users
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  ❌ Cannot manage users
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Session data updates automatically every 10 seconds</p>
          <p>• Role changes via admin bootstrap API take effect immediately</p>
          <p>• Redis failures automatically fall back to Clerk metadata</p>
          <p>• Use the refresh button to manually trigger updates</p>
          <p>• All UI components react instantly to role/permission changes</p>
        </CardContent>
      </Card>
    </div>
  )
}