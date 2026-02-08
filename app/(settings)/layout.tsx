import { RouteGuard } from '@/components/auth/RouteGuard';

export default function SettingsLayout({
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
