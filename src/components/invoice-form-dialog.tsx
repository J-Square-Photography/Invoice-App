'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Loader2, Trash2, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateInvoiceTotals,
  processDiscounts,
  parseStoredDiscounts,
  describeDiscount,
  MAX_DISCOUNTS,
  type DiscountType,
} from '@/lib/invoice-calculations';
import { PHOTOBOOTH_PACKAGES } from '@/lib/photobooth-presets';
import { SERVICE_CATALOGUE, findServiceItem } from '@/lib/service-presets';
import { tagLabel } from '@/lib/service-tags';
import { singaporeDateParts, defaultInvoiceDueDate, addOneMonthSingapore } from '@/lib/time';
import { logCancelledAction } from '@/lib/log-cancel';

interface DiscountRow {
  name: string;
  type: DiscountType;
  /** Kept as text so decimals can be typed naturally. */
  value: string;
}

interface LineItemInput {
  description: string;
  quantity: number;
  /** The line price: what the client pays for this line. */
  amount: number;
}

interface ProjectOption {
  id: string;
  title: string;
  serviceTags?: string[];
  shootDate?: string | null;
  client: {
    companyName: string;
    contactName: string;
  };
}

/** The subset of an invoice the form needs in order to edit it. */
export interface EditableInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  paymentMethod: string | null;
  isGstApplied: boolean;
  gstRate: number;
  notes: string | null;
  /** Admin-only remarks. Not present on quotations, which don't have this field. */
  internalNotes?: string | null;
  paidAmount: number;
  project: { id: string };
  items: Array<{ description: string; quantity: number; unitPrice: number; amount?: number }>;
  contract: { id: string } | null;
  /** Discounts saved on the invoice, in the order they were applied. */
  discounts?: unknown;
}

// For quotations the form receives an invoice-shaped record: invoiceNumber is the quote number
// and dueDate is the valid-until date.
const DEFAULT_GST_RATE = 9;
const DEFAULT_ITEM: LineItemInput = { description: 'Photography / Videography Services', quantity: 1, amount: 0 };

