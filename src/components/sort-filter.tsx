'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, CalendarRange } from 'lucide-react';
import { PERIODS } from '@/lib/sorting';

const selectClass =
  'h-9 rounded-md border border-neutral-200 bg-white pl-8 pr-2 text-xs font-medium text-neutral-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-950 cursor-pointer';

/** Remembers a choice (a sort order, a filter) in this browser, so a list opens the way it was left. */
export function useSavedChoice(key: string, initial: string, allowed?: readonly string[]) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jsquare-${key}`);
      if (saved && (!allowed || allowed.includes(saved))) setValue(saved);
    } catch {
      // storage can be unavailable; the choice just isn't remembered
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        localStorage.setItem(`jsquare-${key}`, next);
      } catch {
        // ignore
      }
    },
    [key]
  );

  return [value, update] as const;
}

/** "Sort by" dropdown. */
export function SortSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="relative inline-flex items-center" title="Sort by">
      <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-500" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label="Sort by">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "Any time / This month / ..." dropdown. */
export function PeriodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative inline-flex items-center" title="Show only this period">
      <CalendarRange className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-500" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-label="Period">
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
