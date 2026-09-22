'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { RequirePermission } from '@/components/require-permission';
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
  FileSignature,
  Copy,
  Check,
  Download,
  ExternalLink,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { CONTRACT_TEMPLATES, renderContractTemplate } from '@/lib/contract-templates';
import { SortSelect, useSavedChoice } from '@/components/sort-filter';
import { byDate, byNumber, byText, sortItems, type SortChoice } from '@/lib/sorting';

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  project: {
    title: string;
    client: {
      companyName: string;
      contactName: string;
    };
  };
  contract: { id: string } | null;
}

interface ContractListItem {
  id: string;
  title: string;
  signingToken: string;
  isSigned: boolean;
  signedAt: string | null;
  createdAt: string;
  tokenExpiresAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
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
  };
  signatureAudit?: {
    signerName: string;
    signerEmail: string | null;
    signedUtcTimestamp: string;
    documentSha256: string;
  } | null;
}

const SORT_CHOICES: SortChoice<ContractListItem>[] = [
  { value: 'newest', label: 'Date Created: Newest to Oldest', compare: byDate((c) => c.createdAt, 'desc') },
  { value: 'oldest', label: 'Date Created: Oldest to Newest', compare: byDate((c) => c.createdAt, 'asc') },
  { value: 'signed-recent', label: 'Date Signed: Most Recent First', compare: byDate((c) => c.signedAt, 'desc') },
  { value: 'client-az', label: 'Client Name: A to Z', compare: byText((c) => c.invoice.project.client.companyName) },
  { value: 'amount-high', label: 'Invoice Amount: Highest to Lowest', compare: byNumber((c) => c.invoice.totalAmount, 'desc') },
  { value: 'expiring', label: 'Signing Link Expiry: Soonest First', compare: byDate((c) => c.tokenExpiresAt, 'asc') },
];

export default function ContractsPage() {
  return (
    <RequirePermission permission="contracts">
      <ContractsPageInner />
    </RequirePermission>
  );
}

