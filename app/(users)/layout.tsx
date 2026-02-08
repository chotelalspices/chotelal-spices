import { RouteGuard } from '@/components/auth/RouteGuard';

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="settings">
      {children}
    </RouteGuard>
  );
}
