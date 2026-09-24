'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Counts {
  clients: number;
  projects: number;
  invoices: number;
  payments: number;
  contracts: number;
  signatures: number;
  staff: number;
  timesheets: number;
  payslips: number;
}

const CONFIRMATION_WORD = 'DELETE';

/**
 * Two-step "start from a blank slate" reset: the button that opens this pop-up is
 * step one; typing DELETE and pressing the red button here is step two.
 */
export function ResetDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [includeClients, setIncludeClients] = useState(true);
  const [includeStaff, setIncludeStaff] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setIncludeClients(true);
    setIncludeStaff(false);
    setCounts(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/reset-data');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCounts(data.counts);
        }
      } catch {
        // Counts are informational; the reset itself still works without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleReset = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed, includeClients, includeStaff }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Reset Failed', description: data.error || 'Could not reset data.', variant: 'destructive' });
        return;
      }
      const d = data.deleted;
      toast({
        title: 'Blank Slate Ready',
        description: `Deleted ${d.invoices} invoices, ${d.contracts} contracts, ${d.signatures} signature records${
          includeClients ? `, ${d.projects} projects and ${d.clients} clients` : ''
        }${includeStaff ? `, ${d.staff} staff, ${d.timesheets} timesheets and ${d.payslips} payslips` : ''}.`,
      });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Network error occurred', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const rows: Array<[string, number | undefined, boolean]> = [
    ['Invoices', counts?.invoices, true],
    ['Payment records', counts?.payments, true],
    ['Contracts', counts?.contracts, true],
    ['E-signature records', counts?.signatures, true],
    ['Projects', counts?.projects, includeClients],
    ['Clients', counts?.clients, includeClients],
    ['Staff', counts?.staff, includeStaff],
    ['Timesheets', counts?.timesheets, includeStaff || includeClients],
    ['Payslips', counts?.payslips, includeStaff],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !deleting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> Delete everything and start fresh?
          </DialogTitle>
          <DialogDescription>
            This will blank the entire history. It cannot be undone and there is no backup. Team accounts are kept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm space-y-1.5">
            <p className="font-medium text-red-800">This will permanently delete:</p>
            <ul className="space-y-1 text-red-800">
              {rows.map(([label, count, included]) => (
                <li key={label} className={included ? 'flex justify-between' : 'flex justify-between opacity-40 line-through'}>
                  <span>{label}</span>
                  <span className="font-semibold">{count === undefined ? '…' : count}</span>
                </li>
              ))}
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeClients}
              onChange={(e) => setIncludeClients(e.target.checked)}
              className="rounded"
            />
            Also delete all clients and projects
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeStaff}
              onChange={(e) => setIncludeStaff(e.target.checked)}
              className="rounded"
            />
            Also delete all staff, timesheets and payslips
          </label>
          {!includeStaff && includeClients && (
            <p className="text-xs text-amber-700">
              Staff and payslip records will be kept, but any timesheets logged against a deleted project go with it.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reset-confirm">
              To confirm, type <span className="font-mono font-bold">{CONFIRMATION_WORD}</span> below
            </Label>
            <Input
              id="reset-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRMATION_WORD}
              autoComplete="off"
              disabled={deleting}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReset}
            disabled={deleting || typed !== CONFIRMATION_WORD}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
