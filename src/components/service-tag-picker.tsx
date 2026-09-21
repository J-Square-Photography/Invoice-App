'use client';

import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SERVICE_TAGS, displayTags } from '@/lib/service-tags';

/**
 * Pick any number of services for a project. Tapping a chip toggles it, so a
 * project can be photography + videography + photobooth in any combination.
 */
export function ServiceTagPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Project services">
      {SERVICE_TAGS.map((tag) => {
        const selected = value.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => toggle(tag.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              selected
                ? 'border-neutral-900 bg-neutral-900 text-neutral-50'
                : 'border-neutral-300 bg-transparent text-neutral-700 hover:bg-neutral-100'
            )}
          >
            {selected && <Check className="h-3 w-3" />}
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only tags for a project; older projects without tags show their old single type. */
export function ServiceTagBadges({
  tags,
  legacyType,
  className,
}: {
  tags?: string[] | null;
  legacyType?: string | null;
  className?: string;
}) {
  const labels = displayTags(tags, legacyType);
  if (labels.length === 0) return <span className="text-xs text-neutral-500">No services</span>;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {labels.map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
    </div>
  );
}