export function InvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
  defaultProjectId,
  kind = 'invoice',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provide an invoice to edit it; omit to create a new one. */
  invoice?: EditableInvoice | null;
  onSaved: () => void;
  /** When creating, start with this project already chosen. */
  defaultProjectId?: string;
  /** 'quote' reuses this form for quotations: a valid-until date, no payment method. */
  kind?: 'invoice' | 'quote';
}) {
  const { toast } = useToast();
  const isEdit = !!invoice;
  const isQuote = kind === 'quote';
  const noun = isQuote ? 'quotation' : 'invoice';

  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  // Presets are limited to the project's service tags unless this is switched on
  const [showAllServices, setShowAllServices] = useState(false);
  const [dueDate, setDueDate] = useState(() => (kind === 'quote' ? addOneMonthSingapore() : defaultInvoiceDueDate()));
  const [paymentMethod, setPaymentMethod] = useState('PAYNOW_QR');
  const [isGstApplied, setIsGstApplied] = useState(false);
  const [gstRate, setGstRate] = useState(DEFAULT_GST_RATE);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [items, setItems] = useState<LineItemInput[]>([{ ...DEFAULT_ITEM }]);
  const [hasStaticQr, setHasStaticQr] = useState(false);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);

  // Amounts/project can't change once a contract exists or the invoice is void
  const lockAmounts = isEdit && (!!invoice?.contract || invoice?.status === 'VOID');

  // Which services' prices to offer: only those tagged on the chosen project
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectTags = selectedProject?.serviceTags ?? [];
  const restrictToTags = projectTags.length > 0 && !showAllServices;
  const visibleServices = restrictToTags ? SERVICE_CATALOGUE.filter((s) => projectTags.includes(s.id)) : SERVICE_CATALOGUE;
  const showPhotoboothQuick = visibleServices.some((s) => s.id === 'dslr-photobooth');

  // Start each invoice (or project change) with the project's own services
  useEffect(() => {
    setShowAllServices(false);
  }, [selectedProjectId, open]);

  // Load projects and (re)initialise the form each time the dialog opens
  useEffect(() => {
    if (!open) return;

    if (invoice) {
      setSelectedProjectId(invoice.project.id);
      setDueDate(new Date(invoice.dueDate).toISOString().split('T')[0]);
      setPaymentMethod(invoice.paymentMethod || 'PAYNOW_QR');
      setIsGstApplied(invoice.isGstApplied);
      setGstRate(invoice.gstRate || DEFAULT_GST_RATE);
      setNotes(invoice.notes || '');
      setInternalNotes(invoice.internalNotes || '');
      setDiscounts(
        parseStoredDiscounts(invoice.discounts).map((d) => ({
          name: d.name ?? '',
          type: d.type === 'FLAT' ? 'FLAT' : 'PERCENT',
          value: d.value !== undefined ? String(d.value) : '',
        }))
      );
      setItems(
        invoice.items.length > 0
          ? invoice.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              amount: Number(i.amount ?? i.quantity * Number(i.unitPrice)),
            }))
          : [{ ...DEFAULT_ITEM }]
      );
    } else {
      setSelectedProjectId(defaultProjectId ?? '');
      setDueDate(isQuote ? addOneMonthSingapore() : defaultInvoiceDueDate());
      setPaymentMethod('PAYNOW_QR');
      setIsGstApplied(false);
      setGstRate(DEFAULT_GST_RATE);
      setNotes('');
      setInternalNotes('');
      setDiscounts([]);
      setItems([{ ...DEFAULT_ITEM }]);
    }

    let cancelled = false;
    // Whether a static PayNow QR has been uploaded decides if that method can be picked
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setHasStaticQr(!!d.hasStaticQr);
      })
      .catch(() => {});
    (async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch('/api/projects');
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: ProjectOption[] = data.projects || [];
          setProjects(list);
          // A new document starts on the project it was opened from, or with none chosen: guessing the
          // newest project made it easy to invoice the wrong client without noticing
          if (!invoice) {
            const chosenId = defaultProjectId && list.some((p) => p.id === defaultProjectId) ? defaultProjectId : '';
            setSelectedProjectId(chosenId);
            if (chosenId && !isQuote) {
              const proj = list.find((p) => p.id === chosenId);
              if (proj?.shootDate) {
                setDueDate(defaultInvoiceDueDate(proj.shootDate));
              }
            }
          }
        }
      } catch {
        if (!cancelled) toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: 1, amount: 0 }]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItemInput, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'quantity') return { ...item, quantity: Math.max(1, parseInt(value.toString() || '1', 10)) };
        if (field === 'amount') return { ...item, amount: Math.max(0, parseFloat(value.toString() || '0')) };
        return { ...item, description: value.toString() };
      })
    );
  };

  const applyPreset = (preset: { name: string; description: string; price: number }, replaceIndex?: number) => {
    if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < items.length) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === replaceIndex ? { description: preset.description, quantity: 1, amount: preset.price } : item
        )
      );
      toast({
        title: 'Preset Applied',
        description: preset.price > 0 ? `${preset.name} set ($${preset.price.toFixed(2)}).` : `${preset.name} set. Enter the quoted price.`,
      });
      return;
    }

    // If only the untouched default item exists, replace it
    if (
      items.length === 1 &&
      (!items[0].description || items[0].description === DEFAULT_ITEM.description) &&
      items[0].amount === 0
    ) {
      setItems([{ description: preset.description, quantity: 1, amount: preset.price }]);
    } else {
      setItems((prev) => [...prev, { description: preset.description, quantity: 1, amount: preset.price }]);
    }
    toast({
      title: 'Preset Added',
      description: preset.price > 0 ? `${preset.name} added ($${preset.price.toFixed(2)}).` : `${preset.name} added. Enter the quoted price.`,
    });
  };

  const addDiscount = () =>
    setDiscounts((prev) => (prev.length >= MAX_DISCOUNTS ? prev : [...prev, { name: '', type: 'PERCENT', value: '' }]));
  const removeDiscount = (index: number) => setDiscounts((prev) => prev.filter((_, i) => i !== index));
  const updateDiscount = (index: number, patch: Partial<DiscountRow>) =>
    setDiscounts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const moveDiscount = (index: number, direction: -1 | 1) =>
    setDiscounts((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // The same calculation the server uses, so the preview always matches the saved invoice
  const discountInputs = discounts.map((d) => ({ name: d.name, type: d.type, value: d.value }));
  const preview = calculateInvoiceTotals(
    items.map((i) => ({ description: i.description, quantity: i.quantity, amount: i.amount })),
    { isGstApplied, gstRate, discounts: discountInputs }
  );
  // What each row takes off, following the running price down the list (null while a row is empty)
  let runningPrice = preview.subtotal;
  const rowStages = discountInputs.map((d) => {
    const [applied] = processDiscounts(runningPrice, [d]);
    if (applied) runningPrice = applied.priceAfter;
    return applied ?? null;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: 'Validation Error', description: 'Please select a project', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      const base = isQuote ? '/api/quotes' : '/api/invoices';
      // The two differ only in the date field (valid-until vs due) and the payment method
      const dateAndMethod = isQuote ? { validUntil: dueDate } : { dueDate, paymentMethod };
      // Quotations don't have an internal-notes field
      const internalNotesField = isQuote ? {} : { internalNotes };
      if (isEdit && invoice) {
        const body = lockAmounts
          ? { ...dateAndMethod, notes, ...internalNotesField }
          : { projectId: selectedProjectId, ...dateAndMethod, isGstApplied, gstRate, notes, ...internalNotesField, items, discounts: discountInputs };
        res = await fetch(`${base}/${invoice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: selectedProjectId, ...dateAndMethod, isGstApplied, gstRate, notes, ...internalNotesField, items, discounts: discountInputs }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || `Failed to ${isEdit ? 'update' : 'create'} ${noun}`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: isEdit
          ? `${isQuote ? 'Quotation' : 'Invoice'} ${invoice?.invoiceNumber} updated.`
          : `${isQuote ? 'Quotation' : 'Invoice'} ${(isQuote ? data.quote?.quoteNumber : data.invoice?.invoiceNumber) ?? ''} created!`,
      });
      onOpenChange(false);
      onSaved();
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const paid = invoice ? Number(invoice.paidAmount) : 0;

  // Only worth logging when a create flow (not editing an existing record) is abandoned
  const handleDismiss = (next: boolean) => {
    if (!next && !isEdit) logCancelledAction(isQuote ? 'QUOTE' : 'INVOICE', `Cancelled creating a new ${noun}.`);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${isQuote ? 'Quotation' : 'Invoice'} ${invoice?.invoiceNumber}` : isQuote ? 'Create New Quotation' : 'Create New Invoice'}</DialogTitle>
          <DialogDescription>
            {isQuote
              ? isEdit
                ? 'Change what is being quoted. Totals are recalculated automatically.'
                : 'Price a job before it is confirmed. When the client says yes, convert it to an invoice in one click.'
              : isEdit
                ? 'Correct the details of this invoice. Totals and the outstanding balance are recalculated automatically.'
                : 'Draft an invoice with Singapore EMVCo PayNow SGQR code and 9% GST.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isEdit && lockAmounts && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {invoice?.status === 'VOID'
                ? 'This invoice is void, so its project, line items and GST are locked. You can still change the due date, payment method and notes.'
                : 'A contract has been generated from this invoice, so its project, line items and GST are locked. Delete the contract first to change them. You can still change the due date, payment method and notes.'}
            </div>
          )}
          {isEdit && !lockAmounts && paid > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              SGD ${paid.toFixed(2)} has already been paid on this invoice. The new total can&apos;t be lower than that.
            </div>
          )}

          {/* Project Selector */}
          <div className="space-y-2">
            <Label htmlFor="inv-projectId">Project / Client *</Label>
            {loadingProjects ? (
              <div className="flex items-center text-sm text-neutral-500 py-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-amber-600">
                No projects available. Please create a project first before generating a {noun}.
              </p>
            ) : (
              <Select
                id="inv-projectId"
                value={selectedProjectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedProjectId(nextId);
                  if (!isEdit && !isQuote) {
                    const proj = projects.find((p) => p.id === nextId);
                    setDueDate(defaultInvoiceDueDate(proj?.shootDate));
                  }
                }}
                disabled={lockAmounts}
                required
              >
                <option value="" disabled>
                  Choose a project...
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.client.companyName} — {p.title}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Dates & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-dueDate">{isQuote ? 'Valid Until *' : 'Payment Due Date *'}</Label>
              <Input
                id="inv-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            {!isQuote && (
            <div className="space-y-2">
              <Label htmlFor="inv-paymentMethod">Primary Payment Method</Label>
              <Select
                id="inv-paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="PAYNOW_QR">Dynamic PayNow SGQR (Recommended)</option>
                <option value="PAYNOW_STATIC_QR" disabled={!hasStaticQr}>
                  {hasStaticQr ? 'Static PayNow QR (uploaded)' : 'Static PayNow QR (upload one in Settings)'}
                </option>
                <option value="PAYNOW_UEN">PayNow via UEN Text</option>
                <option value="BANK_TRANSFER">Bank Wire Transfer</option>
              </Select>
            </div>
            )}
          </div>

          {/* Quick adds (yellow) + service price dropdowns (normal) */}
          {!lockAmounts && (
            <div className="space-y-4">
              {showPhotoboothQuick && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      <span>Popular Quick Adds</span>
                    </div>
                    <span className="text-[11px] text-amber-700">Tap to add a line</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-amber-900 mr-0.5">Photobooth:</span>
                    {PHOTOBOOTH_PACKAGES.filter((p) =>
                      ['pb-2h-a', 'pb-3h-a', 'pb-4h-a', 'pb-addon-extra-hour'].includes(p.id)
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-neutral-800 border border-amber-300 hover:bg-amber-100 hover:border-amber-400 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Plus className="h-3 w-3 text-amber-600" />
                        {preset.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">Services &amp; Prices</Label>
                  {projectTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllServices((v) => !v)}
                      className="text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                    >
                      {restrictToTags ? 'Show all services' : "Only this project's services"}
                    </button>
                  )}
                </div>

                {projectTags.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    {restrictToTags ? (
                      <>Showing prices for this project&apos;s services: <strong className="text-neutral-700">{projectTags.map(tagLabel).join(', ')}</strong></>
                    ) : (
                      'Showing prices for every service.'
                    )}
                  </p>
                )}

                {visibleServices.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    This project is tagged Other, which has no preset prices. Add line items by hand, or show all services.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleServices.map((service) => (
                      <select
                        key={service.id}
                        aria-label={`${service.name} packages`}
                        value=""
                        onChange={(e) => {
                          const item = findServiceItem(e.target.value);
                          if (item) applyPreset(item);
                        }}
                        className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-neutral-950 cursor-pointer"
                      >
                        <option value="">
                          {service.name} ({service.hint})…
                        </option>
                        {service.groups.map((group) => (
                          <optgroup key={group.label} label={`── ${group.label} ──`}>
                            {group.items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Line Items Builder */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-sm font-semibold">{isQuote ? 'Quotation Line Items' : 'Invoice Line Items'}</Label>
                <p className="text-[11px] text-neutral-500">Add or edit items below</p>
              </div>
              {!lockAmounts && (
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Blank Item
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="bg-neutral-50 p-2.5 rounded-md border border-neutral-200 space-y-1.5">
                  {/* Description gets its own full-width row on a phone - squeezed alongside Qty and
                      Price's fixed widths, there's barely room left to see what's being typed. */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Service description (e.g. Commercial Shoot)"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        required
                        disabled={lockAmounts}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-20 shrink-0 space-y-1">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          required
                          disabled={lockAmounts}
                          className="h-8 text-xs bg-white text-center"
                        />
                      </div>
                      <div className="w-28 sm:w-32 shrink-0 space-y-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price (SGD)"
                          aria-label="Line price in SGD"
                          value={item.amount || ''}
                          onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                          required
                          disabled={lockAmounts}
                          className="h-8 text-xs bg-white text-right"
                        />
                      </div>
                      {items.length > 1 && !lockAmounts && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(idx)}
                          className="h-8 w-8 p-0 shrink-0 text-neutral-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {!lockAmounts && (
                    <div className="flex items-center justify-between px-0.5">
                      <select
                        aria-label="Swap this item with a service"
                        value=""
                        onChange={(e) => {
                          const item = findServiceItem(e.target.value);
                          if (item) applyPreset(item, idx);
                        }}
                        className="text-[11px] text-neutral-500 hover:text-neutral-800 bg-transparent border-0 p-0 cursor-pointer focus:ring-0 max-w-full"
                      >
                        <option value="">⚡ Swap this item with a service…</option>
                        {visibleServices.map((service) =>
                          service.groups.map((group) => (
                            <optgroup key={`${service.id}-${group.label}`} label={`${service.name} — ${group.label}`}>
                              {group.items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </optgroup>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Discounts: applied one after another, before GST */}
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-2">
              <div>
                <Label className="text-sm font-semibold">Discounts</Label>
                <p className="text-[11px] text-neutral-500">Applied one after another, top to bottom, before GST</p>
              </div>
              {!lockAmounts && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDiscount}
                  disabled={discounts.length >= MAX_DISCOUNTS}
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Discount
                </Button>
              )}
            </div>

            {discounts.length === 0 ? (
              <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2.5 text-xs text-neutral-500">
                No discounts on this {noun}.{!lockAmounts && ' Add one to give the client a reduction.'}
              </p>
            ) : (
              <div className="space-y-2">
                {discounts.map((d, idx) => {
                  const stage = rowStages[idx];
                  return (
                    <div key={idx} className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-neutral-50">
                          {idx + 1}
                        </span>
                        <Input
                          placeholder="Name (optional, e.g. Early bird)"
                          aria-label={`Discount ${idx + 1} name`}
                          value={d.name}
                          maxLength={60}
                          onChange={(e) => updateDiscount(idx, { name: e.target.value })}
                          disabled={lockAmounts}
                          className="h-8 min-w-[9rem] flex-1 text-xs bg-white"
                        />
                        <div
                          className="inline-flex shrink-0 overflow-hidden rounded-md border border-neutral-300"
                          role="group"
                          aria-label={`Discount ${idx + 1} type`}
                        >
                          {(['PERCENT', 'FLAT'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              aria-pressed={d.type === type}
                              disabled={lockAmounts}
                              onClick={() => updateDiscount(idx, { type })}
                              className={cn(
                                'h-8 w-9 text-xs font-bold transition-colors disabled:opacity-50',
                                d.type === type
                                  ? 'bg-neutral-900 text-neutral-50'
                                  : 'bg-white text-neutral-700 hover:bg-neutral-100'
                              )}
                            >
                              {type === 'PERCENT' ? '%' : '$'}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={d.type === 'PERCENT' ? 100 : undefined}
                          step="0.01"
                          placeholder={d.type === 'PERCENT' ? '10' : '50.00'}
                          aria-label={`Discount ${idx + 1} ${d.type === 'PERCENT' ? 'percentage' : 'amount in dollars'}`}
                          value={d.value}
                          onChange={(e) => updateDiscount(idx, { value: e.target.value })}
                          disabled={lockAmounts}
                          className="h-8 w-24 text-right text-xs bg-white"
                        />
                        {!lockAmounts && (
                          <div className="flex shrink-0 items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveDiscount(idx, -1)}
                              disabled={idx === 0}
                              aria-label="Move discount up"
                              className="h-8 w-7 p-0 text-neutral-500"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveDiscount(idx, 1)}
                              disabled={idx === discounts.length - 1}
                              aria-label="Move discount down"
                              className="h-8 w-7 p-0 text-neutral-500"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDiscount(idx)}
                              aria-label="Remove discount"
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="pl-8 text-[11px] text-neutral-500">
                        {stage
                          ? `Takes off SGD $${stage.amount.toFixed(2)}: price goes from $${stage.priceBefore.toFixed(2)} to $${stage.priceAfter.toFixed(2)}`
                          : 'Enter a value to apply this discount.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GST toggle and the price at every stage */}
          <div className="bg-neutral-100 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={isGstApplied}
                  onChange={(e) => setIsGstApplied(e.target.checked)}
                  disabled={lockAmounts}
                  className="rounded text-neutral-900"
                />
                Apply Singapore Goods & Services Tax ({gstRate}% GST)
              </label>
              <span className="text-xs text-neutral-500">Sole Proprietor Registered</span>
            </div>

            <div className="flex justify-between text-xs text-neutral-600">
              <span>{preview.discounts.length > 0 ? 'Price before discounts:' : 'Subtotal:'}</span>
              <span>SGD ${preview.subtotal.toFixed(2)}</span>
            </div>

            {preview.discounts.map((d, i) => (
              <div key={i} className="text-xs space-y-0.5">
                <div className="flex justify-between gap-3 text-neutral-600">
                  <span className="min-w-0 truncate">
                    {i + 1}. {describeDiscount(d)}
                  </span>
                  <span className="shrink-0 text-emerald-700">-SGD ${d.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-4 text-neutral-500">
                  <span>Price after discount:</span>
                  <span>SGD ${d.priceAfter.toFixed(2)}</span>
                </div>
              </div>
            ))}

            {preview.discounts.length > 0 && (
              <div className="flex justify-between border-t border-neutral-200 pt-1 text-xs font-medium text-neutral-800">
                <span>Price after all discounts:</span>
                <span>SGD ${preview.taxableAmount.toFixed(2)}</span>
              </div>
            )}

            {isGstApplied && (
              <div className="flex justify-between text-xs text-neutral-600">
                <span>
                  GST ({gstRate}%{preview.discounts.length > 0 ? ` on $${preview.taxableAmount.toFixed(2)}` : ''}):
                </span>
                <span>SGD ${preview.gstAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-200">
              <span>Grand Total:</span>
              <span>SGD ${preview.totalAmount.toFixed(2)}</span>
            </div>
            {isEdit && paid > 0 && (
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Already paid:</span>
                <span>SGD ${paid.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="inv-notes">
              {isQuote ? 'Notes / Terms (Optional)' : 'Notes / Payment Terms for Client (Optional)'}
            </Label>
            <Textarea
              id="inv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 50% deposit required on booking. Balance upon delivery."
              className="h-20"
            />
          </div>

          {!isQuote && (
            <div className="space-y-2">
              <Label htmlFor="inv-internal-notes">Internal Notes for Admins (Optional)</Label>
              <Textarea
                id="inv-internal-notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="e.g. Converted from quotation QUO-2026-8K3F91."
                className="h-16"
              />
              <p className="text-[11px] text-neutral-500">Never shown to the client or printed on the invoice PDF.</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleDismiss(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || projects.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save Changes' : isQuote ? 'Create Quotation' : 'Generate Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
