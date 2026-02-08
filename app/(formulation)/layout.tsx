import { RouteGuard } from '@/components/auth/RouteGuard';

export default function FormulationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="formulations">
      {children}
    </RouteGuard>
  );
}
