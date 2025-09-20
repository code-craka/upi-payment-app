import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { OrdersTable } from '@/components/orders/orders-table';

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 p-6">
          <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
          <Separator orientation="vertical" className="h-6 border-gray-300" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Orders Management
            </h1>
            <p className="text-gray-600 mt-1">Track and manage payment orders across your platform</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <OrdersTable showAllOrders={true} />
      </div>
    </div>
  );
}
