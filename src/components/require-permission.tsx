'use client';

import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import type { PermissionKey } from '@/lib/permissions';

/** Guards a page's content: shows a spinner while the session loads, an access-denied message if
 * the signed-in user lacks the permission, and the page itself otherwise. Mirrors the nav, which
 * hides the link for the same reason — this is the actual enforcement, the nav is just a hint. */
export function RequirePermission({ permission, children }: { permission: PermissionKey; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!can(permission)) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-500">You do not have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
