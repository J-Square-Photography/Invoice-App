'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FieldTag } from '@/components/field-tag';
import { SALUTATIONS, isPresetSalutation } from '@/lib/salutations';

export interface NameFieldsValue {
  salutation: string;
  firstName: string;
  lastName: string;
}

export const EMPTY_NAME_FIELDS: NameFieldsValue = { salutation: '', firstName: '', lastName: '' };

/**
 * Salutation + Given Name + Family Name, in separate boxes so the printed name on invoices and
 * contracts is built consistently and can carry a correct honorific ("Dear Mr Tan,"). This is
 * deliberately two name boxes, not three: passports and airline tickets use exactly "Given
 * Name(s)" and "Surname" (no middle-name field exists in that standard), because a rigid
 * first/middle/last split produces wrong data for family-name-first naming orders (Chinese,
 * Korean), patronymic names with no family name (Malay bin/binti), many South Indian names
 * (no surname), and single-name clients. Family Name is always optional here for that reason.
 */
export function SalutationNameFields({
  value,
  onChange,
  idPrefix,
}: {
  value: NameFieldsValue;
  onChange: (next: NameFieldsValue) => void;
  idPrefix: string;
}) {
  // Lazily read once at mount: the surrounding dialog fully remounts this component whenever it
  // switches to a different client (it always passes back through "view" mode first), so a fresh
  // read here is enough to notice an existing custom title without extra effects.
  const [otherMode, setOtherMode] = useState(() => value.salutation !== '' && !isPresetSalutation(value.salutation));

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={`${idPrefix}-firstName`}>Contact Person <FieldTag /></Label>
      <div className="grid grid-cols-1 sm:grid-cols-[5.5rem_1fr_1fr] gap-2">
        <Select
          aria-label="Salutation"
          value={otherMode ? 'OTHER' : value.salutation}
          onChange={(e) => {
            if (e.target.value === 'OTHER') {
              setOtherMode(true);
              onChange({ ...value, salutation: '' });
            } else {
              setOtherMode(false);
              onChange({ ...value, salutation: e.target.value });
            }
          }}
        >
          <option value="">&mdash;</option>
          {SALUTATIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="OTHER">Other&hellip;</option>
        </Select>
        <Input
          id={`${idPrefix}-firstName`}
          placeholder="Given / first name"
          value={value.firstName}
          onChange={(e) => onChange({ ...value, firstName: e.target.value })}
        />
        <Input
          aria-label="Family name / surname"
          placeholder="Family name (optional)"
          value={value.lastName}
          onChange={(e) => onChange({ ...value, lastName: e.target.value })}
        />
      </div>
      {otherMode && (
        <Input
          autoFocus
          aria-label="Custom salutation"
          placeholder="Type the title, e.g. Datuk, Ustaz, Rev"
          value={value.salutation}
          onChange={(e) => onChange({ ...value, salutation: e.target.value })}
          className="max-w-xs"
        />
      )}
      <p className="text-xs text-neutral-500">Leave family name blank if this client only uses one name.</p>
    </div>
  );
}
