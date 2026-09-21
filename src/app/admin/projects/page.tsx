'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Eye } from 'lucide-react';
import { ProjectDetailDialog } from '@/components/project-detail-dialog';
import { rankProjects } from '@/lib/search-rank';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { PIPELINE_STATUS_LABELS } from '@/lib/constants';
import { SERVICE_TAGS } from '@/lib/service-tags';
import { ServiceTagPicker, ServiceTagBadges } from '@/components/service-tag-picker';

type Project = {
  id: string;
  title: string;
  clientId: string;
  projectType: string;
  serviceTags?: string[];
  pipelineStatus: string;
  shootDate: string | null;
  client: { companyName: string };
  _count?: { invoices: number };
};

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Dialog & Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [serviceTags, setServiceTags] = useState<string[]>([]);
  const [shootDate, setShootDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Client Search State
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<{id: string; companyName: string; contactName: string; email: string}[]>([]);
  const [selectedClient, setSelectedClient] = useState<{id: string; companyName: string} | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  // Existing projects with a similar title, shown under the title field to avoid duplicates
  const [similarProjects, setSimilarProjects] = useState<Project[]>([]);

  const { toast } = useToast();

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchQuery) query.append('q', searchQuery);
      if (statusFilter !== 'ALL') query.append('status', statusFilter);
      if (typeFilter !== 'ALL') query.append('tag', typeFilter);

      const res = await fetch(`/api/projects?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      } else {
        toast({ title: 'Error', description: 'Failed to fetch projects', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch projects', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, typeFilter]);

  // Search clients as you type: from the first letter, any case, best matches first
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?q=${encodeURIComponent(clientSearch.trim())}&limit=8`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setClientResults(data.clients || []);
        }
      } catch (err) {
        console.error("Failed to fetch clients", err);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientSearch]);
  // Suggest existing projects with a similar title while typing one
  useEffect(() => {
    const q = title.trim();
    if (!isDialogOpen || !q) {
      setSimilarProjects([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(q)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSimilarProjects(rankProjects<Project>(data.projects || [], q).slice(0, 5));
        }
      } catch {
        // suggestions are optional
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title, isDialogOpen]);

  // Project detail pop-up. `?view=<id>` deep-links (dashboard, client pop-up) open it on load.
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('view');
    if (id) setViewId(id);
  }, []);

  const openProject = (id: string) => setViewId(id);

  const closeProject = () => {
    setViewId(null);
    if (window.location.search.includes('view=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast({ title: 'Error', description: 'Please select a client', variant: 'destructive' });
      return;
    }
    if (serviceTags.length === 0) {
      toast({ title: 'Choose a service', description: 'Tag the project with at least one service (or Other).', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          clientId: selectedClient.id,
          serviceTags,
          shootDate: shootDate ? new Date(shootDate).toISOString() : null,
          notes
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Project created successfully' });
        setIsDialogOpen(false);
        // Reset form
        setTitle('');
        setServiceTags([]);
        setShootDate('');
        setNotes('');
        setSelectedClient(null);
        setClientSearch('');
        fetchProjects();
      } else {
        const errorData = await res.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to create project', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'INQUIRY': return 'secondary';
      case 'QUOTED': return 'outline';
      case 'BOOKED': return 'default';
      case 'IN_PROGRESS': return 'warning';
      case 'DELIVERED': return 'success';
      case 'CLOSED': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2"><h1 className="text-3xl font-bold tracking-tight">Projects</h1><RefreshButton onRefresh={fetchProjects} /></div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white border rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search projects or clients..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-full sm:w-48 items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
        >
          <option value="ALL">All Statuses</option>
          {Object.entries(PIPELINE_STATUS_LABELS || {}).map(([key, label]) => (
            <option key={key} value={key}>{label as string}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex h-10 w-full sm:w-48 items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
        >
          <option value="ALL">All Services</option>
          {SERVICE_TAGS.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b">
              <tr>
                <th className="px-6 py-3">Project Title</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Services</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Shoot Date</th>
                <th className="px-6 py-3">Invoices</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    Loading projects...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    No projects found.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-neutral-50">
                    <td className="px-6 py-4 font-medium">
                      <button
                        type="button"
                        onClick={() => openProject(project.id)}
                        className="hover:underline text-neutral-900 text-left"
                      >
                        {project.title}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/clients/${project.clientId}`} className="hover:underline text-blue-600">
                        {project.client?.companyName || 'Unknown Client'}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <ServiceTagBadges tags={project.serviceTags} legacyType={project.projectType} />
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusBadgeVariant(project.pipelineStatus) as any}>
                        {PIPELINE_STATUS_LABELS?.[project.pipelineStatus as keyof typeof PIPELINE_STATUS_LABELS] || project.pipelineStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {project.shootDate ? new Date(project.shootDate).toLocaleDateString() : 'TBD'}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {project._count?.invoices || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openProject(project.id)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectDetailDialog
        projectId={viewId}
        onClose={closeProject}
        onChanged={fetchProjects}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Set up a new project for a client. You can raise invoices and contracts against it afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 py-2">
            
            <div className="relative">
              <Label>Client</Label>
              {selectedClient ? (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {selectedClient.companyName}
                  </Badge>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setSelectedClient(null); setClientSearch(''); }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="mt-1 relative">
                  <Input
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    placeholder="Search clients..."
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  {showClientDropdown && clientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-60 overflow-auto">
                      {clientResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between"
                          onClick={() => { 
                            setSelectedClient({ id: c.id, companyName: c.companyName }); 
                            setShowClientDropdown(false); 
                            setClientSearch(''); 
                          }}
                        >
                          <span className="font-medium">{c.companyName}</span>
                          <span className="text-neutral-500 text-xs sm:text-sm sm:ml-2">{c.contactName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input 
                id="title" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                placeholder="e.g. Summer Campaign Shoot"
              />
              {similarProjects.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">
                    {selectedClient &&
                    similarProjects.some(
                      (p) => p.clientId === selectedClient.id && p.title.trim().toLowerCase() === title.trim().toLowerCase()
                    )
                      ? 'This client already has a project with this exact title.'
                      : 'Similar projects already exist. Open one instead?'}
                  </p>
                  <ul className="space-y-1">
                    {similarProjects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDialogOpen(false);
                            openProject(p.id);
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded px-1.5 py-1 text-left hover:bg-amber-100"
                        >
                          <span className="min-w-0 truncate font-medium">{p.title}</span>
                          <span className="shrink-0 text-amber-800">
                            {p.client?.companyName}
                            {' · '}
                            {PIPELINE_STATUS_LABELS?.[p.pipelineStatus as keyof typeof PIPELINE_STATUS_LABELS] || p.pipelineStatus}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Services *</Label>
              <ServiceTagPicker value={serviceTags} onChange={setServiceTags} />
              <p className="text-xs text-neutral-500">Pick every service this project involves. Invoices for it will offer only these services' prices.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shootDate">Shoot Date (Optional)</Label>
              <Input 
                id="shootDate" 
                type="date" 
                value={shootDate} 
                onChange={(e) => setShootDate(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Any initial project notes..."
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
