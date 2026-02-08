import { RouteGuard } from '@/components/auth/RouteGuard';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="inventory">
      {children}
    </RouteGuard>
  );
}
