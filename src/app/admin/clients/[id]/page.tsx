'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Loader2, ArrowLeft, Building2, Edit, Trash2, Plus, Calendar, Save, X } from 'lucide-react';
import { PROJECT_TYPE_LABELS, PIPELINE_STATUS_LABELS } from '@/lib/constants';

interface Project {
  id: string;
  title: string;
  projectType: string;
  pipelineStatus: string;
  shootDate: string | null;
}

interface ClientDetail {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  uen: string | null;
  socials: string | null;
  internalNotes: string | null;
  createdAt: string;
  projects: Project[];
}

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientDetail>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Project state
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectData, setProjectData] = useState({
    title: '',
    projectType: 'CORPORATE',
    shootDate: '',
    notes: ''
  });

  const fetchClient = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error('Failed to fetch client');
      const data = await res.json();
      const clientData = data.client || data;
      setClient(clientData);
      setEditData(clientData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load client details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const saveClient = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (!res.ok) throw new Error('Failed to update client');
      
      const updatedData = await res.json();
      const clientData = updatedData.client || updatedData;
      setClient(prev => prev ? { ...prev, ...clientData } : clientData);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Client details updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update client.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteClient = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete client');
      
      toast({
        title: 'Success',
        description: 'Client deleted.',
      });
      router.push('/admin/clients');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete client.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingProject(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectData,
          clientId: id
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');
      
      toast({
        title: 'Success',
        description: 'Project created successfully.',
      });
      setIsProjectDialogOpen(false);
      setProjectData({
        title: '',
        projectType: 'CORPORATE',
        shootDate: '',
        notes: ''
      });
      fetchClient();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'INQUIRY': return 'secondary';
      case 'QUOTED': return 'outline';
      case 'BOOKED': return 'default';
      case 'IN_PROGRESS': return 'warning';
      case 'DELIVERED': return 'success';
      case 'CLOSED': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Client not found</h2>
        <Button className="mt-4" onClick={() => router.push('/admin/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/admin/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              {client.companyName}
            </h1>
            <p className="text-muted-foreground text-sm">
              Client since {new Date(client.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setEditData(client);
              }}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={saveClient} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  {isEditing ? (
                    <Input name="companyName" value={editData.companyName || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium">{client.companyName}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  {isEditing ? (
                    <Input name="contactName" value={editData.contactName || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium">{client.contactName}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {isEditing ? (
                    <Input name="email" type="email" value={editData.email || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium"><a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a></div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  {isEditing ? (
                    <Input name="phone" type="tel" value={editData.phone || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium">{client.phone || '-'}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>UEN</Label>
                  {isEditing ? (
                    <Input name="uen" value={editData.uen || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium">{client.uen || '-'}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Socials / Links</Label>
                  {isEditing ? (
                    <Input name="socials" value={editData.socials || ''} onChange={handleEditChange} />
                  ) : (
                    <div className="font-medium">{client.socials ? (
                      <a href={client.socials.startsWith('http') ? client.socials : `https://${client.socials}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {client.socials}
                      </a>
                    ) : '-'}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>All projects associated with this client.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsProjectDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </CardHeader>
            <CardContent>
              {(!client.projects || client.projects.length === 0) ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  No projects found. Create one to get started.
                </div>
              ) : (
                <div className="grid gap-4">
                  {(client.projects || []).map((project) => (
                    <Link key={project.id} href={`/admin/projects/${project.id}`}>
                      <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <div className="font-semibold">{project.title}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <Calendar className="h-3 w-3" />
                              {project.shootDate ? new Date(project.shootDate).toLocaleDateString() : 'TBD'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {PROJECT_TYPE_LABELS[project.projectType as keyof typeof PROJECT_TYPE_LABELS] || project.projectType}
                            </Badge>
                            <Badge variant={getStatusVariant(project.pipelineStatus) as any}>
                              {PIPELINE_STATUS_LABELS[project.pipelineStatus as keyof typeof PIPELINE_STATUS_LABELS] || project.pipelineStatus}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea 
                  name="internalNotes" 
                  value={editData.internalNotes || ''} 
                  onChange={handleEditChange}
                  className="min-h-[150px]"
                  placeholder="Add notes about this client..."
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">
                  {client.internalNotes || <span className="text-muted-foreground italic">No internal notes.</span>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete <strong>{client.companyName}</strong> and all associated data. Any linked projects might be affected depending on database constraints.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteClient} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Create a new project for {client.companyName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input 
                  id="title" 
                  required 
                  value={projectData.title} 
                  onChange={(e) => setProjectData({...projectData, title: e.target.value})} 
                  placeholder="e.g. Q3 Corporate Headshots"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="projectType">Project Type *</Label>
                <Select 
                  id="projectType"
                  value={projectData.projectType} 
                  onChange={(e) => setProjectData({...projectData, projectType: e.target.value})}
                >
                  {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shootDate">Shoot Date</Label>
                <Input 
                  id="shootDate" 
                  type="date" 
                  value={projectData.shootDate} 
                  onChange={(e) => setProjectData({...projectData, shootDate: e.target.value})} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Initial Notes</Label>
                <Textarea 
                  id="notes" 
                  value={projectData.notes} 
                  onChange={(e) => setProjectData({...projectData, notes: e.target.value})} 
                  placeholder="Brief requirements, location, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)} disabled={isCreatingProject}>
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
    </div>
  );
}