function ContractsPageInner() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SIGNED' | 'PENDING'>('ALL');
  const [sort, setSort] = useSavedChoice('contracts-sort', 'newest', SORT_CHOICES.map((c) => c.value));

  // Create Contract Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  // Studio name/UEN from Settings, used when rendering contract templates
  const studioRef = useRef<Record<string, string>>({});

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('STANDARD_PHOTOGRAPHY');
  const [contractTitle, setContractTitle] = useState('');
  const [contractBody, setContractBody] = useState('');

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchContracts = useCallback(async (query: string, filter: string) => {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (filter === 'SIGNED') params.append('signed', 'true');
      if (filter === 'PENDING') params.append('signed', 'false');

      const res = await fetch(`/api/contracts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch contracts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContracts(search, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchContracts]);

  // Load invoices without existing contracts
  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      try {
        const sres = await fetch('/api/settings');
        if (sres.ok) {
          const sdata = await sres.json();
          studioRef.current = {
            company_uen: sdata.settings.uen,
            studio_name: String(sdata.settings.companyName).toUpperCase(),
          };
        }
      } catch {
      }
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        const availableInvoices = (data.invoices || []).filter((i: InvoiceOption) => !i.contract);
        setInvoices(availableInvoices);
        if (availableInvoices.length > 0) {
          const first = availableInvoices[0];
          setSelectedInvoiceId(first.id);
          applyTemplate(selectedTemplateId, first);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const applyTemplate = (templateId: string, invoice: any) => {
    const tmpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId) || CONTRACT_TEMPLATES[0];
    setContractTitle(tmpl.defaultTitle);

    if (invoice) {
      const deposit = (invoice.totalAmount * 0.5).toFixed(2);
      const balance = (invoice.totalAmount - parseFloat(deposit)).toFixed(2);
      // A sent invoice's contract uses the details that invoice was issued with
      const snap = invoice.paymentSnapshot;
      const studio =
        snap && typeof snap.uen === 'string' && typeof snap.companyName === 'string'
          ? { company_uen: snap.uen, studio_name: String(snap.companyName).toUpperCase() }
          : studioRef.current;
      const rendered = renderContractTemplate(tmpl.body, {
        ...studio,
        company_name: invoice.project.client.companyName,
        client_name: invoice.project.client.contactName || invoice.project.client.companyName,
        project_title: invoice.project.title,
        shoot_date: invoice.project.shootDate
          ? new Date(invoice.project.shootDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'To be scheduled',
        due_date: new Date(invoice.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }),
        total_amount: invoice.totalAmount.toFixed(2),
        deposit_amount: deposit,
        balance_due: balance,
      });
      setContractBody(rendered);
    } else {
      setContractBody(tmpl.body);
    }
  };

  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const targetInvoice = invoices.find((i) => i.id === selectedInvoiceId);
    applyTemplate(tmplId, targetInvoice);
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const targetInvoice = invoices.find((i) => i.id === invId);
    applyTemplate(selectedTemplateId, targetInvoice);
  };

  const openCreateDialog = () => {
    loadInvoices();
    setDialogOpen(true);
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      toast({ title: 'Selection Error', description: 'Please select an invoice', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          title: contractTitle,
          contractBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to create contract', variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: 'Contract generated with secure client signing link!' });
      setDialogOpen(false);
      fetchContracts(search, statusFilter);
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copySigningLink = (signingToken: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/sign?token=${signingToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(signingToken);
    setTimeout(() => setCopiedToken(null), 2500);
    toast({ title: 'Link Copied', description: 'Client signing link copied to clipboard!' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Client Contracts & E-Signatures</h1><RefreshButton onRefresh={() => fetchContracts(search, statusFilter)} /></div>
          <p className="text-neutral-500">
            Generate legally binding agreements with zero-cost client signing links and SHA-256 audit trails
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Create Contract
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search agreement, client, invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <SortSelect value={sort} onChange={setSort} options={SORT_CHOICES} />
        <div className="flex gap-2 w-full overflow-x-auto pb-1">
          <Button
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('ALL')}
            className="text-xs"
          >
            All Contracts
          </Button>
          <Button
            variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('PENDING')}
            className="text-xs"
          >
            Pending Signature
          </Button>
          <Button
            variant={statusFilter === 'SIGNED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('SIGNED')}
            className="text-xs"
          >
            Signed & Sealed
          </Button>
        </div>
      </div>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <FileSignature className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">No contracts drafted yet</h3>
              <p className="mt-1 text-sm text-neutral-500">
                Create a contract agreement linked to an invoice for client electronic signature.
              </p>
              <Button onClick={openCreateDialog} className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Create Contract
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">Agreement Title</th>
                    <th className="py-3 px-4">Client & Project</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Signing Link</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortItems(contracts, SORT_CHOICES, sort).map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link href={`/admin/contracts/${c.id}`} className="font-semibold text-neutral-900 hover:underline">
                          {c.title}
                        </Link>
                        <p className="text-xs text-neutral-400">Created {new Date(c.createdAt).toLocaleDateString('en-SG')}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-neutral-900">{c.invoice.project.client.companyName}</p>
                        <p className="text-xs text-neutral-500">{c.invoice.project.title}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-neutral-800">
                        <Link href={`/admin/invoices/${c.invoice.id}`} className="hover:underline text-blue-600">
                          {c.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        {c.isSigned ? (
                          <Badge variant="success">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Signed
                          </Badge>
                        ) : (
                          <Badge variant="warning">Pending Sign</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copySigningLink(c.signingToken)}
                          className="h-8 text-xs font-mono text-neutral-600 hover:text-neutral-900 flex items-center gap-1.5"
                        >
                          {copiedToken === c.signingToken ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedToken === c.signingToken ? 'Copied!' : 'Copy Link'}
                        </Button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Link href={`/admin/contracts/${c.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              Details
                            </Button>
                          </Link>
                          <a href={`/api/contracts/${c.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" title="Download Contract PDF">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
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

      {/* Create Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client Agreement</DialogTitle>
            <DialogDescription>
              Select an invoice and standard template to generate a secure client signing link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateContract} className="space-y-4 py-2">
            {/* Invoice Selector */}
            <div className="space-y-2">
              <Label htmlFor="invoiceId">Associated Invoice *</Label>
              {loadingInvoices ? (
                <div className="flex items-center text-sm text-neutral-500 py-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading available invoices...
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-amber-600">
                  All current invoices already have contracts attached. Create a new invoice first.
                </p>
              ) : (
                <Select
                  id="invoiceId"
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  required
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.project.client.companyName} (SGD ${inv.totalAmount.toFixed(2)})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <Label htmlFor="templateId">Contract Template</Label>
              <Select
                id="templateId"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                {CONTRACT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </Select>
            </div>

            {/* Contract Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Agreement Title *</Label>
              <Input
                id="title"
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                required
              />
            </div>

            {/* Contract Body Editor */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="contractBody">Agreement Terms & Conditions *</Label>
                <span className="text-[11px] text-neutral-400">Tokens like {`{{client_name}}`} automatically resolved</span>
              </div>
              <Textarea
                id="contractBody"
                value={contractBody}
                onChange={(e) => setContractBody(e.target.value)}
                rows={12}
                required
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || invoices.length === 0}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Contract & Signing Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
