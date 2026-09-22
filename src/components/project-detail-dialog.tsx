'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { cn, formatDate } from '@/lib/utils';
import { Loader2, Pencil, Trash2, CheckCircle2, FileText, Plus, ClipboardList } from 'lucide-react';
import { QuoteStatusBadge } from '@/components/quote-status-badge';
import { ServiceTagPicker, ServiceTagBadges } from '@/components/service-tag-picker';
import { DeleteImpactWarning } from '@/components/delete-impact';
import type { DeleteImpact } from '@/lib/delete-impact';

type Project = {
  id: string;
  title: string;
  clientId: string;
  projectType: string;
  serviceTags?: string[];
  pipelineStatus: string;
  shootDate: string | null;
  notes: string | null;
  createdAt: string;
  client: { id: string; companyName: string; contactName: string };
  invoices: any[];
  quotes?: any[];
};


const PIPELINE_STEPS = [
  { key: 'INQUIRY', label: 'Inquiry' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'BOOKED', label: 'Booked' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CLOSED', label: 'Closed' },
];

const toDateInput = (d: string | null) => (d ? new Date(d).toISOString().split('T')[0] : '');

export function ProjectDetailDialog({
  projectId,
  onClose,
  onChanged,
}: {
  projectId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<{ title: string; serviceTags: string[]; shootDate: string; notes: string }>({ title: '', serviceTags: [], shootDate: '', notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProject = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      setProject(data.project);
      setImpact(data.impact ?? null);
    } catch {
      toast({ title: 'Error', description: 'Failed to load project details', variant: 'destructive' });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMode('view');
    setProject(null);
    if (projectId) fetchProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startEdit = () => {
    if (!project) return;
    setForm({
      title: project.title,
      serviceTags: project.serviceTags ?? [],
      shootDate: toDateInput(project.shootDate),
      notes: project.notes || '',
    });
    setMode('edit');
  };

  const updateStatus = async (newStatus: string) => {
    if (!project || !projectId || project.pipelineStatus === newStatus) return;
    const previous = project;
    setProject({ ...project, pipelineStatus: newStatus });
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: newStatus }),
      });
      if (!res.ok) throw new Error();
      onChanged();
      toast({
        title: 'Status Updated',
        description: `Project moved to ${PIPELINE_STEPS.find((s) => s.key === newStatus)?.label}`,
      });
    } catch {
      setProject(previous);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (form.serviceTags.length === 0) {
      toast({ title: 'Choose a service', description: 'Tag the project with at least one service (or Other).', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          serviceTags: form.serviceTags,
          shootDate: form.shootDate ? new Date(form.shootDate).toISOString() : null,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update details');
      const data = await res.json();
      setProject((prev) => (prev ? { ...prev, ...data.project } : data.project));
      setMode('view');
      onChanged();
      toast({ title: 'Success', description: 'Project details updated' });
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : 'Failed to update details', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!projectId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ title: 'Deleted', description: 'Project deleted successfully' });
      setDeleteOpen(false);
      onClose();
      onChanged();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentIndex = project ? PIPELINE_STEPS.findIndex((s) => s.key === project.pipelineStatus) : -1;

  return (
    <>
      <Dialog open={!!projectId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          {loading || !project ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mode === 'edit' ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>Update the details for {project.title}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={saveProject} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="pd-title">Project Title *</Label>
                  <Input
                    id="pd-title"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                                <div className="space-y-2">
                  <Label>Services *</Label>
                  <ServiceTagPicker value={form.serviceTags} onChange={(tags) => setForm({ ...form, serviceTags: tags })} />
                  <p className="text-xs text-neutral-500">Invoices for this project offer only the prices of these services.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pd-date">Shoot Date</Label>
                  <Input
                    id="pd-date"
                    type="date"
                    value={form.shootDate}
                    onChange={(e) => setForm({ ...form, shootDate: e.target.value })}
                  />
                </div><div className="space-y-2">
                  <Label htmlFor="pd-notes">Notes</Label>
                  <Textarea
                    id="pd-notes"
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{project.title}</DialogTitle>
                <DialogDescription>
                  Created {formatDate(project.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label>Pipeline Status</Label>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {PIPELINE_STEPS.map((step, index) => {
                      const isActive = index <= currentIndex;
                      const isCurrent = step.key === project.pipelineStatus;
                      return (
                        <button
                          key={step.key}
                          type="button"
                          onClick={() => updateStatus(step.key)}
                          className={cn(
                            'flex-1 py-2 px-1 text-xs font-medium rounded-md transition-all text-center flex flex-col items-center gap-1',
                            isCurrent
                              ? 'bg-neutral-900 text-white shadow-md'
                              : isActive
                              ? 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
                              : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                          )}
                        >
                          {isActive && <CheckCircle2 className={cn('h-3 w-3', isCurrent ? 'text-white' : 'text-neutral-600')} />}
                          <span>{step.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Client</Label>
                    <div>
                      <Link
                        href={`/admin/clients?view=${project.clientId}`}
                        onClick={onClose}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {project.client?.companyName}
                      </Link>
                    </div>
                  </div>
                                    <div className="space-y-1 sm:col-span-2">
                    <Label>Services</Label>
                    <ServiceTagBadges tags={project.serviceTags} legacyType={project.projectType} />
                  </div><div className="space-y-1">
                    <Label>Shoot Date</Label>
                    <div className="font-medium">
                      {project.shootDate ? formatDate(project.shootDate) : 'Not scheduled'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Notes</Label>
                  <div className="whitespace-pre-wrap text-sm">
                    {project.notes || <span className="text-muted-foreground italic">No notes.</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-neutral-500" /> Quotations
                    </Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setQuoteOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" /> New Quotation
                    </Button>
                  </div>
                  {project.quotes && project.quotes.length > 0 ? (
                    <div className="grid gap-2">
                      {project.quotes.map((q: any) => (
                        <Link
                          key={q.id}
                          href={`/admin/quotes/${q.id}`}
                          className="rounded-lg border p-3 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold font-mono">{q.quoteNumber}</span>
                            <span className="text-xs font-semibold">SGD ${Number(q.totalAmount ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="mt-1">
                            <QuoteStatusBadge status={q.status} validUntil={q.validUntil} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500">No quotations yet.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-neutral-500" /> Invoices
                    </Label>
                    {project.invoices && project.invoices.length > 0 && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> New Invoice
                      </Button>
                    )}
                  </div>
                  {project.invoices && project.invoices.length > 0 ? (
                    <div className="grid gap-2">
                      {project.invoices.map((inv: any) => (
                        <Link
                          key={inv.id}
                          href={`/admin/invoices/${inv.id}`}
                          className="rounded-lg border p-3 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold font-mono">
                              {inv.invoiceNumber || `Invoice #${inv.id.slice(0, 8)}`}
                            </span>
                            <span className="text-xs font-semibold">
                              SGD ${Number(inv.totalAmount ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-neutral-500">{inv.status}</span>
                            {inv.status === 'PAID' ? (
                              <span className="text-xs text-emerald-600 font-medium">Paid</span>
                            ) : inv.status === 'VOID' ? (
                              <span className="text-xs text-neutral-500 font-medium">Void</span>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">
                                Due: ${Number(inv.balanceDue).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-5 text-sm text-neutral-500 bg-neutral-50 rounded-md border border-dashed">
                      <span>No invoices generated yet.</span>
                      <Button type="button" size="sm" onClick={() => setInvoiceOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Create Invoice
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button type="button" onClick={startEdit}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This cannot be undone. <strong>{project?.title}</strong> will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DeleteImpactWarning impact={impact} />
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProject} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : (impact && impact.invoices + impact.quotes + impact.payments + impact.contracts > 0 ? 'Delete Project and Everything Linked' : 'Delete Project')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceFormDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        defaultProjectId={projectId ?? undefined}
        onSaved={() => {
          if (projectId) fetchProject(projectId);
          onChanged();
        }}
      />
      <InvoiceFormDialog
        kind="quote"
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        defaultProjectId={projectId ?? undefined}
        onSaved={() => {
          if (projectId) fetchProject(projectId);
          onChanged();
        }}
      />
    </>
  );
}