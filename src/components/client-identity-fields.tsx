'use client';

import { Building2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldTag } from '@/components/field-tag';
import { SalutationNameFields, type NameFieldsValue } from '@/components/salutation-name-fields';
import { CLIENT_TYPE, CLIENT_TYPES, CLIENT_TYPE_LABELS, CONTACT_ROLE_MAX_LENGTH, type ClientType } from '@/lib/client-name';

export interface ClientIdentityValue extends NameFieldsValue {
  /** Empty until the user picks one: a new client must be classified on purpose, never by default */
  clientType: ClientType | '';
  companyName: string;
  contactRole: string;
}

const TYPE_HINTS: Record<ClientType, string> = {
  [CLIENT_TYPE.INDIVIDUAL]: 'A person booking for themselves, e.g. a couple or a private shoot.',
  [CLIENT_TYPE.ORGANISATION]: 'A company, school, club or other group, dealt with through a contact person.',
};
const TYPE_ICONS: Record<ClientType, typeof User> = {
  [CLIENT_TYPE.INDIVIDUAL]: User,
  [CLIENT_TYPE.ORGANISATION]: Building2,
};

/**
 * Who the client is. An individual is billed in their own name; an organisation is billed in its
 * name "Attn:" its contact person (the representative you deal with). Lives inside the client
 * forms' two-column grid.
 */
export function ClientIdentityFields({
  value,
  onChange,
  idPrefix,
}: {
  value: ClientIdentityValue;
  onChange: (next: ClientIdentityValue) => void;
  idPrefix: string;
}) {
  const pickType = (clientType: ClientType) => {
    if (clientType === value.clientType) return;
    // A name typed before choosing (e.g. carried over from a search box) lands in the right box
    if (clientType === CLIENT_TYPE.INDIVIDUAL && !value.firstName.trim() && value.companyName.trim()) {
      onChange({ ...value, clientType, firstName: value.companyName.trim() });
    } else {
      onChange({ ...value, clientType });
    }
  };

  const nameFields = { salutation: value.salutation, firstName: value.firstName, lastName: value.lastName };
  const setNameFields = (next: NameFieldsValue) => onChange({ ...value, ...next });

  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <Label>Client Type <FieldTag required /></Label>
        <div role="radiogroup" aria-label="Client type" className="grid grid-cols-2 gap-2">
          {CLIENT_TYPES.map((t) => {
            const selected = value.clientType === t;
            const Icon = TYPE_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickType(t)}
                className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-neutral-500'}`} />
                <span>
                  <span className="block text-sm font-medium">{CLIENT_TYPE_LABELS[t]}</span>
                  <span className="block text-xs text-neutral-500">{TYPE_HINTS[t]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {value.clientType === CLIENT_TYPE.INDIVIDUAL && (
        <SalutationNameFields key="individual" idPrefix={idPrefix} label="Client Name" required value={nameFields} onChange={setNameFields} />
      )}

      {value.clientType === CLIENT_TYPE.ORGANISATION && (
        <>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-companyName`}>Organisation Name <FieldTag required /></Label>
            <Input
              id={`${idPrefix}-companyName`}
              required
              placeholder="e.g. Singapore Polytechnic (SP) Academic Club"
              value={value.companyName}
              onChange={(e) => onChange({ ...value, companyName: e.target.value })}
            />
          </div>
          <SalutationNameFields
            key="organisation"
            idPrefix={idPrefix}
            label="Contact Person (Representative)"
            hint={'The person you deal with. Printed as "Attn:" on quotations, invoices and contracts.'}
            value={nameFields}
            onChange={setNameFields}
          />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-contactRole`}>Contact Person&apos;s Role <FieldTag /></Label>
            <Input
              id={`${idPrefix}-contactRole`}
              maxLength={CONTACT_ROLE_MAX_LENGTH}
              placeholder="e.g. Teacher-in-charge, Event Manager"
              value={value.contactRole}
              onChange={(e) => onChange({ ...value, contactRole: e.target.value })}
            />
          </div>
        </>
      )}
    </>
  );
}
