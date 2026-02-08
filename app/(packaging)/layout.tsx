import { RouteGuard } from '@/components/auth/RouteGuard';

export default function PackagingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="packaging">
      {children}
    </RouteGuard>
  );
}
