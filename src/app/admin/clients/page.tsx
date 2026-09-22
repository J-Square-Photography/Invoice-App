'use client';

import { useEffect, useState, useCallback } from 'react';
import { ClientDetailDialog } from '@/components/client-detail-dialog';
import { AddClientDialog } from '@/components/add-client-dialog';
import { RequirePermission } from '@/components/require-permission';
import { missingClientInfo } from '@/lib/client-info';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Search, UserPlus, Loader2, Building2, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { downloadCsv } from '@/lib/csv';
import { SortSelect, PeriodSelect, useSavedChoice } from '@/components/sort-filter';
import { byDate, byNumber, byText, inPeriod, sortItems, PERIODS, type SortChoice } from '@/lib/sorting';

interface ClientListItem {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  uen: string | null;
  address: string | null;
  createdAt: string;
  _count: { projects: number };
}

const SORT_CHOICES: SortChoice<ClientListItem>[] = [
  { value: 'newest', label: 'Date Added: Newest to Oldest', compare: byDate((c) => c.createdAt, 'desc') },
  { value: 'oldest', label: 'Date Added: Oldest to Newest', compare: byDate((c) => c.createdAt, 'asc') },
  { value: 'name-az', label: 'Company Name: A to Z', compare: byText((c) => c.companyName) },
  { value: 'name-za', label: 'Company Name: Z to A', compare: byText((c) => c.companyName, 'desc') },
  { value: 'projects-most', label: 'Number of Projects: Most to Fewest', compare: byNumber((c) => c._count?.projects ?? 0, 'desc') },
  { value: 'projects-least', label: 'Number of Projects: Fewest to Most', compare: byNumber((c) => c._count?.projects ?? 0, 'asc') },
];

export default function ClientsPage() {
  return (
    <RequirePermission permission="clients">
      <ClientsPageInner />
    </RequirePermission>
  );
}

function ClientsPageInner() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [sort, setSort] = useSavedChoice('clients-sort', 'newest', SORT_CHOICES.map((c) => c.value));
  const [period, setPeriod] = useSavedChoice('clients-period', 'ALL', PERIODS.map((p) => p.value));

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Client detail pop-up. `?view=<id>` deep-links (dashboard, redirects) open it on load.
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('view');
    if (id) setViewId(id);
  }, []);

  const openClient = (id: string) => setViewId(id);

  const closeClient = () => {
    setViewId(null);
    if (window.location.search.includes('view=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const visibleClients = sortItems(
    clients.filter((c) => (!incompleteOnly || missingClientInfo(c).length > 0) && inPeriod(c.createdAt, period)),
    SORT_CHOICES,
    sort
  );
  const incompleteCount = clients.filter((c) => missingClientInfo(c).length > 0).length;

  const exportCsv = () => {
    downloadCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Client / Company', 'Contact', 'Email', 'Phone', 'UEN', 'Address', 'Projects'],
      ...visibleClients.map((c) => [c.companyName, c.contactName, c.email, c.phone, c.uen, c.address, c._count?.projects ?? 0]),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2"><h1 className="text-3xl font-bold tracking-tight">Clients</h1><RefreshButton onRefresh={() => fetchClients(search)} /></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={visibleClients.length === 0} className="flex items-center gap-2" title="Download the clients shown below as a spreadsheet (CSV)">
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SortSelect value={sort} onChange={setSort} options={SORT_CHOICES} />
        <PeriodSelect value={period} onChange={setPeriod} />
        <Button
          variant={incompleteOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncompleteOnly((v) => !v)}
          className="whitespace-nowrap text-xs"
          title="Show only clients that are missing a contact name, email, phone or address"
        >
          Missing info{incompleteCount > 0 ? ` (${incompleteCount})` : ''}
        </Button>
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
              ) : (!visibleClients || visibleClients.length === 0) ? (
                <tr>
                  <td colSpan={7} className="h-24 text-center text-muted-foreground">
                    No clients found.
                  </td>
                </tr>
              ) : (
                visibleClients.map((client) => (
                  <tr key={client.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle">
                      <button
                        type="button"
                        onClick={() => openClient(client.id)}
                        className="font-medium hover:underline text-primary flex items-center gap-2 text-left"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {client.companyName}
                      </button>
                      {missingClientInfo(client).length > 0 && (
                        <div className="mt-1 text-xs italic text-amber-600">Missing: {missingClientInfo(client).join(', ')}</div>
                      )}
                    </td>
                    <td className="p-4 align-middle">{client.contactName || '-'}</td>
                    <td className="p-4 align-middle">{client.email || '-'}</td>
                    <td className="p-4 align-middle">{client.phone || '-'}</td>
                    <td className="p-4 align-middle">{client.uen || '-'}</td>
                    <td className="p-4 align-middle">
                      <Badge variant="secondary">{client._count?.projects ?? 0}</Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" title="View details" onClick={() => openClient(client.id)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ClientDetailDialog
        clientId={viewId}
        onClose={closeClient}
        onChanged={() => fetchClients(search)}
      />

      <AddClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreated={() => fetchClients(search)}
      />
    </div>
  );
}
