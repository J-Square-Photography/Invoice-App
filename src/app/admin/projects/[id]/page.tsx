'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, FileText, CheckCircle2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS } from '@/lib/constants';

type Project = {
  id: string;
  title: string;
  clientId: string;
  projectType: string;
  pipelineStatus: string;
  shootDate: string | null;
  notes: string | null;
  createdAt: string;
  client: { 
    id: string;
    companyName: string;
    contactName: string;
  };
  invoices: any[];
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    title: '',
    projectType: '',
    shootDate: '',
    notes: ''
  });

  const pipelineSteps = [
    { key: 'INQUIRY', label: 'Inquiry' },
    { key: 'QUOTED', label: 'Quoted' },
    { key: 'BOOKED', label: 'Booked' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'CLOSED', label: 'Closed' },
  ];

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setEditForm({
          title: data.project.title,
          projectType: data.project.projectType,
          shootDate: data.project.shootDate ? new Date(data.project.shootDate).toISOString().split('T')[0] : '',
          notes: data.project.notes || ''
        });
      } else {
        toast({ title: 'Error', description: 'Failed to load project details', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load project details', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const updateStatus = async (newStatus: string) => {
    if (!project || project.pipelineStatus === newStatus) return;
    
    // Optimistic UI update
    const previousStatus = project.pipelineStatus;
    setProject({ ...project, pipelineStatus: newStatus });
    
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: newStatus }),
      });

      if (res.ok) {
        toast({ title: 'Status Updated', description: `Project moved to ${pipelineSteps.find(s => s.key === newStatus)?.label}` });
      } else {
        // Revert on error
        setProject({ ...project, pipelineStatus: previousStatus });
        toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
      }
    } catch (err) {
      setProject({ ...project, pipelineStatus: previousStatus });
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const openEditDialog = () => {
    if (!project) return;
    setEditForm({
      title: project.title,
      projectType: project.projectType,
      shootDate: project.shootDate ? new Date(project.shootDate).toISOString().split('T')[0] : '',
      notes: project.notes || ''
    });
    setIsEditing(true);
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          projectType: editForm.projectType,
          shootDate: editForm.shootDate ? new Date(editForm.shootDate).toISOString() : null,
          notes: editForm.notes
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setIsEditing(false);
        toast({ title: 'Success', description: 'Project details updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to update details', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update details', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Deleted', description: 'Project deleted successfully' });
        router.push('/admin/projects');
      } else {
        toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-neutral-500">Loading project details...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-red-500">Project not found.</div>;
  }

  const currentIndex = pipelineSteps.findIndex(s => s.key === project.pipelineStatus);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-2">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Pipeline Status</h2>
            <div className="flex items-center gap-1 sm:gap-2">
              {pipelineSteps.map((step, index) => {
                const isActive = index <= currentIndex;
                const isCurrent = step.key === project.pipelineStatus;
                return (
                  <button
                    key={step.key}
                    onClick={() => updateStatus(step.key)}
                    className={cn(
                      'flex-1 py-2 sm:py-3 px-1 text-xs sm:text-sm font-medium rounded-md transition-all text-center flex flex-col items-center gap-1',
                      isCurrent
                        ? 'bg-neutral-900 text-white shadow-md scale-[1.02]'
                        : isActive
                        ? 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
                        : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                    )}
                  >
                    {isActive && <CheckCircle2 className={cn("h-3 w-3", isCurrent ? "text-white" : "text-neutral-600")} />}
                    <span>{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Project Details</h2>
            
            <div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <div className="text-sm text-neutral-500">Client</div>
                    <Link href={`/admin/clients/${project.clientId}`} className="font-medium text-blue-600 hover:underline">
                      {project.client?.companyName}
                    </Link>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-500">Type</div>
                    <Badge variant="secondary" className="mt-1">
                      {PROJECT_TYPE_LABELS?.[project.projectType as keyof typeof PROJECT_TYPE_LABELS] || project.projectType}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-500">Shoot Date</div>
                    <div className="font-medium mt-1">
                      {project.shootDate ? new Date(project.shootDate).toLocaleDateString() : 'Not scheduled'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-500">Created At</div>
                    <div className="font-medium mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {project.notes && (
                  <div className="pt-4 border-t">
                    <div className="text-sm text-neutral-500 mb-2">Notes</div>
                    <div className="whitespace-pre-wrap text-sm">{project.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-neutral-500" />
                Invoices
              </h2>
            </div>
            
            {project.invoices && project.invoices.length > 0 ? (
              <div className="space-y-3">
                {project.invoices.map((inv: any) => (
                  <Link key={inv.id} href={`/admin/invoices/${inv.id}`}>
                    <div className="p-3 border rounded-md bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-neutral-900 font-mono">
                          {inv.invoiceNumber || `Invoice #${inv.id.slice(0, 8)}`}
                        </span>
                        <span className="text-xs font-semibold">
                          SGD ${inv.totalAmount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-neutral-500">{inv.status}</span>
                        {inv.balanceDue > 0 ? (
                          <span className="text-xs text-amber-600 font-medium">Due: ${inv.balanceDue.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Paid</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-neutral-500 bg-neutral-50 rounded-md border border-dashed">
                No invoices generated yet.
              </div>
            )}
            
            <Link href="/admin/invoices" className="block mt-4">
              <Button className="w-full" variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Go to Invoicing
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details for {project.title}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDetails} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={editForm.title}
                onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectType">Project Type *</Label>
                <select
                  id="projectType"
                  value={editForm.projectType}
                  onChange={(e) => setEditForm({...editForm, projectType: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
                  required
                >
                  {Object.entries(PROJECT_TYPE_LABELS || {}).map(([key, label]) => (
                    <option key={key} value={key}>{label as string}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shootDate">Shoot Date</Label>
                <Input
                  id="shootDate"
                  type="date"
                  value={editForm.shootDate}
                  onChange={(e) => setEditForm({...editForm, shootDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                rows={4}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete <strong>{project.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
