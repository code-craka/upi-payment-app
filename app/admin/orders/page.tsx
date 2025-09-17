import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { OrdersTable } from '@/components/orders/orders-table';

export default function OrdersPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-2xl font-bold">Orders Management</h1>
      </div>

      <OrdersTable showAllOrders={true} />
    </div>
  );
}
