'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, PIPELINE_STATUSES, PIPELINE_STATUS_LABELS } from '@/lib/constants';

type Project = {
  id: string;
  title: string;
  clientId: string;
  projectType: string;
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
  const [projectType, setProjectType] = useState('PORTRAIT');
  const [shootDate, setShootDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Client Search State
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<{id: string; companyName: string; contactName: string; email: string}[]>([]);
  const [selectedClient, setSelectedClient] = useState<{id: string; companyName: string} | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const { toast } = useToast();

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchQuery) query.append('q', searchQuery);
      if (statusFilter !== 'ALL') query.append('status', statusFilter);
      if (typeFilter !== 'ALL') query.append('type', typeFilter);

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

  // Search clients with debounce
  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?q=${encodeURIComponent(clientSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setClientResults(data.clients || []);
          setShowClientDropdown(true);
        }
      } catch (err) {
        console.error("Failed to fetch clients", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast({ title: 'Error', description: 'Please select a client', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          clientId: selectedClient.id,
          projectType,
          shootDate: shootDate ? new Date(shootDate).toISOString() : null,
          notes
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Project created successfully' });
        setIsDialogOpen(false);
        // Reset form
        setTitle('');
        setProjectType('PORTRAIT');
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
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
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
          <option value="ALL">All Types</option>
          {Object.entries(PROJECT_TYPE_LABELS || {}).map(([key, label]) => (
            <option key={key} value={key}>{label as string}</option>
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
                <th className="px-6 py-3">Type</th>
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
                      <Link href={`/admin/projects/${project.id}`} className="hover:underline text-neutral-900">
                        {project.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/clients/${project.clientId}`} className="hover:underline text-blue-600">
                        {project.client?.companyName || 'Unknown Client'}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {PROJECT_TYPE_LABELS?.[project.projectType as keyof typeof PROJECT_TYPE_LABELS] || project.projectType}
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
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/projects/${project.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
            
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
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search clients..."
                    onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectType">Project Type</Label>
              <select
                id="projectType"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
                required
              >
                {Object.entries(PROJECT_TYPE_LABELS || {}).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
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

            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Project
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
