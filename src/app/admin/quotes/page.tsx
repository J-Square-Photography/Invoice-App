'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { InvoiceFormDialog, type EditableInvoice } from '@/components/invoice-form-dialog';
import { QuoteStatusBadge } from '@/components/quote-status-badge';
import { Search, Plus, Loader2, ClipboardList, Download, Pencil, Trash2, FileText, Clock, CheckCircle2, ArrowRightCircle } from 'lucide-react';
import { QUOTE_STATUS_LABELS, displayQuoteStatus } from '@/lib/quote-status';
import { downloadCsv } from '@/lib/csv';
import { SortSelect, PeriodSelect, useSavedChoice } from '@/components/sort-filter';
import { byDate, byNumber, byText, inPeriod, sortItems, PERIODS, type SortChoice } from '@/lib/sorting';

interface QuoteListItem {
  id: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: number;
  isGstApplied: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  notes: string | null;
  discounts?: unknown;
  project: { id: string; title: string; client: { id: string; companyName: string } };
  items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
}

const SORT_CHOICES: SortChoice<QuoteListItem>[] = [
  { value: 'newest', label: 'Issue Date: Newest to Oldest', compare: byDate((q) => q.issueDate, 'desc') },
  { value: 'oldest', label: 'Issue Date: Oldest to Newest', compare: byDate((q) => q.issueDate, 'asc') },
  { value: 'expiring', label: 'Valid Until: Soonest to Latest', compare: byDate((q) => q.validUntil, 'asc') },
  { value: 'valid-late', label: 'Valid Until: Latest to Soonest', compare: byDate((q) => q.validUntil, 'desc') },
  { value: 'amount-high', label: 'Amount: Highest to Lowest', compare: byNumber((q) => q.totalAmount, 'desc') },
  { value: 'amount-low', label: 'Amount: Lowest to Highest', compare: byNumber((q) => q.totalAmount, 'asc') },
  { value: 'client-az', label: 'Client Name: A to Z', compare: byText((q) => q.project.client.companyName) },
  { value: 'client-za', label: 'Client Name: Z to A', compare: byText((q) => q.project.client.companyName, 'desc') },
];

