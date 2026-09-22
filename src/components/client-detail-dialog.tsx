'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { PhoneInput } from '@/components/phone-input';
import { SalutationNameFields, type NameFieldsValue } from '@/components/salutation-name-fields';
import { FieldTag } from '@/components/field-tag';
import { DeleteImpactWarning } from '@/components/delete-impact';
import type { DeleteImpact } from '@/lib/delete-impact';
import { missingClientInfo } from '@/lib/client-info';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { Loader2, Edit, Trash2, Plus, Calendar } from 'lucide-react';
import { PIPELINE_STATUS_LABELS } from '@/lib/constants';
import { ServiceTagPicker, ServiceTagBadges } from '@/components/service-tag-picker';

interface Project {
  id: string;
  title: string;
  projectType: string;
  serviceTags?: string[];
  pipelineStatus: string;
  shootDate: string | null;
}

interface ClientDetail {
  id: string;
  companyName: string;
  contactName: string;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  uen: string | null;
  address: string | null;
  socials: string | null;
  internalNotes: string | null;
  createdAt: string;
  projects: Project[];
}

interface ClientForm {
  companyName: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  uen: string;
  address: string;
  socials: string;
  internalNotes: string;
}

const toForm = (c: ClientDetail): ClientForm => ({
  companyName: c.companyName || '',
  // A client saved before this feature has a printed name but no split parts recorded. Rather
  // than guess how to split it (risking a wrongly-placed family name), the whole thing goes into
  // Given Name and Family Name stays blank: saving with no further changes reproduces the exact
  // same printed name, so nothing can be silently altered just by opening and saving Edit.
  salutation: c.salutation || '',
  firstName: c.firstName || (c.salutation || c.lastName ? '' : c.contactName || ''),
  lastName: c.lastName || '',
  email: c.email || '',
  phone: c.phone || '',
  uen: c.uen || '',
  address: c.address || '',
  socials: c.socials || '',
  internalNotes: c.internalNotes || '',
});

const EMPTY_PROJECT = { title: '', serviceTags: [] as string[], shootDate: '', notes: '' };

function statusVariant(status: string) {
  switch (status) {
    case 'INQUIRY': return 'secondary';
    case 'QUOTED': return 'outline';
    case 'BOOKED': return 'default';
    case 'IN_PROGRESS': return 'warning';
    case 'DELIVERED': return 'success';
    case 'CLOSED': return 'secondary';
    default: return 'default';
  }
}

