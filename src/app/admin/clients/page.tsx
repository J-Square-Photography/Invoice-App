'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
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
import { Search, UserPlus, Loader2, Building2, ExternalLink } from 'lucide-react';

interface ClientListItem {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  uen: string | null;
  createdAt: string;
  _count: { projects: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    uen: '',
    socials: '',
    internalNotes: ''
  });

  const { toast } = useToast();

  const fetchClients = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : data.clients || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load clients. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initial fetch and debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search, fetchClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to create client');

      toast({
        title: 'Success',
        description: 'Client created successfully',
      });
      
      setIsDialogOpen(false);
      setFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        uen: '',
        socials: '',
        internalNotes: ''
      });
      fetchClients(search);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Company</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Contact</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Phone</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">UEN</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Projects</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={7} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : (!clients || clients.length === 0) ? (
                <tr>
                  <td colSpan={7} className="h-24 text-center text-muted-foreground">
                    No clients found.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle">
                      <Link href={`/admin/clients/${client.id}`} className="font-medium hover:underline text-primary flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {client.companyName}
                      </Link>
                    </td>
                    <td className="p-4 align-middle">{client.contactName}</td>
                    <td className="p-4 align-middle">{client.email}</td>
                    <td className="p-4 align-middle">{client.phone || '-'}</td>
                    <td className="p-4 align-middle">{client.uen || '-'}</td>
                    <td className="p-4 align-middle">
                      <Badge variant="secondary">{client._count?.projects ?? 0}</Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" title="View details">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Enter the client details below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input id="companyName" name="companyName" required value={formData.companyName} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input id="contactName" name="contactName" required value={formData.contactName} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required value={formData.email} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uen">UEN</Label>
                <Input id="uen" name="uen" value={formData.uen} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="socials">Socials / Links</Label>
                <Input id="socials" name="socials" placeholder="e.g. instagram.com/company" value={formData.socials} onChange={handleInputChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea id="internalNotes" name="internalNotes" value={formData.internalNotes} onChange={handleInputChange} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