const FILTERS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'] as const;
const money = (n: number) => `SGD $${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [sort, setSort] = useSavedChoice('quotes-sort', 'newest', SORT_CHOICES.map((c) => c.value));
  const [period, setPeriod] = useSavedChoice('quotes-period', 'ALL', PERIODS.map((p) => p.value));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableInvoice | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const fetchQuotes = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/quotes${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      if (res.ok) setQuotes((await res.json()).quotes || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch quotations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => fetchQuotes(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchQuotes]);

  const shown = (q: QuoteListItem) => displayQuoteStatus(q.status, q.validUntil);
  const visible = sortItems(
    quotes.filter((q) => (filter === 'ALL' || shown(q) === filter) && inPeriod(q.issueDate, period)),
    SORT_CHOICES,
    sort
  );

  // Waiting for an answer: sent and still valid
  const open = quotes.filter((q) => shown(q) === 'SENT');
  const openValue = open.reduce((s, q) => s + q.totalAmount, 0);
  const acceptedValue = quotes.filter((q) => q.status === 'ACCEPTED').reduce((s, q) => s + q.totalAmount, 0);
  const expiredCount = quotes.filter((q) => shown(q) === 'EXPIRED').length;

  const openEdit = (q: QuoteListItem) => {
    // The shared form takes an invoice-shaped record: quote number and valid-until stand in for invoice number and due date
    setEditing({
      id: q.id,
      invoiceNumber: q.quoteNumber,
      status: q.status,
      dueDate: q.validUntil,
      paymentMethod: null,
      isGstApplied: q.isGstApplied,
      gstRate: q.gstRate,
      notes: q.notes,
      paidAmount: 0,
      project: { id: q.project.id },
      items: q.items,
      contract: null,
      discounts: q.discounts,
    });
    setDialogOpen(true);
  };

  const convert = async (q: QuoteListItem) => {
    setConverting(q.id);
    try {
      const res = await fetch(`/api/quotes/${q.id}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to convert quotation');
      toast({ title: 'Converted', description: `${q.quoteNumber} is now draft invoice ${data.invoice.invoiceNumber}.` });
      router.push(`/admin/invoices/${data.invoice.id}`);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to convert quotation', variant: 'destructive' });
      setConverting(null);
    }
  };

  const remove = async (q: QuoteListItem) => {
    if (!confirm(`Delete quotation ${q.quoteNumber}? ${q.invoice ? `The invoice ${q.invoice.invoiceNumber} made from it is not affected.` : 'This cannot be undone.'}`)) return;
    const res = await fetch(`/api/quotes/${q.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Deleted', description: `Quotation ${q.quoteNumber} deleted.` });
      fetchQuotes(search);
    } else {
      toast({ title: 'Error', description: 'Failed to delete quotation.', variant: 'destructive' });
    }
  };

  const exportCsv = () =>
    downloadCsv(`quotations-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Quotation #', 'Status', 'Client', 'Project', 'Issued', 'Valid until', 'Total', 'Invoice'],
      ...visible.map((q) => [
        q.quoteNumber,
        shown(q),
        q.project.client.companyName,
        q.project.title,
        q.issueDate.slice(0, 10),
        q.validUntil.slice(0, 10),
        q.totalAmount.toFixed(2),
        q.invoice?.invoiceNumber ?? '',
      ]),
    ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
            <RefreshButton onRefresh={() => fetchQuotes(search)} />
          </div>
          <p className="text-neutral-500">Price a job before it is confirmed, then convert it to an invoice in one click</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New Quotation
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Awaiting Reply</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-amber-600">{money(openValue)}</div>
            <p className="text-xs text-neutral-500">{open.length} sent quotation{open.length === 1 ? '' : 's'} still valid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Accepted</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600">{money(acceptedValue)}</div>
            <p className="text-xs text-neutral-500">Turned into bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Expired</CardTitle>
            <ClipboardList className={`h-4 w-4 ${expiredCount > 0 ? 'text-red-500' : 'text-neutral-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-lg sm:text-2xl font-bold ${expiredCount > 0 ? 'text-red-600' : ''}`}>{expiredCount}</div>
            <p className="text-xs text-neutral-500">Sent, no answer by the valid-until date</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input placeholder="Search quotation #, client, project..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SortSelect value={sort} onChange={setSort} options={SORT_CHOICES} />
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
        <div className="flex gap-2 w-full overflow-x-auto pb-1">
          {FILTERS.map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)} className="text-xs whitespace-nowrap">
              {s === 'ALL' ? 'All Quotations' : QUOTE_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 px-4">
              <ClipboardList className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">No quotations found</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {search || filter !== 'ALL' ? 'Try adjusting your search or filter.' : 'Create your first quotation for a new enquiry.'}
              </p>
              {!search && filter === 'ALL' && (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                  className="mt-4"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" /> New Quotation
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">Quotation #</th>
                    <th className="py-3 px-4">Client &amp; Project</th>
                    <th className="py-3 px-4">Valid Until</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visible.map((q) => (
                    <tr key={q.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium whitespace-nowrap">
                        <Link href={`/admin/quotes/${q.id}`} className="hover:underline text-blue-600">
                          {q.quoteNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-neutral-900">{q.project.client.companyName}</p>
                        <p className="text-xs text-neutral-500">{q.project.title}</p>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">
                        {new Date(q.validUntil).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-medium">SGD ${q.totalAmount.toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <QuoteStatusBadge status={q.status} validUntil={q.validUntil} />
                        {q.invoice && (
                          <Link href={`/admin/invoices/${q.invoice.id}`} className="mt-1 block text-[11px] text-blue-600 hover:underline">
                            {q.invoice.invoiceNumber}
                          </Link>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {q.invoice ? (
                            <Link href={`/admin/invoices/${q.invoice.id}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs">
                                <FileText className="mr-1 h-3.5 w-3.5" /> View Invoice
                              </Button>
                            </Link>
                          ) : (
                            q.status !== 'DECLINED' && (
                              <Button size="sm" className="h-8 text-xs" onClick={() => convert(q)} disabled={converting === q.id}>
                                {converting === q.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />}
                                Convert to Invoice
                              </Button>
                            )
                          )}
                          <Link href={`/admin/quotes/${q.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title={q.invoice ? 'Converted quotations are locked. Edit the invoice instead.' : 'Edit quotation'}
                            disabled={!!q.invoice}
                            onClick={() => openEdit(q)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 px-2" title="Download PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete quotation" onClick={() => remove(q)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceFormDialog kind="quote" open={dialogOpen} onOpenChange={setDialogOpen} invoice={editing} onSaved={() => fetchQuotes(search)} />
    </div>
  );
}