export function ClientDetailDialog({
  clientId,
  onClose,
  onChanged,
}: {
  clientId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [financials, setFinancials] = useState<{ invoiced: number; paid: number; outstanding: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<ClientForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [projectOpen, setProjectOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectData, setProjectData] = useState(EMPTY_PROJECT);

  const fetchClient = async (id: string, showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error('Failed to fetch client');
      const data = await res.json();
      setClient(data.client || data);
      setImpact(data.impact ?? null);
      setFinancials(data.financials ?? null);
    } catch {
      toast({ title: 'Error', description: 'Failed to load client details.', variant: 'destructive' });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMode('view');
    setClient(null);
    if (clientId) fetchClient(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const startEdit = () => {
    if (!client) return;
    setForm(toForm(client));
    setMode('edit');
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !clientId) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update client');
      const updated = await res.json();
      const clientData = updated.client || updated;
      setClient((prev) => (prev ? { ...prev, ...clientData } : clientData));
      setMode('view');
      onChanged();
      toast({ title: 'Success', description: 'Client details updated.' });
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : 'Failed to update client.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!clientId) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete client');
      toast({ title: 'Success', description: 'Client deleted.' });
      setDeleteOpen(false);
      onClose();
      onChanged();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete client.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    if (projectData.serviceTags.length === 0) {
      toast({ title: 'Choose a service', description: 'Tag the project with at least one service (or Other).', variant: 'destructive' });
      return;
    }
    try {
      setIsCreatingProject(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...projectData, clientId }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      toast({ title: 'Success', description: 'Project created successfully.' });
      setProjectOpen(false);
      setProjectData(EMPTY_PROJECT);
      fetchClient(clientId, false);
      onChanged();
    } catch {
      toast({ title: 'Error', description: 'Failed to create project.', variant: 'destructive' });
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <>
      <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          {loading || !client ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mode === 'edit' && form ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Client</DialogTitle>
                <DialogDescription>Update the details for {client.companyName}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={saveClient} className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cd-companyName">Client / Company Name <FieldTag required /></Label>
                    <Input id="cd-companyName" name="companyName" required value={form.companyName} onChange={handleFormChange} />
                  </div>
                  <SalutationNameFields
                    idPrefix="cd"
                    value={{ salutation: form.salutation, firstName: form.firstName, lastName: form.lastName }}
                    onChange={(next: NameFieldsValue) => setForm((prev) => (prev ? { ...prev, ...next } : prev))}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="cd-email">Email <FieldTag /></Label>
                    <Input id="cd-email" name="email" type="email" value={form.email} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cd-phone">Phone <FieldTag /></Label>
                    <PhoneInput id="cd-phone" value={form.phone} onChange={(v) => setForm((prev) => (prev ? { ...prev, phone: v } : prev))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cd-uen">UEN <FieldTag /></Label>
                    <Input id="cd-uen" name="uen" value={form.uen} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cd-socials">Socials / Links <FieldTag /></Label>
                    <Input id="cd-socials" name="socials" placeholder="e.g. instagram.com/company" value={form.socials} onChange={handleFormChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cd-address">Address <FieldTag /></Label>
                  <Input id="cd-address" name="address" maxLength={300} placeholder="e.g. 123 Example Road, #01-23, Singapore 123456" value={form.address} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cd-notes">Internal Notes <FieldTag /></Label>
                  <Textarea id="cd-notes" name="internalNotes" rows={4} value={form.internalNotes} onChange={handleFormChange} placeholder="Add notes about this client..." />
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
                <DialogTitle>{client.companyName}</DialogTitle>
                <DialogDescription>
                  Client since {formatDate(client.createdAt)}
                </DialogDescription>
                {missingClientInfo(client).length > 0 && (
                  <p className="text-xs italic text-amber-600">Missing: {missingClientInfo(client).join(', ')}</p>
                )}
              </DialogHeader>

              <div className="space-y-5 py-2">
                {financials && financials.invoiced > 0 && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center">
                    <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Invoiced</p><p className="text-sm font-semibold">SGD ${financials.invoiced.toFixed(2)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Paid</p><p className="text-sm font-semibold text-emerald-600">SGD ${financials.paid.toFixed(2)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wider text-neutral-500">Outstanding</p><p className={`text-sm font-semibold ${financials.outstanding > 0 ? 'text-amber-600' : ''}`}>SGD ${financials.outstanding.toFixed(2)}</p></div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Contact Name</Label>
                    <div className="font-medium">{client.contactName || '-'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <div className="font-medium">
                      {client.email ? <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a> : '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <div className="font-medium">{client.phone || '-'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label>UEN</Label>
                    <div className="font-medium">{client.uen || '-'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Address</Label>
                    <div className="font-medium">{client.address || '-'}</div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Socials / Links</Label>
                    <div className="font-medium">
                      {client.socials ? (
                        <a
                          href={client.socials.startsWith('http') ? client.socials : `https://${client.socials}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {client.socials}
                        </a>
                      ) : '-'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Internal Notes</Label>
                  <div className="whitespace-pre-wrap text-sm">
                    {client.internalNotes || <span className="text-muted-foreground italic">No internal notes.</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Projects</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setProjectOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Project
                    </Button>
                  </div>
                  {!client.projects || client.projects.length === 0 ? (
                    <div className="text-center py-5 text-sm text-muted-foreground border border-dashed rounded-lg">
                      No projects yet. Add one to get started.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {/* Column headings so first-time users know what each badge means */}
                      <div className="hidden sm:grid grid-cols-[1fr_12rem_7rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        <span>Name</span>
                        <span className="text-center">Services</span>
                        <span className="text-center">Status</span>
                      </div>
                      {client.projects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/admin/projects?view=${project.id}`}
                          onClick={onClose}
                          className="grid grid-cols-1 sm:grid-cols-[1fr_12rem_7rem] items-center gap-2 sm:gap-3 rounded-lg border p-3 hover:bg-neutral-100 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Name</div>
                            <div className="font-semibold text-sm truncate">{project.title}</div>
                            <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {project.shootDate ? formatDate(project.shootDate) : 'Shoot date TBD'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-center">
                            <span className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-11">Services</span>
                            <ServiceTagBadges tags={project.serviceTags} legacyType={project.projectType} className="sm:justify-center" />
                          </div>
                          <div className="flex items-center gap-2 sm:justify-center">
                            <span className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-11">Status</span>
                            <Badge variant={statusVariant(project.pipelineStatus) as any}>
                              {PIPELINE_STATUS_LABELS[project.pipelineStatus as keyof typeof PIPELINE_STATUS_LABELS] || project.pipelineStatus}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button type="button" onClick={startEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this client?</DialogTitle>
            <DialogDescription>
              This cannot be undone. <strong>{client?.companyName}</strong> will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DeleteImpactWarning impact={impact} showProjects />
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteClient} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (impact && impact.projects + impact.invoices + impact.quotes + impact.payments + impact.contracts > 0 ? 'Delete Client and Everything Linked' : 'Delete Client')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add project */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>Create a new project for {client?.companyName}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createProject} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cd-p-title">Project Title *</Label>
              <Input
                id="cd-p-title"
                required
                value={projectData.title}
                onChange={(e) => setProjectData({ ...projectData, title: e.target.value })}
                placeholder="e.g. Q3 Corporate Headshots"
              />
            </div>
                        <div className="space-y-2">
              <Label>Services *</Label>
              <ServiceTagPicker
                value={projectData.serviceTags}
                onChange={(tags) => setProjectData({ ...projectData, serviceTags: tags })}
              />
              <p className="text-xs text-neutral-500">Invoices for this project offer only the prices of these services.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-p-date">Shoot Date</Label>
              <Input
                id="cd-p-date"
                type="date"
                value={projectData.shootDate}
                onChange={(e) => setProjectData({ ...projectData, shootDate: e.target.value })}
              />
            </div><div className="space-y-2">
              <Label htmlFor="cd-p-notes">Initial Notes</Label>
              <Textarea
                id="cd-p-notes"
                value={projectData.notes}
                onChange={(e) => setProjectData({ ...projectData, notes: e.target.value })}
                placeholder="Brief requirements, location, etc."
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setProjectOpen(false)} disabled={isCreatingProject}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingProject}>
                {isCreatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
