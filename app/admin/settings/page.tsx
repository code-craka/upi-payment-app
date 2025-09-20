'use client';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SystemSettings } from '@/components/settings/system-settings';
import { SecuritySettings } from '@/components/settings/security-settings';
import { Cog, Lock } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 p-6">
          <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="h-6 border-gray-300" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              System Settings
            </h1>
            <p className="text-gray-600 mt-1">Configure system preferences and security options</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="system" className="space-y-8">
            <div className="flex items-center justify-center">
              <TabsList className="grid w-full max-w-lg grid-cols-2 bg-white border border-gray-200 shadow-lg">
                <TabsTrigger
                  value="system"
                  className="gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 data-[state=active]:border-purple-300"
                >
                  <Cog className="h-4 w-4" />
                  System Configuration
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 data-[state=active]:border-purple-300"
                >
                  <Lock className="h-4 w-4" />
                  Security & Privacy
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="system" className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <SystemSettings />
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <SecuritySettings />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
