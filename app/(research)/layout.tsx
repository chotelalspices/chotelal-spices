import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requiredModule="research">
      {children}
    </RouteGuard>
  );
}
