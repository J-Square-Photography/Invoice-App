'use client';

import { useEffect, useState, useCallback } from 'react';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Loader2, Trash2, Lock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { SKILL_DISCIPLINES, isSkillDiscipline, type StaffSkill } from '@/lib/skill-levels';
import { staffHourlyRateFor, groupLabelFor } from '@/lib/staff-rate-card';

interface TimesheetItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours: string | number;
  discipline: string | null;
  hourlyRate: string | number | null;
  notes: string | null;
  payslipId: string | null;
  staff: { id: string; name: string };
  project: { id: string; title: string; client?: { companyName: string } };
}

interface StaffOption { id: string; name: string; type: string; skills: StaffSkill[] | null; }
interface ProjectOption { id: string; title: string; client: { companyName: string }; }

export default function TimesheetsPage() {
  return (
    <RequirePermission permission="staff">
      <TimesheetsPageInner />
    </RequirePermission>
  );
}

const EMPTY_FORM = { staffId: '', projectId: '', discipline: '', hourlyRate: '', date: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '17:00', breakMinutes: '60', notes: '' };

function TimesheetsPageInner() {
  const [timesheets, setTimesheets] = useState<TimesheetItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string> | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const fetchTimesheets = useCallback(async (unbilled: boolean) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/timesheets${unbilled ? '?unbilledOnly=true' : ''}`);
      if (!res.ok) throw new Error('Failed to fetch timesheets');
      const data = await res.json();
      setTimesheets(data.timesheets || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load timesheets.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTimesheets(unbilledOnly); }, [unbilledOnly, fetchTimesheets]);

  useEffect(() => {
    fetch('/api/staff?activeOnly=true').then((r) => r.json()).then((d) => setStaffOptions(d.staff || [])).catch(() => {});
    fetch('/api/projects').then((r) => r.json()).then((d) => setProjectOptions(d.projects || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setAssignedProjectIds(null);
    setShowAllProjects(false);
    setDialogOpen(true);
  };

  // Restrict the Project picker to projects this staff member is already assigned to, so a shift
  // can't accidentally get logged against the wrong job - "Show all projects" is the escape hatch
  // for a genuinely new pairing, which then assigns them to it automatically (see handleSubmit).
  const handleStaffChange = (staffId: string) => {
    setForm((f) => ({ ...f, staffId, projectId: '' }));
    setShowAllProjects(false);
    setAssignedProjectIds(null);
    if (!staffId) return;
    fetch(`/api/staff/${staffId}`)
      .then((r) => r.json())
      .then((d) => setAssignedProjectIds(new Set((d.staff?.assignments || []).map((a: { projectId: string }) => a.projectId))))
      .catch(() => setAssignedProjectIds(new Set()));
  };

  const selectedStaff = staffOptions.find((s) => s.id === form.staffId) ?? null;
  const selectedDiscipline = isSkillDiscipline(form.discipline) ? form.discipline : null;
  const cardRate = selectedStaff && selectedDiscipline ? staffHourlyRateFor(selectedStaff.skills, selectedDiscipline) : null;
  const needsManualRate = !!selectedStaff && !!selectedDiscipline && cardRate == null;
  const visibleProjectOptions =
    assignedProjectIds && assignedProjectIds.size > 0 && !showAllProjects
      ? projectOptions.filter((p) => assignedProjectIds.has(p.id))
      : projectOptions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, breakMinutes: Number(form.breakMinutes) || 0, hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to log shift');
      toast({ title: 'Logged', description: `${data.timesheet.totalHours}h shift logged.` });
      setDialogOpen(false);
      fetchTimesheets(unbilledOnly);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to log shift', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: TimesheetItem) => {
    if (!confirm(`Delete this ${t.totalHours}h shift for ${t.staff.name}?`)) return;
    try {
      const res = await fetch(`/api/timesheets/${t.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast({ title: 'Deleted', description: 'Shift removed.' });
      fetchTimesheets(unbilledOnly);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Timesheets</h1>
          <RefreshButton onRefresh={() => fetchTimesheets(unbilledOnly)} />
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Log Shift
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant={unbilledOnly ? 'default' : 'outline'} size="sm" onClick={() => setUnbilledOnly((v) => !v)}>
          {unbilledOnly ? 'Showing unbilled only' : 'Show unbilled only'}
        </Button>
      </div>

      <Card>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Staff</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Project</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Shift</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Hours</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rate</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : timesheets.length === 0 ? (
                <tr><td colSpan={8} className="h-24 text-center text-muted-foreground">No shifts logged.</td></tr>
              ) : (
                timesheets.map((t) => (
                  <tr key={t.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">{formatDate(t.date)}</td>
                    <td className="p-4 align-middle font-medium">{t.staff.name}</td>
                    <td className="p-4 align-middle text-muted-foreground">{t.project.title}</td>
                    <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">{t.startTime}{'–'}{t.endTime} ({t.breakMinutes}m break)</td>
                    <td className="p-4 align-middle font-medium">{Number(t.totalHours).toFixed(2)}h</td>
                    <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                      {t.hourlyRate != null
                        ? `$${Number(t.hourlyRate).toFixed(2)}/hr${t.discipline ? ` (${t.discipline})` : ''}`
                        : '—'}
                    </td>
                    <td className="p-4 align-middle">
                      {t.payslipId ? (
                        <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Billed</Badge>
                      ) : (
                        <Badge variant="outline">Unbilled</Badge>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t.payslipId ? 'Locked - already on a payslip' : 'Delete'}
                        disabled={!!t.payslipId}
                        className="text-red-600 hover:text-red-700 disabled:text-neutral-300"
                        onClick={() => handleDelete(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>Log Shift</DialogTitle>
            <DialogDescription>Record hours worked by a staff member on a specific project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ts-staff">Staff Member *</Label>
                <Select id="ts-staff" required value={form.staffId} onChange={(e) => handleStaffChange(e.target.value)}>
                  <option value="">Choose staff...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ts-project">Project *</Label>
                  {assignedProjectIds && assignedProjectIds.size > 0 && !showAllProjects && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAllProjects(true)}>
                      Not listed? Show all projects
                    </button>
                  )}
                </div>
                <Select id="ts-project" required value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                  <option value="">Choose project...</option>
                  {visibleProjectOptions.map((p) => <option key={p.id} value={p.id}>{p.client?.companyName} — {p.title}</option>)}
                </Select>
                {form.staffId && assignedProjectIds && assignedProjectIds.size === 0 && (
                  <p className="text-xs text-muted-foreground">Not yet assigned to any project — picking one here will assign them to it.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-discipline">Discipline *</Label>
                <Select
                  id="ts-discipline"
                  required
                  value={form.discipline}
                  onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value, hourlyRate: '' }))}
                >
                  <option value="">Choose discipline...</option>
                  {SKILL_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-rate">Hourly Rate {needsManualRate ? '*' : ''}</Label>
                {needsManualRate ? (
                  <Input
                    id="ts-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="Not trained in this discipline — enter a rate"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                  />
                ) : (
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                    {cardRate != null && selectedDiscipline
                      ? `$${cardRate.toFixed(2)}/hr — ${groupLabelFor(selectedDiscipline, cardRate)}`
                      : 'Pick staff and discipline to see rate'}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-date">Date *</Label>
                <Input id="ts-date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-break">Break (minutes)</Label>
                <Input id="ts-break" type="number" min="0" step="5" value={form.breakMinutes} onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-start">Start Time *</Label>
                <Input id="ts-start" type="time" required value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-end">End Time *</Label>
                <Input id="ts-end" type="time" required value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ts-notes">Notes</Label>
              <Textarea id="ts-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Log Shift
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
