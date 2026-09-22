'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { BANK_GROUPS, ALL_BANKS } from '@/lib/banks';
import { Loader2, Lock, LockOpen, ShieldAlert, ImagePlus, Trash2 } from 'lucide-react';

type TextKey =
  | 'companyName'
  | 'uen'
  | 'bankName'
  | 'bankAccountNumber'
  | 'bankBranchCode'
  | 'bankAccountName'
  | 'gstRegNo'
  | 'address';

type SettingsValues = Record<TextKey, string>;

const FIELDS: Array<{
  key: TextKey;
  label: string;
  help: string;
  /** Completes: "Changing this affects ..." in the unlock warning. */
  effect: string;
  mono?: boolean;
  /** May be left blank (and cleared) without breaking invoices. */
  optional?: boolean;
  /** Offer a dropdown of common Asian banks (with a Custom option) instead of plain text. */
  bankPicker?: boolean;
}> = [
  {
    key: 'companyName',
    label: 'Company Name',
    help: 'Printed on invoices and contracts, and used as the PayNow merchant name.',
    effect:
      'the studio name on new and draft invoices and contracts, and the merchant name inside their PayNow QR codes',
  },
  {
    key: 'uen',
    label: 'UEN (PayNow)',
    help: 'The business UEN customers pay to through PayNow, e.g. 201912345A.',
    effect:
      'the UEN inside PayNow QR codes and in the payment instructions on new and draft invoices. A wrong UEN sends customer payments to the wrong business',
    mono: true,
  },
  {
    key: 'bankName',
    label: 'Bank Name',
    help: 'Shown to clients paying by bank transfer.',
    effect: 'the bank name shown on new and draft invoices and their PDFs',
    bankPicker: true,
  },
  {
    key: 'bankAccountNumber',
    label: 'Bank Account Number',
    help: 'Shown to clients paying by bank transfer.',
    effect:
      'the account number clients are told to transfer to on new and draft invoices and their PDFs. A wrong number sends payments to the wrong account',
    mono: true,
  },
  {
    key: 'bankBranchCode',
    label: 'Bank Branch Code',
    help: 'Shown alongside the account number. Leave blank if your bank does not need it.',
    effect: 'the branch code shown on new and draft invoices and their PDFs',
    mono: true,
    optional: true,
  },
  {
    key: 'bankAccountName',
    label: 'Account Holder Name',
    help: 'The name the bank account is registered under.',
    effect: 'the account holder name shown on new and draft invoices and their PDFs',
  },
  {
    key: 'gstRegNo',
    label: 'GST Registration No.',
    help: 'Shown on your invoices. Required on tax invoices when you charge GST. Leave blank if you are not GST-registered.',
    effect:
      'the GST registration number shown on new and draft invoices. Invoices that charge GST are titled "Tax Invoice"',
    mono: true,
    optional: true,
  },
  {
    key: 'address',
    label: 'Business Address',
    help: 'Printed in the header of your invoices. Leave blank to omit it.',
    effect: 'the business address shown on new and draft invoices',
    optional: true,
  },
];

const MAX_QR_BYTES = 1_000_000;

/**
 * Shared unlock flow: the lock icon is step one, this warning pop-up is step two.
 */
