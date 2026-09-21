'use client';

import { cn } from '@/lib/utils';
import { toggleTheme } from '@/lib/theme';

/** The J Square logo tile. Clicking it switches between light and dark mode. */
export function LogoToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
      className={cn(
        'flex items-center justify-center rounded-lg bg-neutral-900 shrink-0 cursor-pointer transition-colors',
        className
      )}
    >
      <img src="/logo-white.png" alt="J Square" className="logo-mark h-full w-full object-contain" />
    </button>
  );
}
