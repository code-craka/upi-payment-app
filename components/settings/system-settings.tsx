'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Save, Clock, Smartphone, Shield } from 'lucide-react';

interface SystemSettingsProps {
  initialSettings?: {
    timerDuration: number;
    staticUpiId: string;
    enabledUpiApps: {
      gpay: boolean;
      phonepe: boolean;
      paytm: boolean;
      bhim: boolean;
    };
  };
}

export function SystemSettings({ initialSettings }: SystemSettingsProps) {
  const [settings, setSettings] = useState({
    timerDuration: initialSettings?.timerDuration || 9,
    staticUpiId: initialSettings?.staticUpiId || '',
    enabledUpiApps: initialSettings?.enabledUpiApps || {
      gpay: true,
      phonepe: true,
      paytm: true,
      bhim: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: 'Settings saved successfully',
        description: 'System settings have been updated.',
      });
    } catch (_error) {
      toast({
        title: 'Error saving settings',
        description: 'There was a problem saving the settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpiAppToggle = (app: keyof typeof settings.enabledUpiApps) => {
    setSettings((prev) => ({
      ...prev,
      enabledUpiApps: {
        ...prev.enabledUpiApps,
        [app]: !prev.enabledUpiApps[app],
      },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payment Timer Settings
          </CardTitle>
          <CardDescription>
            Configure how long payment links remain active before expiring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timerDuration">Payment Expiry Time (minutes)</Label>
            <Input
              id="timerDuration"
              type="number"
              min="1"
              max="60"
              value={settings.timerDuration}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  timerDuration: Number.parseInt(e.target.value) || 9,
                }))
              }
              className="max-w-xs"
            />
            <p className="text-muted-foreground text-sm">
              Default: 9 minutes. Range: 1-60 minutes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            UPI Configuration
          </CardTitle>
          <CardDescription>
            Configure static UPI ID and manage payment app availability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="staticUpiId">Static UPI ID (Optional)</Label>
            <Input
              id="staticUpiId"
              placeholder="merchant@paytm"
              value={settings.staticUpiId}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  staticUpiId: e.target.value,
                }))
              }
              className="max-w-md"
            />
            <p className="text-muted-foreground text-sm">
              If set, this UPI ID will be used for all payment links instead of individual merchant
              UPI IDs.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4" />
              Enabled UPI Apps
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="gpay">Google Pay</Label>
                  <p className="text-muted-foreground text-sm">Enable Google Pay payment option</p>
                </div>
                <Switch
                  id="gpay"
                  checked={settings.enabledUpiApps.gpay}
                  onCheckedChange={() => handleUpiAppToggle('gpay')}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="phonepe">PhonePe</Label>
                  <p className="text-muted-foreground text-sm">Enable PhonePe payment option</p>
                </div>
                <Switch
                  id="phonepe"
                  checked={settings.enabledUpiApps.phonepe}
                  onCheckedChange={() => handleUpiAppToggle('phonepe')}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="paytm">Paytm</Label>
                  <p className="text-muted-foreground text-sm">Enable Paytm payment option</p>
                </div>
                <Switch
                  id="paytm"
                  checked={settings.enabledUpiApps.paytm}
                  onCheckedChange={() => handleUpiAppToggle('paytm')}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="bhim">BHIM UPI</Label>
                  <p className="text-muted-foreground text-sm">Enable BHIM UPI payment option</p>
                </div>
                <Switch
                  id="bhim"
                  checked={settings.enabledUpiApps.bhim}
                  onCheckedChange={() => handleUpiAppToggle('bhim')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="gap-2">
          <Save className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
