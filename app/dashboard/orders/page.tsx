import { getSafeUser } from '@/lib/auth/safe-auth';
import { redirect } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { OrdersTable } from '@/components/orders/orders-table';

export default async function MerchantOrdersPage() {
  const user = await getSafeUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-2xl font-bold">My Orders</h1>
      </div>

      <OrdersTable showAllOrders={false} userId={user.id} />
    </div>
  );
}
