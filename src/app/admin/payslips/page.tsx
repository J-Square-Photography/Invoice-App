'use client';

import { useEffect, useState, useCallback } from 'react';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Loader2, Download, Trash2, X, Eye } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface PayslipItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: string | number;
  overtimeHours: string | number;
  basicPay: string | number;
  overtimePay: string | number;
  netPay: string | number;
  status: 'DRAFT' | 'PAID';
  staff: { id: string; name: string; type: string };
  _count: { timesheets: number };
}

interface StaffOption { id: string; name: string; }
interface LineItem { label: string; amount: string }

export default function PayslipsPage() {
  return (
    <RequirePermission permission="staff">
      <PayslipsPageInner />
    </RequirePermission>
  );
}

function PayslipsPageInner() {
  const [payslips, setPayslips] = useState<PayslipItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [rateOverride, setRateOverride] = useState('');
  const [allowances, setAllowances] = useState<LineItem[]>([]);
  const [deductions, setDeductions] = useState<LineItem[]>([]);

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payslips');
      if (!res.ok) throw new Error('Failed to fetch payslips');
      const data = await res.json();
      setPayslips(data.payslips || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payslips.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);
  useEffect(() => {
    fetch('/api/staff?activeOnly=true').then((r) => r.json()).then((d) => setStaffOptions(d.staff || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setStaffId('');
    setPeriodStart('');
    setPeriodEnd('');
    setRateOverride('');
    setAllowances([]);
    setDeductions([]);
    setDialogOpen(true);
  };

  const addLine = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>) => setter((rows) => [...rows, { label: '', amount: '' }]);
  const removeLine = (setter: React.Dispatch<React.SetStateAction<LineItem[]>>, idx: number) => setter((rows) => rows.filter((_, i) => i !== idx));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/payslips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          periodStart,
          periodEnd,
          hourlyRate: rateOverride.trim() ? Number(rateOverride) : undefined,
          allowances: allowances.filter((a) => a.label.trim() && a.amount).map((a) => ({ label: a.label, amount: Number(a.amount) })),
          deductions: deductions.filter((d) => d.label.trim() && d.amount).map((d) => ({ label: d.label, amount: Number(d.amount) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate payslip');
      toast({ title: 'Generated', description: 'Draft payslip created from logged hours.' });
      setDialogOpen(false);
      fetchPayslips();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate payslip', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async (p: PayslipItem) => {
    if (!confirm(`Mark this payslip for ${p.staff.name} as paid? This locks it.`)) return;
    try {
      const res = await fetch(`/api/payslips/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Updated', description: 'Payslip marked as paid.' });
      fetchPayslips();
    } catch {
      toast({ title: 'Error', description: 'Failed to update payslip', variant: 'destructive' });
    }
  };

  const handleDelete = async (p: PayslipItem) => {
    if (!confirm('Delete this draft payslip? Its shifts will become unbilled again.')) return;
    try {
      const res = await fetch(`/api/payslips/${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast({ title: 'Deleted', description: 'Payslip removed.' });
      fetchPayslips();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Payslips</h1>
          <RefreshButton onRefresh={fetchPayslips} />
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Generate Payslip
        </Button>
      </div>

      <Card>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Staff</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Period</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Hours</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Net Pay</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : payslips.length === 0 ? (
                <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">No payslips generated yet.</td></tr>
              ) : (
                payslips.map((p) => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{p.staff.name}</td>
                    <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">{formatDate(p.periodStart)} - {formatDate(p.periodEnd)}</td>
                    <td className="p-4 align-middle">
                      {Number(p.totalHours).toFixed(2)}h
                      {Number(p.overtimeHours) > 0 && <span className="text-amber-600"> ({Number(p.overtimeHours).toFixed(2)}h OT)</span>}
                    </td>
                    <td className="p-4 align-middle font-semibold">SGD {Number(p.netPay).toFixed(2)}</td>
                    <td className="p-4 align-middle">
                      <Badge variant={p.status === 'PAID' ? 'success' : 'secondary'}>{p.status === 'PAID' ? 'Paid' : 'Draft'}</Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/payslips/${p.id}`}>
                          <Button variant="ghost" size="icon" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" title="Download PDF" onClick={() => window.open(`/api/payslips/${p.id}/pdf`, '_blank')}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {p.status === 'DRAFT' && (
                          <>
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => markPaid(p)}>Mark Paid</Button>
                            <Button variant="ghost" size="icon" title="Delete draft" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payslip</DialogTitle>
            <DialogDescription>Rolls up every unbilled logged shift for this staff member in the period.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="ps-staff">Staff Member *</Label>
              <Select id="ps-staff" required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Choose staff...</option>
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ps-start">Period Start *</Label>
                <Input id="ps-start" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ps-end">Period End *</Label>
                <Input id="ps-end" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-rate">Fallback Rate for Unrated Shifts (SGD)</Label>
              <Input id="ps-rate" type="number" min="0" step="0.01" placeholder="Only needed if a logged shift has no rate saved" value={rateOverride} onChange={(e) => setRateOverride(e.target.value)} />
              <p className="text-xs text-muted-foreground">Each shift is normally paid at the rate saved when it was logged (from the staff member&apos;s skill level). This only covers older shifts logged before that.</p>
            </div>

            {([['Allowances', allowances, setAllowances], ['Deductions', deductions, setDeductions]] as const).map(([title, rows, setter]) => (
              <div key={title} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{title}</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine(setter)}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
                {rows.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input placeholder={title === 'Allowances' ? 'e.g. Transport' : 'e.g. Unpaid leave'} value={row.label} onChange={(e) => setter((r) => r.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} />
                    <Input type="number" min="0" step="0.01" placeholder="SGD" className="w-28" value={row.amount} onChange={(e) => setter((r) => r.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(setter, idx)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            ))}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>Cancel</Button>
              <Button type="submit" disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Payslip
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
