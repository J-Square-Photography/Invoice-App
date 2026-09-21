'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { InvoiceFormDialog } from '@/components/invoice-form-dialog';
import { ServiceTagBadges } from '@/components/service-tag-picker';
import {
  Pencil,
  Undo2,
  Lock,
  ArrowLeft,
  Download,
  DollarSign,
  QrCode,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle,
  Clock,
  FileSignature,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { describeDiscount } from '@/lib/invoice-calculations';

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountAmount?: number;
  discounts?: Array<{ name: string; type: string; value: number; amount: number; priceBefore: number; priceAfter: number }> | null;
  isGstApplied: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  project: {
    id: string;
    title: string;
    projectType: string;
    serviceTags?: string[];
    client: {
      id: string;
      companyName: string;
      contactName: string;
      email: string;
      phone: string | null;
      uen: string | null;
    };
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  paymentLogs: Array<{
    id: string;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string | null;
    transactionRef: string | null;
    notes: string | null;
    recordedBy: string | null;
  }>;
  contract: {
    id: string;
    title: string;
    isSigned: boolean;
    signedAt: string | null;
  } | null;
}

interface PaymentConfig {
  companyName: string;
  uen: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankAccountName: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [sgqr, setSgqr] = useState<{
    payload: string;
    dataUrl: string;
    mode?: 'dynamic' | 'static' | 'static-missing';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsFrozen, setDetailsFrozen] = useState(false);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit invoice pop-up
  const [editOpen, setEditOpen] = useState(false);

  // Revert-payment confirmation
  const [revertOpen, setRevertOpen] = useState(false);
  const [reverting, setReverting] = useState(false);

  // Payment Recording Dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethodSelect, setPaymentMethodSelect] = useState('PAYNOW_QR');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Copy state
  const [copiedUen, setCopiedUen] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data.invoice);
        setPaymentConfig(data.paymentConfig);
        setDetailsFrozen(!!data.paymentDetailsFrozen);
        setSgqr(data.sgqr);
        setPaymentAmount(data.invoice.balanceDue > 0 ? data.invoice.balanceDue.toString() : '');
      } else {
        toast({ title: 'Error', description: 'Invoice not found', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load invoice', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id, fetchInvoice]);

  // Update Status directly
  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast({ title: 'Status Updated', description: `Invoice marked as ${INVOICE_STATUS_LABELS[newStatus] || newStatus}` });
        fetchInvoice();
      } else {
        const data = await res.json();
        toast({ title: 'Update Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Submit Partial Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaid: amount,
          paymentDate,
          paymentMethod: paymentMethodSelect,
          transactionRef: paymentRef,
          notes: paymentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Payment Error', description: data.error || 'Failed to record payment', variant: 'destructive' });
        return;
      }

      toast({ title: 'Payment Recorded', description: data.message });
      setPaymentDialogOpen(false);
      setPaymentRef('');
      setPaymentNotes('');
      fetchInvoice();
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setRecordingPayment(false);
    }
  };

  const copyToClipboard = (text: string, type: 'uen' | 'bank') => {
    navigator.clipboard.writeText(text);
    if (type === 'uen') {
      setCopiedUen(true);
      setTimeout(() => setCopiedUen(false), 2000);
    } else {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  // Revert a paid invoice: clears the ledger and reopens it
  const handleRevert = async () => {
    setReverting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Revert Failed', description: data.error || 'Could not revert invoice.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Invoice Reverted', description: data.message });
      setRevertOpen(false);
      fetchInvoice();
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setReverting(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice?.invoiceNumber}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Invoice deleted successfully.' });
        router.push('/admin/invoices');
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete invoice.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error deleting invoice.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Invoice could not be loaded.</p>
        <Link href="/admin/invoices">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const isOverdue = invoice.status !== 'PAID' && invoice.status !== 'VOID' && new Date(invoice.dueDate) < new Date();
  const isPaid = invoice.status === 'PAID';
  const discountList = Array.isArray(invoice.discounts) ? invoice.discounts : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/invoices">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-neutral-900">{invoice.invoiceNumber}</h1>
              {isOverdue ? (
                <Badge variant="destructive">Overdue</Badge>
              ) : invoice.status === 'PAID' ? (
                <Badge variant="success">Paid</Badge>
              ) : invoice.status === 'PARTIAL' ? (
                <Badge variant="warning">Partial Payment</Badge>
              ) : (
                <Badge variant="secondary">{invoice.status}</Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Created on {new Date(invoice.issueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <Select
            value={invoice.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            disabled={updatingStatus || isPaid}
            className="w-36 h-9 text-xs"
          >
            {/* Once payments exist, status follows them: only Void can be chosen by hand */}
            {(invoice.paidAmount <= 0 || invoice.status === 'VOID') && <option value="DRAFT">Mark: Draft</option>}
            {(invoice.paidAmount <= 0 || invoice.status === 'VOID') && <option value="SENT">Mark: Sent</option>}
            {invoice.status === 'PARTIAL' && <option value="PARTIAL">Partial (from payments)</option>}
            {isPaid && <option value="PAID">Paid (locked)</option>}
            <option value="VOID">Mark: Void</option>
          </Select>

          {/* Record Payment Button */}
          {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
            <Button onClick={() => setPaymentDialogOpen(true)} className="h-9 text-xs">
              <DollarSign className="mr-1.5 h-4 w-4" /> Record Payment
            </Button>
          )}

          {/* Download PDF */}
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="h-9 text-xs">
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </a>

          {isPaid ? (
            /* Paid invoices are locked: reverting is the only way to change them */
            <Button variant="outline" className="h-9 text-xs" onClick={() => setRevertOpen(true)}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Revert Payment
            </Button>
          ) : (
            <>
              {/* Edit Invoice */}
              <Button variant="outline" className="h-9 text-xs" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>

              {/* Delete Invoice */}
              <Button
                variant="outline"
                className="h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={handleDeleteInvoice}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {isPaid && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This invoice is paid and locked. To change it, use <strong>Revert Payment</strong>. That clears the
            payment ledger and reopens the invoice.
          </p>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Invoice Details, Items, Ledger */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project & Client Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Client & Assignment Details</span>
                <Link href={`/admin/projects/${invoice.project.id}`} className="text-xs text-blue-600 hover:underline">
                  View Project →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase">Bill To</p>
                <p className="font-semibold text-neutral-900 mt-1">{invoice.project.client.companyName}</p>
                <p className="text-neutral-600">{invoice.project.client.contactName}</p>
                <p className="text-neutral-500 text-xs">{invoice.project.client.email}</p>
                {invoice.project.client.uen && (
                  <p className="text-neutral-500 text-xs font-mono mt-0.5">UEN: {invoice.project.client.uen}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase">Assignment Info</p>
                <p className="font-semibold text-neutral-900 mt-1">{invoice.project.title}</p>
                <p className="text-neutral-600 text-xs">Due: {new Date(invoice.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <div className="mt-2"><ServiceTagBadges tags={invoice.project.serviceTags} legacyType={invoice.project.projectType} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Line Items & Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center w-16">Qty</th>
                    <th className="py-2.5 px-4 text-right w-28">Unit Price</th>
                    <th className="py-2.5 px-4 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4 text-neutral-900">{item.description}</td>
                      <td className="py-3 px-4 text-center text-neutral-600">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-neutral-600">SGD ${item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-900">SGD ${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="border-t border-neutral-200 p-4 bg-neutral-50 space-y-2 text-sm">
                <div className="flex justify-between text-neutral-600 text-xs">
                  <span>{discountList.length > 0 ? 'Price before discounts:' : 'Subtotal:'}</span>
                  <span>SGD ${invoice.subtotal.toFixed(2)}</span>
                </div>

                {discountList.map((d, i) => (
                  <div key={i} className="text-xs space-y-0.5">
                    <div className="flex justify-between gap-3 text-neutral-600">
                      <span className="min-w-0 truncate">
                        {i + 1}. {describeDiscount(d)}
                      </span>
                      <span className="shrink-0 text-emerald-700">-SGD ${Number(d.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pl-4 text-neutral-500">
                      <span>Price after discount:</span>
                      <span>SGD ${Number(d.priceAfter).toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {discountList.length > 0 && (
                  <div className="flex justify-between border-t border-neutral-200 pt-1 text-xs font-medium text-neutral-800">
                    <span>Price after all discounts:</span>
                    <span>SGD ${(invoice.subtotal - Number(invoice.discountAmount ?? 0)).toFixed(2)}</span>
                  </div>
                )}

                {invoice.isGstApplied && (
                  <div className="flex justify-between text-neutral-600 text-xs">
                    <span>Singapore GST ({invoice.gstRate}%):</span>
                    <span>SGD ${invoice.gstAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-200">
                  <span>Grand Total:</span>
                  <span>SGD ${invoice.totalAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-xs text-emerald-600 font-medium">
                  <span>Paid to Date:</span>
                  <span>SGD ${invoice.paidAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-base font-bold pt-1 border-t border-neutral-200">
                  <span className={invoice.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}>Balance Due:</span>
                  <span className={invoice.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                    SGD ${invoice.balanceDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History Ledger */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment History Ledger</CardTitle>
                <CardDescription>Installments & milestone deposit records</CardDescription>
              </div>
              {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
                <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)} className="h-7 text-xs">
                  <DollarSign className="mr-1 h-3 w-3" /> Add Installment
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {invoice.paymentLogs.length === 0 ? (
                <p className="text-center py-6 text-sm text-neutral-500">
                  No payments recorded yet. Record milestone deposits or bank receipts here.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Reference</th>
                      <th className="py-2.5 px-4">Recorded By</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {invoice.paymentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50">
                        <td className="py-2.5 px-4 text-neutral-700">
                          {new Date(log.paymentDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {PAYMENT_METHOD_LABELS[log.paymentMethod || ''] || log.paymentMethod || 'PayNow'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-neutral-600 font-mono text-xs">
                          {log.transactionRef || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-500 text-xs">
                          {log.recordedBy || 'System'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-emerald-600">
                          +SGD ${log.amountPaid.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          {invoice.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-neutral-400">Invoice Terms & Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Live PayNow SGQR Code & Bank Transfer */}
        <div className="space-y-6">
          {/* Dynamic Singapore PayNow SGQR Code Card */}
          <Card className="border-2 border-red-900/20 shadow-md">
            <CardHeader className="pb-2 bg-gradient-to-b from-red-50 to-white rounded-t-xl text-center">
              <div className="mx-auto w-8 h-8 rounded-full bg-red-950 flex items-center justify-center text-white mb-1">
                <QrCode className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-red-950">
                {sgqr?.mode === 'static' || sgqr?.mode === 'static-missing' ? 'Singapore PayNow QR' : 'Singapore PayNow SGQR'}
              </CardTitle>
              <CardDescription className="text-xs text-neutral-600">
                {sgqr?.mode === 'static' || sgqr?.mode === 'static-missing'
                  ? 'Static QR uploaded in Settings. The payer enters the amount.'
                  : 'EMVCo Dynamic QR standard for DBS, OCBC, UOB, GrabPay'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-3 space-y-4">
              {sgqr?.mode === 'static-missing' ? (
                <div className="py-6 px-2 text-xs text-amber-700">
                  This invoice uses a static PayNow QR, but none has been uploaded yet. Add one under
                  Administration → Settings.
                </div>
              ) : sgqr?.dataUrl ? (
                <div className="flex flex-col items-center">
                  {/* Fixed white (not themed): QR codes must stay scannable in dark mode */}
                  <div className="p-3 bg-[#ffffff] rounded-xl border border-neutral-300 shadow-sm inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sgqr.dataUrl}
                      alt="Singapore PayNow SGQR Code"
                      className="w-52 h-52 mx-auto"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-semibold text-neutral-900">
                      {sgqr.mode === 'static' ? 'Scan, then enter SGD' : 'Scan SGD'} ${invoice.balanceDue > 0 ? invoice.balanceDue.toFixed(2) : invoice.totalAmount.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-mono">Ref: {invoice.invoiceNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-neutral-400 text-xs">
                  Generating PayNow SGQR Code...
                </div>
              )}

              {/* UEN copy box */}
              {paymentConfig && (
                <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-left space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-500">PayNow UEN:</span>
                    <button
                      onClick={() => copyToClipboard(paymentConfig.uen, 'uen')}
                      className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                    >
                      {copiedUen ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span className="font-mono font-bold text-neutral-900">{paymentConfig.uen}</span>
                    </button>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Entity:</span>
                    <span className="font-medium text-neutral-900">{paymentConfig.companyName}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bank Transfer Details Card */}
          {paymentConfig && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-neutral-500" /> Standard Bank Transfer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Bank Name:</span>
                  <span className="font-medium text-neutral-900">{paymentConfig.bankName}</span>
                </div>
                {paymentConfig.bankBranchCode && (
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Branch Code:</span>
                  <span className="font-mono text-neutral-900">{paymentConfig.bankBranchCode}</span>
                </div>
                )}
                <div className="flex justify-between py-1 border-b border-neutral-100 items-center">
                  <span className="text-neutral-500">Account No:</span>
                  <button
                    onClick={() => copyToClipboard(paymentConfig.bankAccountNumber, 'bank')}
                    className="flex items-center gap-1 font-mono font-bold text-neutral-900 hover:underline"
                  >
                    {copiedBank ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {paymentConfig.bankAccountNumber}
                  </button>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Account Name:</span>
                  <span className="font-medium text-neutral-900">{paymentConfig.bankAccountName}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {paymentConfig && (
            <p className="px-1 text-center text-[11px] text-neutral-500">
              {detailsFrozen
                ? 'Payment details are locked as issued on this invoice.'
                : 'Draft: payment details follow Settings until this invoice is marked Sent.'}
            </p>
          )}

          {/* E-Signature Contract Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-neutral-500" /> Contract & E-Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {invoice.contract ? (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <p className="min-w-0 flex-1 basis-40 font-semibold leading-snug text-emerald-900">{invoice.contract.title || 'Client Agreement'}</p>
                      <Badge variant={invoice.contract.isSigned ? 'success' : 'warning'} className="shrink-0 whitespace-nowrap">
                        {invoice.contract.isSigned ? 'Signed & Sealed' : 'Pending Signature'}
                      </Badge>
                    </div>
                    {invoice.contract.isSigned && invoice.contract.signedAt && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Signed on {new Date(invoice.contract.signedAt).toLocaleDateString('en-SG')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/contracts/${invoice.contract.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Contract
                      </Button>
                    </Link>
                    <a href={`/api/contracts/${invoice.contract.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs px-2" title="Download Contract PDF">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-neutral-500">
                    No contract attached yet. Generate an agreement with zero-cost client signing link.
                  </p>
                  <Link href="/admin/contracts">
                    <Button size="sm" className="w-full text-xs">
                      <FileSignature className="mr-1.5 h-3.5 w-3.5" /> Create Agreement
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revert Payment Confirmation */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revert {invoice.invoiceNumber}?</DialogTitle>
            <DialogDescription>
              This clears {invoice.paymentLogs.length} payment record{invoice.paymentLogs.length === 1 ? '' : 's'} (SGD ${invoice.paidAmount.toFixed(2)}) from the ledger and reopens the invoice
              with SGD ${invoice.totalAmount.toFixed(2)} outstanding. You will be able to edit it again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRevertOpen(false)} disabled={reverting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevert} disabled={reverting}>
              {reverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revert Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <InvoiceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        invoice={invoice}
        onSaved={fetchInvoice}
      />

      {/* Record Payment Installment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment Installment</DialogTitle>
            <DialogDescription>
              Log client payment for {invoice.invoiceNumber}. Balances and statuses update automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount Paid (SGD) *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                max={invoice.balanceDue}
                onChange={(e) => {
                  // Never let the amount exceed what is still owed
                  const v = e.target.value;
                  const n = parseFloat(v);
                  setPaymentAmount(!isNaN(n) && n > invoice.balanceDue ? invoice.balanceDue.toFixed(2) : v);
                }}
                placeholder="e.g. 750.00"
                required
              />
              <p className="text-xs text-neutral-500">
                Current balance due: <strong>SGD ${invoice.balanceDue.toFixed(2)}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethodSelect">Method</Label>
                <Select
                  id="paymentMethodSelect"
                  value={paymentMethodSelect}
                  onChange={(e) => setPaymentMethodSelect(e.target.value)}
                >
                  <option value="PAYNOW_QR">PayNow QR</option>
                  <option value="PAYNOW_UEN">PayNow UEN</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentRef">Reference / Transaction ID (Optional)</Label>
              <Input
                id="paymentRef"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. DBS-TXN-984210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (Optional)</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g. 50% booking deposit received"
                className="h-16"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={recordingPayment}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordingPayment}>
                {recordingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
