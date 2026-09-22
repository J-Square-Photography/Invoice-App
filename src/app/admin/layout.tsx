import { redirect } from 'next/navigation';
import { AuthProvider } from '@/components/auth-provider';
import { AdminShell } from '@/components/admin-shell';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The proxy only checks that a login token exists. This also checks the account is still
  // active, so a deactivated user can't load pages (or their data) with an old token.
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');

  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
