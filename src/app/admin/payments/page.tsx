'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshButton } from '@/components/refresh-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Search, Loader2, ShieldCheck, Paperclip, FileSpreadsheet, Wallet, AlertTriangle, Copy } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { currentSingaporeMonth } from '@/lib/time';
import { SortSelect, useSavedChoice } from '@/components/sort-filter';
import { byDate, byNumber, byText, sortItems, type SortChoice } from '@/lib/sorting';

interface PaymentRow {
  id: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string | null;
  transactionRef: string | null;
  notes: string | null;
  recordedBy: string | null;
  proofBytes: number | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  invoice: { id: string; invoiceNumber: string; status: string; project: { title: string; client: { companyName: string } } };
}

interface Reversal {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amountPaid: number;
  paymentDate: string;
  transactionRef: string | null;
  reversedBy: string;
  reversedAt: string;
}

interface Storage {
  databaseBytes: number;
  limitBytes: number;
  usedRatio: number;
  proofBytes: number;
  proofCount: number;
  level: 'ok' | 'warn' | 'full';
}

const money = (n: number) => `SGD $${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
const fmt = (d: string) => new Date(d).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
const currentMonth = () => currentSingaporeMonth();

const SORT_CHOICES: SortChoice<PaymentRow>[] = [
  { value: 'newest', label: 'Payment Date: Newest to Oldest', compare: byDate((p) => p.paymentDate, 'desc') },
  { value: 'oldest', label: 'Payment Date: Oldest to Newest', compare: byDate((p) => p.paymentDate, 'asc') },
  { value: 'amount-high', label: 'Amount: Highest to Lowest', compare: byNumber((p) => p.amountPaid, 'desc') },
  { value: 'amount-low', label: 'Amount: Lowest to Highest', compare: byNumber((p) => p.amountPaid, 'asc') },
  { value: 'client-az', label: 'Client Name: A to Z', compare: byText((p) => p.invoice.project.client.companyName) },
  { value: 'client-za', label: 'Client Name: Z to A', compare: byText((p) => p.invoice.project.client.companyName, 'desc') },
];

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'unverified', label: 'Awaiting check' },
  { key: 'verified', label: 'Verified' },
  { key: 'noproof', label: 'No screenshot' },
] as const;

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rawPayments, setPayments] = useState<PaymentRow[]>([]);
  const [sort, setSort] = useSavedChoice('payments-sort', 'newest', SORT_CHOICES.map((c) => c.value));
  const payments = sortItems(rawPayments, SORT_CHOICES, sort);
  const [totals, setTotals] = useState<Record<string, { count: number; total: number }>>({});
  const [reversals, setReversals] = useState<Reversal[]>([]);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [canVerify, setCanVerify] = useState(false);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<(typeof FILTERS)[number]['key']>('');
  const [search, setSearch] = useState('');
  const [proofOpen, setProofOpen] = useState<PaymentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The dashboard's "awaiting check" banner opens this page already filtered
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('status') === 'unverified') {
      setStatus('unverified');
      setMonth('');
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (status) params.set('status', status);
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPayments(data.payments);
      setTotals(data.totalsByMethod);
      setReversals(data.reversals ?? []);
      setStorage(data.storage);
      setUnverifiedCount(data.unverifiedCount);
      setCanVerify(!!data.canVerify);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [month, status, search, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const verify = async (p: PaymentRow, verified: boolean) => {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/payments/${p.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast({ title: verified ? 'Verified' : 'Verification cleared', description: `${p.invoice.invoiceNumber} · ${money(p.amountPaid)}` });
      load();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const grandTotal = Object.values(totals).reduce((s, t) => s + t.total, 0);

  const exportCsv = () =>
    downloadCsv(`payments-${month || 'all'}.csv`, [
      ['Date', 'Client', 'Invoice', 'Amount', 'Method', 'Reference', 'Recorded by', 'Verified', 'Verified by', 'Screenshot'],
      ...payments.map((p) => [
        p.paymentDate.slice(0, 10),
        p.invoice.project.client.companyName,
        p.invoice.invoiceNumber,
        p.amountPaid.toFixed(2),
        PAYMENT_METHOD_LABELS[p.paymentMethod || ''] || p.paymentMethod || '',
        p.transactionRef,
        p.recordedBy,
        p.verifiedAt ? 'Yes' : 'No',
        p.verifiedBy,
        p.proofBytes ? 'Yes' : 'No',
      ]),
    ]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: text });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            <RefreshButton onRefresh={load} />
          </div>
          <p className="text-neutral-500">Proof and verification for every payment received, so nothing has to be dug out of bank history</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={payments.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {unverifiedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{unverifiedCount}</strong> payment{unverifiedCount === 1 ? ' is' : 's are'} still awaiting a check against the bank.{' '}
            {canVerify ? 'Open your bank app, confirm each one, then tap Verify.' : 'A Developer will verify them.'}
          </p>
        </div>
      )}

      {/* Month totals: the one number per method to compare with the bank statement */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{month ? `Received in ${new Date(`${month}-01`).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}` : 'Received (all time)'}</CardTitle>
              <CardDescription>Compare these totals with your bank statement for the same period</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-44" aria-label="Month" />
              {month && (
                <Button variant="ghost" size="sm" onClick={() => setMonth('')}>
                  All time
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(totals).length === 0 ? (
            <p className="text-sm text-neutral-500">No payments in this period.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(totals).map(([method, t]) => (
                <div key={method} className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">{PAYMENT_METHOD_LABELS[method] || method}</p>
                  <p className="text-lg font-bold">{money(t.total)}</p>
                  <p className="text-xs text-neutral-500">{t.count} payment{t.count === 1 ? '' : 's'}</p>
                </div>
              ))}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">Total received</p>
                <p className="text-lg font-bold text-emerald-700">{money(grandTotal)}</p>
                <p className="text-xs text-emerald-800">{payments.length} payment{payments.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input placeholder="Search reference, invoice #, client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SortSelect value={sort} onChange={setSort} options={SORT_CHOICES} />
        <div className="flex gap-2 w-full overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <Button key={f.key} variant={status === f.key ? 'default' : 'outline'} size="sm" onClick={() => setStatus(f.key)} className="text-xs whitespace-nowrap">
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Wallet className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">No payments found</h3>
              <p className="mt-1 text-sm text-neutral-500">Payments you record on an invoice appear here with their proof.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client &amp; Invoice</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Proof</th>
                    <th className="py-3 px-4">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-700">{fmt(p.paymentDate)}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-900">{p.invoice.project.client.companyName}</p>
                        <Link href={`/admin/invoices/${p.invoice.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                          {p.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {PAYMENT_METHOD_LABELS[p.paymentMethod || ''] || p.paymentMethod || 'PayNow'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-600">
                        {p.transactionRef ? (
                          <button type="button" onClick={() => copy(p.transactionRef!)} className="inline-flex items-center gap-1 hover:text-neutral-900" title="Copy">
                            {p.transactionRef} <Copy className="h-3 w-3 text-neutral-400" />
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">+{money(p.amountPaid)}</td>
                      <td className="py-3 px-4">
                        {p.proofBytes ? (
                          <button type="button" onClick={() => setProofOpen(p)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Paperclip className="h-3.5 w-3.5" /> View
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.verifiedAt ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" /> Verified
                            </span>
                            <p className="text-[11px] text-neutral-500">
                              {p.verifiedBy} · {fmt(p.verifiedAt)}
                            </p>
                            {canVerify && (
                              <button type="button" className="text-[11px] text-neutral-400 underline hover:text-neutral-700" onClick={() => verify(p, false)} disabled={busyId === p.id}>
                                Undo
                              </button>
                            )}
                          </div>
                        ) : canVerify ? (
                          <Button size="sm" className="h-7 text-xs" onClick={() => verify(p, true)} disabled={busyId === p.id}>
                            {busyId === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
                            Verify
                          </Button>
                        ) : (
                          <span className="text-xs text-amber-600">Awaiting check</span>
                        )}
                        {!p.verifiedAt && <p className="text-[11px] text-neutral-500">Recorded by {p.recordedBy}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {reversals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reverted payments</CardTitle>
            <CardDescription>Payments that were cleared when a paid invoice was reverted, kept here so nothing disappears</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-2.5 px-4">Reverted</th>
                    <th className="py-2.5 px-4">Client &amp; Invoice</th>
                    <th className="py-2.5 px-4">Paid on</th>
                    <th className="py-2.5 px-4">Reference</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reversals.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-neutral-600">{fmt(r.reversedAt)}</td>
                      <td className="py-2.5 px-4">
                        {r.clientName} <span className="font-mono text-xs text-neutral-500">{r.invoiceNumber}</span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-neutral-600">{fmt(r.paymentDate)}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-neutral-600">{r.transactionRef || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{money(r.amountPaid)}</td>
                      <td className="py-2.5 px-4 text-xs text-neutral-500">{r.reversedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {storage && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Free storage used</span>
              <span className={storage.level === 'ok' ? 'text-neutral-600' : storage.level === 'warn' ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'}>
                {mb(storage.databaseBytes)} of {mb(storage.limitBytes)} ({(storage.usedRatio * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full ${storage.level === 'ok' ? 'bg-emerald-500' : storage.level === 'warn' ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0.5, storage.usedRatio * 100))}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500">
              Payment screenshots use {mb(storage.proofBytes)} across {storage.proofCount} image{storage.proofCount === 1 ? '' : 's'}.{' '}
              {storage.level === 'ok'
                ? 'Plenty of room on the free plan.'
                : storage.level === 'warn'
                  ? 'Getting full: ask to archive old proofs before it reaches 90%.'
                  : 'Nearly full: new screenshots are paused (payments can still be recorded with a bank reference).'}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!proofOpen} onOpenChange={(o) => !o && setProofOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment screenshot</DialogTitle>
            <DialogDescription>
              {proofOpen ? `${proofOpen.invoice.project.client.companyName} · ${proofOpen.invoice.invoiceNumber} · ${money(proofOpen.amountPaid)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {proofOpen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/payments/${proofOpen.id}/proof`} alt="Payment proof" className="w-full rounded border border-neutral-200 bg-white" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