function UnlockWarning({
  open,
  onOpenChange,
  label,
  effect,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  effect: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" /> Unlock &ldquo;{label}&rdquo;?
          </DialogTitle>
          <DialogDescription>
            You are about to make this field editable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            Changing this affects {effect}.
          </div>
          <p className="text-neutral-600">
            This only affects <strong>new and draft</strong> invoices. Invoices already sent keep the details they
            were issued with, so clients can always see the account they were told to pay. Double-check every
            character before you save, then lock the field again.
          </p>
        </div>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            <LockOpen className="mr-2 h-4 w-4" /> Yes, unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockedField({
  field,
  value,
  onSave,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  onSave: (key: TextKey, value: string) => Promise<boolean>;
}) {
  const [locked, setLocked] = useState(true);
  const [draft, setDraft] = useState(value);
  const [warnOpen, setWarnOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bank picker: true while typing a name that isn't in the dropdown list
  const [customBank, setCustomBank] = useState(false);

  // Keep the shown value in sync with what's saved while the field is locked
  useEffect(() => {
    if (locked) setDraft(value);
  }, [value, locked]);

  const cancel = () => {
    setDraft(value);
    setLocked(true);
  };

  // When unlocking the bank field, start in custom mode if the saved name isn't a listed bank
  const unlock = () => {
    setCustomBank(!!field.bankPicker && !ALL_BANKS.includes(value));
    setLocked(false);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(field.key, draft.trim());
    setSaving(false);
    if (ok) setLocked(true);
  };

  const unchanged = draft.trim() === value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`set-${field.key}`} className="text-sm font-semibold">
          {field.label}
          <em className="ml-1.5 text-xs font-normal italic text-neutral-500">{field.optional ? '(Optional)' : '(Required)'}</em>
        </Label>
        <button
          type="button"
          onClick={() => (locked ? setWarnOpen(true) : cancel())}
          title={locked ? 'Locked. Click to unlock' : 'Unlocked. Click to lock without saving'}
          aria-label={locked ? `Unlock ${field.label}` : `Lock ${field.label}`}
          className={
            locked
              ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100'
              : 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200'
          }
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-neutral-500">{field.help}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {field.bankPicker && !locked && !customBank ? (
          <>
            <Select
              id={`set-${field.key}`}
              value={ALL_BANKS.includes(draft) ? draft : ''}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
            >
              <option value="" disabled>
                Select a bank…
              </option>
              {BANK_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.banks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setCustomBank(true)}
              disabled={saving}
            >
              Custom…
            </Button>
          </>
        ) : (
          <>
            <Input
              id={`set-${field.key}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={locked || saving}
              className={field.mono ? 'font-mono' : undefined}
              placeholder={field.bankPicker && !locked ? 'Type a custom bank name' : field.optional ? 'Not set' : undefined}
              autoComplete="off"
            />
            {field.bankPicker && !locked && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => setCustomBank(false)}
                disabled={saving}
              >
                Choose from list
              </Button>
            )}
          </>
        )}
        {!locked && (
          <div className="flex gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || unchanged || (!draft.trim() && !field.optional)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; Lock
            </Button>
          </div>
        )}
      </div>
      <UnlockWarning
        open={warnOpen}
        onOpenChange={setWarnOpen}
        label={field.label}
        effect={field.effect}
        onConfirm={unlock}
      />
    </div>
  );
}

function StaticQrField({
  saved,
  onSave,
}: {
  saved: string | null;
  onSave: (value: string | null) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [locked, setLocked] = useState(true);
  const [draft, setDraft] = useState<string | null>(saved);
  const [warnOpen, setWarnOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locked) setDraft(saved);
  }, [saved, locked]);

  const cancel = () => {
    setDraft(saved);
    setLocked(true);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast({ title: 'Unsupported file', description: 'Upload a PNG or JPEG image.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      toast({ title: 'File too large', description: 'The QR image must be under 1 MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setLocked(true);
  };

  const unchanged = draft === saved;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold">Static PayNow QR Image <em className="ml-1.5 text-xs font-normal italic text-neutral-500">(Optional)</em></Label>
        <button
          type="button"
          onClick={() => (locked ? setWarnOpen(true) : cancel())}
          title={locked ? 'Locked. Click to unlock' : 'Unlocked. Click to lock without saving'}
          aria-label={locked ? 'Unlock static QR image' : 'Lock static QR image'}
          className={
            locked
              ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100'
              : 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200'
          }
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Your own PayNow QR from your banking app (PNG or JPEG, under 1 MB). Used instead of a generated code
        when an invoice&apos;s payment method is &ldquo;Static PayNow QR&rdquo;. The payer types in the amount.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Fixed white (not themed) so the QR stays scannable in dark mode */}
        <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-xl border border-neutral-300 bg-[#ffffff] p-2">
          {draft ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft} alt="Static PayNow QR" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-neutral-400">No static QR uploaded</span>
          )}
        </div>

        {!locked && (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
                <ImagePlus className="mr-2 h-4 w-4" /> {draft ? 'Choose a different image' : 'Choose image'}
              </Button>
              {draft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                  disabled={saving}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving || unchanged}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save &amp; Lock
              </Button>
            </div>
            <p className="text-xs text-neutral-500">After saving, scan the code with your banking app to confirm it pays the right account.</p>
          </div>
        )}
      </div>

      <UnlockWarning
        open={warnOpen}
        onOpenChange={setWarnOpen}
        label="Static PayNow QR Image"
        effect='the QR on new and draft invoices (and their PDFs) whose payment method is "Static PayNow QR". Customers will pay whichever account this QR belongs to'
        onConfirm={() => setLocked(false)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<SettingsValues | null>(null);
  const [staticQr, setStaticQr] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null }>({
    updatedAt: null,
    updatedBy: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setValues(data.settings);
      setStaticQr(data.staticQrDataUrl ?? null);
      setUsingSample(!!data.usingSampleDetails);
      setMeta({ updatedAt: data.updatedAt, updatedBy: data.updatedBy });
    } catch {
      toast({ title: 'Error', description: 'Failed to load settings.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Record<string, string | null>, successMessage: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Not saved', description: data.error || 'Could not save settings.', variant: 'destructive' });
        return false;
      }
      setValues(data.settings);
      setStaticQr(data.staticQrDataUrl ?? null);
      setUsingSample(!!data.usingSampleDetails);
      setMeta({ updatedAt: new Date().toISOString(), updatedBy: user?.email ?? null });
      toast({ title: 'Saved', description: successMessage });
      return true;
    } catch {
      toast({ title: 'Error', description: 'Network error occurred.', variant: 'destructive' });
      return false;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-500">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Company &amp; Payment Settings</h1><RefreshButton onRefresh={load} /></div>
        <p className="text-neutral-500">
          The details on every invoice, contract and PayNow QR code. Fields are locked so nothing changes by
          accident.
        </p>
        {meta.updatedAt && (
          <p className="mt-1 text-xs text-neutral-400">
            Last changed {new Date(meta.updatedAt).toLocaleString('en-SG')}
            {meta.updatedBy ? ` by ${meta.updatedBy}` : ''}
          </p>
        )}
      </div>

      {usingSample && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>These are sample values, not your real details.</strong> The UEN (202012345M) and bank account (012-345678-9) below are built-in placeholders.
          Unlock each field and enter your real UEN and bank account: until you do, invoices can&apos;t be marked Sent, and PayNow QR codes would pay the wrong account.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company &amp; Bank Details</CardTitle>
          <CardDescription>
            Used to generate the dynamic PayNow QR code and the payment instructions on invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {values &&
            FIELDS.map((field) => (
              <LockedField
                key={field.key}
                field={field}
                value={values[field.key]}
                onSave={(key, v) => save({ [key]: v }, `${field.label} updated.`)}
              />
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Static PayNow QR</CardTitle>
          <CardDescription>
            For when you would rather show your own QR than a generated one. Choose &ldquo;Static PayNow QR&rdquo; as the
            payment method when creating an invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaticQrField
            saved={staticQr}
            onSave={(v) => save({ staticQrDataUrl: v }, v ? 'Static QR saved.' : 'Static QR removed.')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
