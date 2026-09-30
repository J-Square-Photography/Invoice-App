'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { InvoiceFormDialog, type EditableInvoice } from '@/components/invoice-form-dialog';
import { QuoteStatusBadge } from '@/components/quote-status-badge';
import { ServiceTagBadges } from '@/components/service-tag-picker';
import { ArrowLeft, Download, Pencil, Trash2, Loader2, Mail, MessageCircle, ArrowRightCircle, FileText, Lock } from 'lucide-react';
import { describeDiscount } from '@/lib/invoice-calculations';
import { quoteMessage, quoteSubject, whatsappUrl, mailtoUrl } from '@/lib/share-invoice';

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  discounts?: Array<{ name: string; type: string; value: number; amount: number; priceBefore: number; priceAfter: number }> | null;
  isGstApplied: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  depositAmount?: number;
  notes: string | null;
  project: {
    id: string;
    title: string;
    serviceTags?: string[];
    client: { id: string; companyName: string; contactName: string; email: string | null; phone: string | null; address: string | null };
  };
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number; amount: number }>;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('J Square Photography');
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error();
      setQuote((await res.json()).quote);
    } catch {
      toast({ title: 'Error', description: 'Failed to load quotation.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.settings?.companyName && setCompanyName(d.settings.companyName))
      .catch(() => {});
  }, [load]);

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setQuote(data.quote);
      toast({ title: 'Updated', description: `Marked ${status.toLowerCase()}.` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update status', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to convert quotation');
      toast({ title: 'Converted', description: `Draft invoice ${data.invoice.invoiceNumber} created.` });
      router.push(`/admin/invoices/${data.invoice.id}`);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to convert quotation', variant: 'destructive' });
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!quote) return;
    if (!confirm(`Delete quotation ${quote.quoteNumber}? ${quote.invoice ? `The invoice ${quote.invoice.invoiceNumber} made from it is not affected.` : 'This cannot be undone.'}`)) return;
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Deleted', description: `Quotation ${quote.quoteNumber} deleted.` });
      router.push('/admin/quotes');
    } else {
      toast({ title: 'Error', description: 'Failed to delete quotation.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="py-24 text-center">
        <p className="text-neutral-500">Quotation not found.</p>
        <Link href="/admin/quotes">
          <Button variant="outline" className="mt-4">Back to quotations</Button>
        </Link>
      </div>
    );
  }

  const locked = !!quote.invoice;
  const client = quote.project.client;
  const share = {
    companyName,
    clientName: client.companyName,
    contactName: client.contactName,
    quoteNumber: quote.quoteNumber,
    projectTitle: quote.project.title,
    totalAmount: quote.totalAmount,
    validUntil: quote.validUntil,
  };
  const editable: EditableInvoice = {
    id: quote.id,
    invoiceNumber: quote.quoteNumber,
    status: quote.status,
    dueDate: quote.validUntil,
    paymentMethod: null,
    isGstApplied: quote.isGstApplied,
    gstRate: quote.gstRate,
    notes: quote.notes,
    depositAmount: quote.depositAmount ? Number(quote.depositAmount) : 0,
    paidAmount: 0,
    project: { id: quote.project.id },
    items: quote.items,
    contract: null,
    discounts: quote.discounts,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/quotes">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Back to quotations">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono whitespace-nowrap">{quote.quoteNumber}</h1>
              <QuoteStatusBadge status={quote.status} validUntil={quote.validUntil} />
            </div>
            <p className="text-sm text-neutral-500">
              Issued {fmt(quote.issueDate)} · Valid until {fmt(quote.validUntil)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!locked && (
            <Select value={quote.status} onChange={(e) => setStatus(e.target.value)} disabled={busy} className="w-36 h-9 text-xs">
              <option value="DRAFT">Mark: Draft</option>
              <option value="SENT">Mark: Sent</option>
              <option value="ACCEPTED">Mark: Accepted</option>
              <option value="DECLINED">Mark: Declined</option>
            </Select>
          )}
          {locked ? (
            <Link href={`/admin/invoices/${quote.invoice!.id}`}>
              <Button className="h-9 text-xs">
                <FileText className="mr-1.5 h-4 w-4" /> View Invoice {quote.invoice!.invoiceNumber}
              </Button>
            </Link>
          ) : (
            quote.status !== 'DECLINED' && (
              <Button className="h-9 text-xs" onClick={convert} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowRightCircle className="mr-1.5 h-4 w-4" />}
                Convert to Invoice
              </Button>
            )
          )}
          <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="h-9 text-xs">
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </a>
          <a href={mailtoUrl(client.email, quoteSubject(share), quoteMessage(share))} title="Open an email with the message ready to send. Attach the downloaded PDF.">
            <Button variant="outline" className="h-9 text-xs">
              <Mail className="mr-1.5 h-4 w-4" /> Email
            </Button>
          </a>
          <a href={whatsappUrl(client.phone, quoteMessage(share))} target="_blank" rel="noopener noreferrer" title="Open WhatsApp with the message ready to send. Attach the downloaded PDF.">
            <Button variant="outline" className="h-9 text-xs">
              <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
            </Button>
          </a>
          {!locked && (
            <Button variant="outline" className="h-9 text-xs" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="outline" className="h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={remove}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {locked && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This quotation was accepted and converted to invoice <strong>{quote.invoice!.invoiceNumber}</strong>. It is now a record of what was quoted. Make any changes on the invoice.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quoted Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {quote.items.map((i) => (
                      <tr key={i.id}>
                        <td className="py-3 px-4">{i.description}</td>
                        <td className="py-3 px-4 text-center text-neutral-600">{i.quantity}</td>
                        <td className="py-3 px-4 text-right font-medium">{i.amount > 0 ? `SGD $${i.amount.toFixed(2)}` : 'Included'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1.5 border-t border-neutral-200 p-4 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>SGD ${quote.subtotal.toFixed(2)}</span>
                </div>
                {(quote.discounts ?? []).map((d, i) => (
                  <div key={i} className="flex justify-between text-emerald-700">
                    <span>{describeDiscount(d)}</span>
                    <span>-SGD ${d.amount.toFixed(2)}</span>
                  </div>
                ))}
                {quote.isGstApplied && (
                  <div className="flex justify-between text-neutral-600">
                    <span>GST ({quote.gstRate}%)</span>
                    <span>SGD ${quote.gstAmount.toFixed(2)}</span>
                  </div>
                )}
                {Number(quote.depositAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Deposit Given</span>
                    <span>-SGD ${Number(quote.depositAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
                  <span>Quoted Total</span>
                  <span>SGD ${quote.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client &amp; Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-neutral-900">{client.companyName}</p>
                {client.contactName && <p className="text-neutral-600">{client.contactName}</p>}
                {client.email && <p className="text-xs text-neutral-500">{client.email}</p>}
                {client.phone && <p className="text-xs text-neutral-500">{client.phone}</p>}
                {client.address && <p className="text-xs text-neutral-500">{client.address}</p>}
              </div>
              <div className="border-t border-neutral-100 pt-3">
                <Link href={`/admin/projects?view=${quote.project.id}`} className="font-medium text-blue-600 hover:underline">
                  {quote.project.title}
                </Link>
                <div className="mt-1">
                  <ServiceTagBadges tags={quote.project.serviceTags} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceFormDialog kind="quote" open={editOpen} onOpenChange={setEditOpen} invoice={editable} onSaved={load} />
    </div>
  );
}
