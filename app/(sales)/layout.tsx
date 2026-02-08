import { RouteGuard } from '@/components/auth/RouteGuard';

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="sales">
      {children}
    </RouteGuard>
  );
}
