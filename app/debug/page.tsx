import { auth } from "@clerk/nextjs/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

export default async function DebugPage() {
  const { userId, sessionClaims } = await auth()

  const envVars = {
    MONGODB_URI: !!process.env.MONGODB_URI,
    CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_WEBHOOK_SECRET: !!process.env.CLERK_WEBHOOK_SECRET,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
  }

  const userRole = sessionClaims?.metadata?.role as string

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">System Debug Information</h1>
        <p className="text-muted-foreground mt-2">Check system configuration and authentication status</p>
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
            <div className="flex justify-between items-center">
              <span>User ID:</span>
              <Badge variant={userId ? "default" : "destructive"}>
                {userId ? "Authenticated" : "Not Authenticated"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>User Role:</span>
              <Badge variant={userRole ? "default" : "secondary"}>{userRole || "No Role"}</Badge>
            </div>
            {userId && (
              <div className="text-sm text-muted-foreground">
                <p>User ID: {userId}</p>
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
            <CardDescription>Check if required environment variables are configured</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm font-mono">{key}:</span>
                <div className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <Badge variant={value ? "default" : "destructive"}>{value ? "Set" : "Missing"}</Badge>
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
            {!userId && <p className="text-sm text-red-600">• Please sign in to test authentication</p>}
            {!envVars.MONGODB_URI && (
              <p className="text-sm text-red-600">• Configure MONGODB_URI in environment variables</p>
            )}
            {!envVars.CLERK_SECRET_KEY && (
              <p className="text-sm text-red-600">• Configure CLERK_SECRET_KEY in environment variables</p>
            )}
            {!envVars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
              <p className="text-sm text-red-600">
                • Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables
              </p>
            )}
            {userId && userRole && Object.values(envVars).every(Boolean) && (
              <p className="text-sm text-green-600">✓ All systems configured correctly!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
