import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="production">
      {children}
    </RouteGuard>
  );
}
