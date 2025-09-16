"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Shield, Key, AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react"

export function SecuritySettings() {
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 24,
    ipWhitelist: "",
    auditLogging: true,
    passwordPolicy: {
      minLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      requireUppercase: true,
    },
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const mockApiKey = "sk_live_51H7..."

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Security settings saved",
        description: "Your security configuration has been updated.",
      })
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "There was a problem saving the security settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateNewApiKey = async () => {
    try {
      // Simulate API key generation
      await new Promise((resolve) => setTimeout(resolve, 500))

      toast({
        title: "New API key generated",
        description: "Your old API key has been revoked. Update your integrations with the new key.",
        variant: "destructive",
      })
    } catch (error) {
      toast({
        title: "Error generating API key",
        description: "There was a problem generating a new API key.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication & Access
          </CardTitle>
          <CardDescription>Configure authentication methods and access controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to admin accounts</p>
            </div>
            <div className="flex items-center gap-2">
              {settings.twoFactorEnabled ? (
                <Badge variant="outline" className="text-green-600 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Disabled
                </Badge>
              )}
              <Switch
                checked={settings.twoFactorEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    twoFactorEnabled: checked,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="1"
              max="168"
              value={settings.sessionTimeout}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  sessionTimeout: Number.parseInt(e.target.value) || 24,
                }))
              }
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Users will be automatically logged out after this period of inactivity.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ipWhitelist">IP Whitelist (Optional)</Label>
            <Input
              id="ipWhitelist"
              placeholder="192.168.1.1, 10.0.0.1"
              value={settings.ipWhitelist}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  ipWhitelist: e.target.value,
                }))
              }
              className="max-w-md"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of IP addresses allowed to access admin functions.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys & Integration
          </CardTitle>
          <CardDescription>Manage API keys for external integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={mockApiKey}
                readOnly
                className="max-w-md font-mono"
              />
              <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="destructive" onClick={generateNewApiKey}>
                Regenerate
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Use this key to authenticate API requests. Keep it secure and never share it publicly.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit & Logging</CardTitle>
          <CardDescription>Configure system logging and audit trail settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Audit Logging</Label>
              <p className="text-sm text-muted-foreground">Log all admin actions and system changes</p>
            </div>
            <Switch
              checked={settings.auditLogging}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({
                  ...prev,
                  auditLogging: checked,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>Configure password requirements for user accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="minLength">Minimum Password Length</Label>
            <Input
              id="minLength"
              type="number"
              min="6"
              max="32"
              value={settings.passwordPolicy.minLength}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    minLength: Number.parseInt(e.target.value) || 8,
                  },
                }))
              }
              className="max-w-xs"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Require Special Characters</Label>
              <Switch
                checked={settings.passwordPolicy.requireSpecialChars}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    passwordPolicy: {
                      ...prev.passwordPolicy,
                      requireSpecialChars: checked,
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require Numbers</Label>
              <Switch
                checked={settings.passwordPolicy.requireNumbers}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    passwordPolicy: {
                      ...prev.passwordPolicy,
                      requireNumbers: checked,
                    },
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require Uppercase Letters</Label>
              <Switch
                checked={settings.passwordPolicy.requireUppercase}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    passwordPolicy: {
                      ...prev.passwordPolicy,
                      requireUppercase: checked,
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          <Shield className="h-4 w-4" />
          {isLoading ? "Saving..." : "Save Security Settings"}
        </Button>
      </div>
    </div>
  )
}
