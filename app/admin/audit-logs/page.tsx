import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AuditLogsViewer } from '@/components/admin/audit-logs-viewer';

export default function AuditLogsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 p-6">
          <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="h-6 border-gray-300" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Audit Logs
            </h1>
            <p className="text-gray-600 mt-1">Complete activity trail with security monitoring</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AuditLogsViewer />
      </div>
    </div>
  );
}
