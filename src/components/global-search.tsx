'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, FolderKanban, FileText, ClipboardList, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Hit {
  key: string;
  href: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
  group: string;
}

/** Ctrl+K (or Cmd+K, or "/") opens a box that finds any client, project or invoice. */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const next: Hit[] = [
          ...data.clients.map((c: any) => ({
            key: `c-${c.id}`, href: `/admin/clients/${c.id}`, icon: Users, group: 'Clients',
            title: c.companyName, subtitle: c.contactName || 'Client',
          })),
          ...data.projects.map((p: any) => ({
            key: `p-${p.id}`, href: `/admin/projects/${p.id}`, icon: FolderKanban, group: 'Projects',
            title: p.title, subtitle: p.client?.companyName ?? '',
          })),
          ...(data.quotes ?? []).map((qt: any) => ({
            key: `qt-${qt.id}`, href: `/admin/quotes/${qt.id}`, icon: ClipboardList, group: 'Quotations',
            title: qt.quoteNumber, subtitle: `${qt.project?.client?.companyName ?? ''} · ${qt.project?.title ?? ''} · SGD $${Number(qt.totalAmount).toFixed(2)} · ${qt.status}`,
          })),
          ...data.invoices.map((i: any) => ({
            key: `i-${i.id}`, href: `/admin/invoices/${i.id}`, icon: FileText, group: 'Invoices',
            title: i.invoiceNumber, subtitle: `${i.project?.client?.companyName ?? ''} · ${i.project?.title ?? ''} · SGD $${Number(i.totalAmount).toFixed(2)} · ${i.status}`,
          })),
        ];
        setHits(next);
        setActive(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onOpenChange(false);
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 sm:mb-[20vh]">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 pr-12">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, projects, invoices..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            aria-label="Search"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {!q.trim() ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              Type to search. Use <kbd className="rounded border px-1 text-xs">↑</kbd> <kbd className="rounded border px-1 text-xs">↓</kbd> and{' '}
              <kbd className="rounded border px-1 text-xs">Enter</kbd> to open.
            </p>
          ) : hits.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">Nothing found for &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            hits.map((h, idx) => (
              <div key={h.key}>
                {(idx === 0 || hits[idx - 1].group !== h.group) && (
                  <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{h.group}</p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${idx === active ? 'bg-neutral-100' : ''}`}
                >
                  <h.icon className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">{h.title}</span>
                    <span className="block truncate text-xs text-neutral-500">{h.subtitle}</span>
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
