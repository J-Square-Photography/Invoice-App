'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { SKILL_DISCIPLINES, SKILL_LEVELS, type SkillDiscipline, type SkillLevel, type RequestedCrewItem } from '@/lib/skill-levels';

export function RequestedCrewPicker({ value, onChange }: { value: RequestedCrewItem[]; onChange: (v: RequestedCrewItem[]) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDiscipline, setDraftDiscipline] = useState<SkillDiscipline>('Photography');
  const [draftLevel, setDraftLevel] = useState<SkillLevel>('Beginner');
  const [draftCount, setDraftCount] = useState('1');

  const add = () => {
    const count = Math.max(1, Math.min(50, Number(draftCount) || 1));
    onChange([...value, { discipline: draftDiscipline, level: draftLevel, count }]);
    setPickerOpen(false);
    setDraftCount('1');
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-medium">
            {item.count}x {item.discipline} ({item.level})
            <button type="button" onClick={() => remove(i)} className="rounded-full p-0.5 hover:bg-neutral-200">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Plus className="h-3 w-3" /> Request crew
          </button>
        )}
      </div>
      {pickerOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Discipline</label>
            <Select value={draftDiscipline} onChange={(e) => setDraftDiscipline(e.target.value as SkillDiscipline)} className="h-8 text-xs">
              {SKILL_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Skill Level</label>
            <Select value={draftLevel} onChange={(e) => setDraftLevel(e.target.value as SkillLevel)} className="h-8 text-xs">
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </div>
          <div className="space-y-1 w-20">
            <label className="text-xs text-neutral-500">Count</label>
            <Input type="number" min="1" max="50" value={draftCount} onChange={(e) => setDraftCount(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button type="button" size="sm" onClick={add}>Add</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
