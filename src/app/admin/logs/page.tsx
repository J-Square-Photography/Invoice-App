'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { useToast } from '@/components/ui/toast';
import { Loader2, ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, type ActivityAction, type ActivityEntityType } from '@/lib/activity-log-types';

interface LogRow {
  id: string;
  userName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string | null;
  entityLabel: string | null;
  description: string;
  createdAt: string;
}

const ACTION_LABELS: Record<ActivityAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  CANCEL: 'Cancelled',
  VOID: 'Voided',
  UNVOID: 'Un-voided',
  CONVERT: 'Converted',
  REVERT: 'Reverted',
  DUPLICATE: 'Duplicated',
  VERIFY: 'Verified',
};

const ACTION_BADGE: Record<ActivityAction, NonNullable<BadgeProps['variant']>> = {
  CREATE: 'success',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  CANCEL: 'outline',
  VOID: 'destructive',
  UNVOID: 'success',
  CONVERT: 'default',
  REVERT: 'warning',
  DUPLICATE: 'secondary',
  VERIFY: 'success',
};

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  STAFF: 'Staff',
  CLIENT: 'Client',
  PROJECT: 'Project',
  INVOICE: 'Invoice',
  QUOTE: 'Quotation',
  PAYMENT: 'Payment',
  USER: 'Team',
  CONTRACT: 'Contract',
  TIMESHEET: 'Timesheet',
};

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-SG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function LogsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      if (search.trim()) params.set('q', search.trim());
      params.set('page', String(page));
      const res = await fetch(`/api/activity-log?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch {
      toast({ title: 'Error', description: 'Failed to load activity logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [action, entityType, search, page, toast]);

  // Any filter change resets back to page 1
  useEffect(() => {
    setPage(1);
  }, [action, entityType, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-500">You do not have permission to access this page.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
            <RefreshButton onRefresh={load} />
          </div>
          <p className="text-neutral-500">Who did what, when - including create dialogs opened and closed without saving</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <Input placeholder="Search description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-auto">
          <option value="">All actions</option>
          {ACTIVITY_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-auto">
          <option value="">All types</option>
          {ACTIVITY_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {ENTITY_LABELS[e]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 px-4">
              <ScrollText className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">No activity found</h3>
              <p className="mt-1 text-sm text-neutral-500">Actions across the app appear here as they happen.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">When</th>
                    <th className="py-3 px-4">Who</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-600">{fmt(l.createdAt)}</td>
                      <td className="py-3 px-4 font-medium text-neutral-900">{l.userName}</td>
                      <td className="py-3 px-4">
                        <Badge variant={ACTION_BADGE[l.action]} className="text-xs font-normal">
                          {ACTION_LABELS[l.action] ?? l.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{ENTITY_LABELS[l.entityType] ?? l.entityType}</td>
                      <td className="py-3 px-4 text-neutral-700">{l.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
