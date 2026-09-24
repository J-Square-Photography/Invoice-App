'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface SkillCategoryOption {
  id: string;
  label: string;
  options: string[];
}

/** Positions a floating panel under (or, if there's no room, above) a trigger button, closing on
 * outside click, Escape, scroll or resize - the same portal-to-body approach the Dialog uses, just
 * anchored to a button instead of centered, so it reads as a small popover rather than a modal. */
function FloatingPanel({
  anchorRef,
  onClose,
  children,
  widthClass = 'w-56',
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({ visibility: 'hidden' });

  React.useEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const panelWidth = panelRef.current?.offsetWidth ?? 224;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < panelHeight + 12 && rect.top > spaceBelow;
      setStyle({
        position: 'fixed',
        left: Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)),
        top: openUpward ? undefined : rect.bottom + 6,
        bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
        visibility: 'visible',
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorRef]);

  React.useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchorRef, onClose]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={cn('z-[60] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg', widthClass)}
    >
      {children}
    </div>,
    document.body
  );
}

function SkillPill({
  category,
  value,
  onChange,
}: {
  category: SkillCategoryOption;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          value
            ? 'border-neutral-900 bg-neutral-900 text-neutral-50'
            : 'border-neutral-300 bg-transparent text-neutral-700 hover:bg-neutral-100'
        )}
      >
        {value ? `${category.label}: ${value}` : category.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <FloatingPanel anchorRef={anchorRef} onClose={() => setOpen(false)}>
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{category.label}</p>
          <div className="flex flex-col">
            {category.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
              >
                {opt}
                {value === opt && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="mt-1 rounded-md border-t px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Clear
              </button>
            )}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}

function AddCategoryPill({ onAdd }: { onAdd: (name: string, options: string[]) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [options, setOptions] = React.useState(['', '']);
  const [saving, setSaving] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setName('');
    setOptions(['', '']);
  };

  const save = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!name.trim() || cleanOptions.length === 0) return;
    setSaving(true);
    try {
      await onAdd(name.trim(), cleanOptions);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
      >
        <Plus className="h-3 w-3" /> Add skill
      </button>
      {open && (
        <FloatingPanel anchorRef={anchorRef} onClose={close} widthClass="w-72">
          <div className="space-y-2 p-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">New skill category</p>
            <Input placeholder="e.g. Drone Operation" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            <div className="space-y-1.5">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => setOptions((o) => o.map((x, i) => (i === idx ? e.target.value : x)))}
                    className="h-8 text-sm"
                  />
                  {options.length > 1 && (
                    <button type="button" onClick={() => setOptions((o) => o.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-neutral-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions((o) => [...o, ''])}
                className="text-xs text-primary hover:underline"
              >
                + Add option
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={close}>Cancel</Button>
              <Button type="button" size="sm" className="h-7 text-xs" disabled={saving} onClick={save}>Save</Button>
            </div>
          </div>
        </FloatingPanel>
      )}
    </>
  );
}

/** A row of pill buttons, one per skill category - tap one to pop open its options and pick a
 * value, tap again to change it. The optional "+ Add skill" pill lets an admin define a whole new
 * category (name + its own set of options) on the fly. */
export function SkillTagPicker({
  categories,
  values,
  onChange,
  onAddCategory,
}: {
  categories: SkillCategoryOption[];
  values: Record<string, string | null | undefined>;
  onChange: (categoryId: string, value: string | null) => void;
  onAddCategory?: (name: string, options: string[]) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((category) => (
        <SkillPill key={category.id} category={category} value={values[category.id] ?? null} onChange={(v) => onChange(category.id, v)} />
      ))}
      {onAddCategory && <AddCategoryPill onAdd={onAddCategory} />}
    </div>
  );
}
