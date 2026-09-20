'use client';

import { useEffect, useState, useCallback } from 'react';
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
import {
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

  // Dialog & Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState('PAYNOW_QR');
  const [isGstApplied, setIsGstApplied] = useState(true);
  const [gstRate] = useState(9);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItemInput[]>([
    { description: 'Photography / Videography Services', quantity: 1, unitPrice: 0 },
  ]);

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

  // Load available projects for invoice creation
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
    } finally {
      setLoadingProjects(false);
    }
  };

  const openCreateDialog = () => {
    loadProjects();
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

  // Line item handlers
  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItemInput, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'quantity') {
        updated[index].quantity = Math.max(1, parseInt(value.toString() || '1', 10));
      } else if (field === 'unitPrice') {
        updated[index].unitPrice = Math.max(0, parseFloat(value.toString() || '0'));
      } else {
        updated[index].description = value.toString();
      }
      return updated;
    });
  };

  // Quick apply photobooth preset
  const applyPreset = (preset: PhotoboothPackage, replaceIndex?: number) => {
    if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < items.length) {
      setItems((prev) => {
        const updated = [...prev];
        updated[replaceIndex] = {
          description: preset.description,
          quantity: 1,
          unitPrice: preset.price,
        };
        return updated;
      });
      toast({ title: 'Preset Applied', description: `${preset.name} set ($${preset.price.toFixed(2)}).` });
      return;
    }

    // Smart insertion: if only 1 default empty item exists, replace it
    if (
      items.length === 1 &&
      (!items[0].description || items[0].description === 'Photography / Videography Services') &&
      items[0].unitPrice === 0
    ) {
      setItems([{ description: preset.description, quantity: 1, unitPrice: preset.price }]);
    } else {
      setItems((prev) => [...prev, { description: preset.description, quantity: 1, unitPrice: preset.price }]);
    }
    toast({ title: 'Preset Added', description: `${preset.name} added ($${preset.price.toFixed(2)}).` });
  };

  // Calculations for preview
  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );
  const calculatedGst = isGstApplied ? Math.round(calculatedSubtotal * (gstRate / 100) * 100) / 100 : 0;
  const calculatedTotal = Math.round((calculatedSubtotal + calculatedGst) * 100) / 100;

  // Handle invoice submit
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: 'Validation Error', description: 'Please select a project', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          dueDate,
          paymentMethod,
          isGstApplied,
          gstRate,
          notes,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to create invoice', variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: `Invoice ${data.invoice.invoiceNumber} created!` });
      setDialogOpen(false);
      // Reset form
      setNotes('');
      setItems([{ description: 'Photography / Videography Services', quantity: 1, unitPrice: 0 }]);
      fetchInvoices(search, statusFilter);
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setCreating(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Invoices & Financials</h1>
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
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" title="Download PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Invoice"
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

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Draft an invoice with Singapore EMVCo PayNow SGQR code and 9% GST.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4 py-2">
            {/* Project Selector */}
            <div className="space-y-2">
              <Label htmlFor="projectId">Project / Client *</Label>
              {loadingProjects ? (
                <div className="flex items-center text-sm text-neutral-500 py-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-amber-600">
                  No projects available. Please create a project first before generating an invoice.
                </p>
              ) : (
                <Select
                  id="projectId"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                >
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
                <Label htmlFor="dueDate">Payment Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Primary Payment Method</Label>
                <Select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="PAYNOW_QR">Dynamic PayNow SGQR (Recommended)</option>
                  <option value="PAYNOW_UEN">PayNow via UEN Text</option>
                  <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                </Select>
              </div>
            </div>

            {/* Photobooth Quick Presets Panel */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>Photobooth Quick Presets</span>
                </div>
                <span className="text-[11px] text-amber-700">
                  Select to autofill package description & rate
                </span>
              </div>

              {/* Quick 1-Tap Popular Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-amber-900 mr-0.5">Popular:</span>
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

              {/* All Packages Dropdown */}
              <select
                aria-label="Select Photobooth Package"
                value=""
                onChange={(e) => {
                  const preset = getPresetById(e.target.value);
                  if (preset) applyPreset(preset);
                }}
                className="flex h-8 w-full rounded-md border border-amber-300 bg-white px-2.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">⚡ Browse all Photobooth packages & add-ons ({PHOTOBOOTH_PACKAGES.length} presets)...</option>
                {PHOTOBOOTH_CATEGORIES.map((cat) => (
                  <optgroup key={cat} label={`── ${cat} ──`}>
                    {PHOTOBOOTH_PACKAGES.filter((p) => p.category === cat).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — SGD ${p.price.toFixed(2)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Line Items Builder */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-sm font-semibold">Invoice Line Items</Label>
                  <p className="text-[11px] text-neutral-500">Add or edit items below</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Blank Item
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-neutral-50 p-2.5 rounded-md border border-neutral-200 space-y-1.5">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Service description (e.g. Commercial Shoot)"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          required
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          required
                          className="h-8 text-xs bg-white text-center"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                          required
                          className="h-8 text-xs bg-white text-right"
                        />
                      </div>
                      <div className="w-24 text-right self-center text-xs font-semibold text-neutral-700">
                        ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(idx)}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Per-row preset swap */}
                    <div className="flex items-center justify-between px-0.5">
                      <select
                        aria-label="Preset for this line item"
                        value=""
                        onChange={(e) => {
                          const preset = getPresetById(e.target.value);
                          if (preset) applyPreset(preset, idx);
                        }}
                        className="text-[11px] text-neutral-500 hover:text-neutral-800 bg-transparent border-0 p-0 cursor-pointer focus:ring-0"
                      >
                        <option value="">⚡ Swap this item with Photobooth preset...</option>
                        {PHOTOBOOTH_PACKAGES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (${p.price.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GST Toggle & Totals Preview */}
            <div className="bg-neutral-100 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={isGstApplied}
                    onChange={(e) => setIsGstApplied(e.target.checked)}
                    className="rounded text-neutral-900"
                  />
                  Apply Singapore Goods & Services Tax (9% GST)
                </label>
                <span className="text-xs text-neutral-500">Sole Proprietor Registered</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-600">
                <span>Subtotal:</span>
                <span>SGD ${calculatedSubtotal.toFixed(2)}</span>
              </div>

              {isGstApplied && (
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>GST (9%):</span>
                  <span>SGD ${calculatedGst.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-200">
                <span>Grand Total:</span>
                <span>SGD ${calculatedTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Payment Terms (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 50% deposit required on booking. Balance upon delivery."
                className="h-20"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || projects.length === 0}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
