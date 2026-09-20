'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Re-fetches the current server-rendered page when the tab regains focus and on
// a timer while the tab is visible, so data stays fresh without a manual reload.
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(refresh, intervalMs);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [router, intervalMs]);

  return null;
}
