'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
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
import { InvoiceFormDialog, type EditableInvoice } from '@/components/invoice-form-dialog';
import {
  Pencil,
  Search,
  Plus,
  Loader2,
  FileText,
  DollarSign,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import {
  PHOTOBOOTH_PACKAGES,
  PHOTOBOOTH_CATEGORIES,
  PhotoboothPackage,
  getPresetById,
} from '@/lib/photobooth-presets';

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ProjectOption {
  id: string;
  title: string;
  client: {
    companyName: string;
    contactName: string;
  };
}

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  isGstApplied: boolean;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  paymentMethod: string | null;
  project: {
    id: string;
    title: string;
    client: {
      id: string;
      companyName: string;
      contactName: string;
      email: string;
    };
  };
  paymentLogs: Array<{ id: string }>;
  contract: { id: string; isSigned: boolean } | null;
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create / edit invoice pop-up
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<EditableInvoice | null>(null);

  // Fetch invoices with debounce
  const fetchInvoices = useCallback(async (query: string, status: string) => {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (status && status !== 'ALL') params.append('status', status);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices(search, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchInvoices]);

  const openCreateDialog = () => {
    setEditingInvoice(null);
    setDialogOpen(true);
  };

  const openEditDialog = (inv: InvoiceListItem) => {
    setEditingInvoice(inv as unknown as EditableInvoice);
    setDialogOpen(true);
  };

  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This will remove the invoice record.`)) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Success', description: `Invoice ${invoiceNumber} deleted.` });
        fetchInvoices(search, statusFilter);
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete invoice.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error deleting invoice.', variant: 'destructive' });
    }
  };


  // Metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.status !== 'VOID' ? inv.totalAmount : 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.status !== 'VOID' ? inv.paidAmount : 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.status !== 'VOID' ? inv.balanceDue : 0), 0);
  const overdueCount = invoices.filter(
    (inv) => inv.status !== 'PAID' && inv.status !== 'VOID' && new Date(inv.dueDate) < new Date()
  ).length;

  const getStatusBadge = (status: string, dueDateStr: string) => {
    const isOverdue = status !== 'PAID' && status !== 'VOID' && new Date(dueDateStr) < new Date();
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    switch (status) {
      case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
      case 'SENT': return <Badge variant="outline">Sent</Badge>;
      case 'PARTIAL': return <Badge variant="warning">Partial</Badge>;
      case 'PAID': return <Badge variant="success">Paid</Badge>;
      case 'VOID': return <Badge variant="secondary">Void</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Invoices & Financials</h1><RefreshButton onRefresh={() => fetchInvoices(search, statusFilter)} /></div>
          <p className="text-neutral-500">Track invoices, milestone partial payments, and PayNow SGQR codes</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Invoiced</CardTitle>
            <DollarSign className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">SGD ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-neutral-500">{invoices.filter(i => i.status !== 'VOID').length} active invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">SGD ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-neutral-500">Pending client clearance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Collected Revenue</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">SGD ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-neutral-500">Payments recorded to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Overdue Invoices</CardTitle>
            <AlertCircle className={`h-4 w-4 ${overdueCount > 0 ? 'text-red-500' : 'text-neutral-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{overdueCount}</div>
            <p className="text-xs text-neutral-500">Passed payment due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search invoice #, client, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {['ALL', 'DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs whitespace-nowrap"
            >
              {s === 'ALL' ? 'All Invoices' : INVOICE_STATUS_LABELS[s] || s}
            </Button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 px-4">
              <FileText className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">No invoices found</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {search || statusFilter !== 'ALL' ? 'Try adjusting your search or status filter.' : 'Get started by creating your first client invoice.'}
              </p>
              {!search && statusFilter === 'ALL' && (
                <Button onClick={openCreateDialog} className="mt-4" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Create Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client & Project</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                        <Link href={`/admin/invoices/${inv.id}`} className="hover:underline text-blue-600">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-neutral-900">{inv.project.client.companyName}</p>
                        <p className="text-xs text-neutral-500">{inv.project.title}</p>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">
                        {new Date(inv.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-neutral-900">
                        SGD ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={inv.balanceDue > 0 ? 'font-semibold text-amber-600' : 'text-emerald-600 font-medium'}>
                          SGD ${inv.balanceDue.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(inv.status, inv.dueDate)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Link href={`/admin/invoices/${inv.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2"
                            title={inv.status === 'PAID' ? 'Paid invoices are locked. Open the invoice to revert the payment.' : 'Edit Invoice'}
                            disabled={inv.status === 'PAID'}
                            onClick={() => openEditDialog(inv)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" title="Download PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title={inv.status === 'PAID' ? 'Paid invoices are locked. Open the invoice to revert the payment.' : 'Delete Invoice'}
                            disabled={inv.status === 'PAID'}
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                          >
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

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={editingInvoice}
        onSaved={() => fetchInvoices(search, statusFilter)}
      />
    </div>
  );
}
