'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  iso: string;
  name: string;
  dial: string;
}

/** Singapore first, then the rest of Asia, then other common countries. */
export const COUNTRIES: Country[] = [
  { iso: 'SG', name: 'Singapore', dial: '+65' },
  { iso: 'MY', name: 'Malaysia', dial: '+60' },
  { iso: 'ID', name: 'Indonesia', dial: '+62' },
  { iso: 'TH', name: 'Thailand', dial: '+66' },
  { iso: 'VN', name: 'Vietnam', dial: '+84' },
  { iso: 'PH', name: 'Philippines', dial: '+63' },
  { iso: 'BN', name: 'Brunei', dial: '+673' },
  { iso: 'KH', name: 'Cambodia', dial: '+855' },
  { iso: 'LA', name: 'Laos', dial: '+856' },
  { iso: 'MM', name: 'Myanmar', dial: '+95' },
  { iso: 'HK', name: 'Hong Kong', dial: '+852' },
  { iso: 'MO', name: 'Macau', dial: '+853' },
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'TW', name: 'Taiwan', dial: '+886' },
  { iso: 'JP', name: 'Japan', dial: '+81' },
  { iso: 'KR', name: 'South Korea', dial: '+82' },
  { iso: 'IN', name: 'India', dial: '+91' },
  { iso: 'PK', name: 'Pakistan', dial: '+92' },
  { iso: 'BD', name: 'Bangladesh', dial: '+880' },
  { iso: 'LK', name: 'Sri Lanka', dial: '+94' },
  { iso: 'NP', name: 'Nepal', dial: '+977' },
  { iso: 'MV', name: 'Maldives', dial: '+960' },
  { iso: 'BT', name: 'Bhutan', dial: '+975' },
  { iso: 'MN', name: 'Mongolia', dial: '+976' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { iso: 'QA', name: 'Qatar', dial: '+974' },
  { iso: 'KW', name: 'Kuwait', dial: '+965' },
  { iso: 'BH', name: 'Bahrain', dial: '+973' },
  { iso: 'OM', name: 'Oman', dial: '+968' },
  { iso: 'IL', name: 'Israel', dial: '+972' },
  { iso: 'TR', name: 'Türkiye', dial: '+90' },
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'NZ', name: 'New Zealand', dial: '+64' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'IE', name: 'Ireland', dial: '+353' },
  { iso: 'US', name: 'United States', dial: '+1' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'IT', name: 'Italy', dial: '+39' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
  { iso: 'NL', name: 'Netherlands', dial: '+31' },
  { iso: 'CH', name: 'Switzerland', dial: '+41' },
  { iso: 'SE', name: 'Sweden', dial: '+46' },
  { iso: 'NO', name: 'Norway', dial: '+47' },
  { iso: 'DK', name: 'Denmark', dial: '+45' },
  { iso: 'RU', name: 'Russia', dial: '+7' },
  { iso: 'ZA', name: 'South Africa', dial: '+27' },
  { iso: 'EG', name: 'Egypt', dial: '+20' },
  { iso: 'NG', name: 'Nigeria', dial: '+234' },
  { iso: 'BR', name: 'Brazil', dial: '+55' },
  { iso: 'MX', name: 'Mexico', dial: '+52' },
];

const DEFAULT_COUNTRY = COUNTRIES[0];
// Longest dial codes first so "+886" is matched before "+8"
const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** Splits a stored value like "+65 9123 4567" into a country and the local number. */
export function splitPhone(value: string, preferredIso?: string): { country: Country; national: string } {
  const v = value.trim();
  if (v.startsWith('+')) {
    const compact = v.replace(/\s+/g, '');
    for (const c of BY_DIAL_LENGTH) {
      if (compact.startsWith(c.dial)) {
        const sameDial = COUNTRIES.filter((x) => x.dial === c.dial);
        const country = sameDial.find((x) => x.iso === preferredIso) ?? sameDial[0];
        // Keep the number's own spacing when the code is written without a gap in it
        const national = v.startsWith(c.dial) ? v.slice(c.dial.length).trim() : compact.slice(c.dial.length);
        return { country, national };
      }
    }
  }
  // No country code stored (older records): treat it as a local number
  return { country: COUNTRIES.find((c) => c.iso === preferredIso) ?? DEFAULT_COUNTRY, national: v };
}

export const compose = (country: Country, national: string) => (national.trim() ? `${country.dial} ${national.trim()}` : '');

/**
 * Phone number with a country-code dropdown. The value is stored as a single string
 * such as "+65 9123 4567" (empty when no number has been typed).
 */
export function PhoneInput({
  value,
  onChange,
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  const initial = splitPhone(value);
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lastEmitted = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Follow outside changes (form reset, opening a different record) but not our own edits
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const next = splitPhone(value, country.iso);
      setCountry(next.country);
      setNational(next.national);
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close the list when clicking elsewhere or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const emit = (c: Country, n: string) => {
    const next = compose(c, n);
    lastEmitted.current = next;
    onChange(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || c.dial.replace('+', '').startsWith(q)
    );
  }, [query]);

  return (
    <div ref={rootRef} className="relative flex gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${country.name} ${country.dial}`}
        className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-transparent px-2.5 text-sm shadow-sm transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-xs font-semibold text-neutral-500">{country.iso}</span>
        <span className="font-medium">{country.dial}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-neutral-500 transition-transform', open && 'rotate-180')} />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={national}
        onChange={(e) => {
          // digits, spaces and dashes only
          const cleaned = e.target.value.replace(/[^\d\s-]/g, '');
          setNational(cleaned);
          emit(country, cleaned);
        }}
        placeholder="Phone number"
        className="flex h-9 min-w-0 flex-1 rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[85vw] rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-neutral-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-500">No matching country</li>
            ) : (
              filtered.map((c) => {
                const selected = c.iso === country.iso;
                return (
                  <li key={c.iso} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setCountry(c);
                        setOpen(false);
                        emit(c, national);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-neutral-100',
                        selected && 'bg-neutral-100 font-semibold'
                      )}
                    >
                      <span className="truncate">
                        <span className="mr-2 text-xs font-semibold text-neutral-500">{c.iso}</span>
                        {c.name}
                      </span>
                      <span className="shrink-0 text-neutral-500">{c.dial}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
