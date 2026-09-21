'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sits beside a page title. Re-fetches the page's data on demand. Pass `onRefresh`
 * for pages that load their own data in the browser; without it the server-rendered
 * page is re-fetched.
 */
export function RefreshButton({ onRefresh }: { onRefresh?: () => unknown | Promise<unknown> }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  const refresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      if (onRefresh) await onRefresh();
      else router.refresh();
    } finally {
      // Keep the spin visible long enough to register, even for fast refreshes
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <button
      type="button"
      onClick={refresh}
      title="Refresh"
      aria-label="Refresh this page"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
    >
      <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} />
    </button>
  );
}
