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
import { Plus, Loader2, Trash2, Lock, Pencil, Undo2, Receipt } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { SKILL_DISCIPLINES, isSkillDiscipline, type StaffSkill, type SkillLevel } from '@/lib/skill-levels';
import {
  skillLevelFor,
  eligibleSkillLevelsFor,
  rateForLevel,
  levelForRate,
  groupLabelFor,
  PHOTOBOOTH_DISCIPLINES,
  isPhotoboothDiscipline,
  photoboothRoleFromDiscipline,
  photoboothHourlyRateFor,
  type PhotoboothPackageTier,
} from '@/lib/staff-rate-card';
import { logCancelledAction } from '@/lib/log-cancel';

interface TimesheetItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours: string | number;
  discipline: string | null;
  hourlyRate: string | number | null;
  photoboothPackage: string | null;
  equipmentPickup: boolean;
  equipmentDropoff: boolean;
  notes: string | null;
  payslipId: string | null;
  payslip: { status: 'DRAFT' | 'PAID' } | null;
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

const EMPTY_FORM = {
  staffId: '',
  projectId: '',
  discipline: '',
  hourlyRate: '',
  skillLevel: '' as SkillLevel | '',
  photoboothPackage: '',
  equipmentPickup: false,
  equipmentDropoff: false,
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: '60',
  notes: '',
};

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
  const [editing, setEditing] = useState<TimesheetItem | null>(null);

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

  const openCreate = (prefillStaffId?: string) => {
    setEditing(null);
    setForm(prefillStaffId ? { ...EMPTY_FORM, staffId: prefillStaffId } : EMPTY_FORM);
    setShowAllProjects(false);
    if (prefillStaffId) {
      setAssignedProjectIds(null);
      fetch(`/api/staff/${prefillStaffId}`)
        .then((r) => r.json())
        .then((d) => setAssignedProjectIds(new Set((d.staff?.assignments || []).map((a: { projectId: string }) => a.projectId))))
        .catch(() => setAssignedProjectIds(new Set()));
    } else {
      setAssignedProjectIds(null);
    }
    setDialogOpen(true);
  };

  // "Log a Shift" links from the Staff tab (?logStaffId=...) land here with the dialog already open
  // and that staff member pre-selected.
  useEffect(() => {
    const logStaffId = new URLSearchParams(window.location.search).get('logStaffId');
    if (logStaffId) {
      openCreate(logStaffId);
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editing a logged shift can't move it to a different staff member or project (the pay
  // calculation and project assignment already happened at logging time) - only the shift details
  // themselves (time, discipline/package, equipment, notes) can be corrected.
  const openEdit = (t: TimesheetItem) => {
    setEditing(t);
    const editDiscipline = isSkillDiscipline(t.discipline || '') ? (t.discipline as 'Photography' | 'Videography') : null;
    const existingLevel =
      editDiscipline && t.hourlyRate != null ? levelForRate(editDiscipline, Number(t.hourlyRate)) : null;
    setForm({
      staffId: t.staff.id,
      projectId: t.project.id,
      discipline: t.discipline || '',
      hourlyRate: '',
      skillLevel: existingLevel || '',
      photoboothPackage: t.photoboothPackage || '',
      equipmentPickup: t.equipmentPickup,
      equipmentDropoff: t.equipmentDropoff,
      date: t.date.slice(0, 10),
      startTime: t.startTime,
      endTime: t.endTime,
      breakMinutes: String(t.breakMinutes),
      notes: t.notes || '',
    });
    setAssignedProjectIds(null);
    setShowAllProjects(false);
    setDialogOpen(true);
  };

  // Only worth logging when a create flow (no shift being edited) is abandoned
  const handleDismiss = (next: boolean) => {
    if (!next && editing === null) logCancelledAction('TIMESHEET', 'Cancelled logging a new shift.');
    setDialogOpen(next);
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
  const trainedLevel = selectedStaff && selectedDiscipline ? skillLevelFor(selectedStaff.skills, selectedDiscipline) : null;
  const eligibleLevels = trainedLevel ? eligibleSkillLevelsFor(trainedLevel) : [];
  const chosenLevel = (form.skillLevel && eligibleLevels.includes(form.skillLevel) ? form.skillLevel : trainedLevel) || null;
  const cardRate = selectedDiscipline && chosenLevel ? rateForLevel(selectedDiscipline, chosenLevel) : null;
  const needsManualRate = !!selectedStaff && !!selectedDiscipline && !trainedLevel;
  const isPhotobooth = isPhotoboothDiscipline(form.discipline);
  const photoboothRole = isPhotoboothDiscipline(form.discipline) ? photoboothRoleFromDiscipline(form.discipline) : null;
  const photoboothRate =
    photoboothRole && form.photoboothPackage ? photoboothHourlyRateFor(photoboothRole, form.photoboothPackage as PhotoboothPackageTier) : null;
  const visibleProjectOptions =
    assignedProjectIds && assignedProjectIds.size > 0 && !showAllProjects
      ? projectOptions.filter((p) => assignedProjectIds.has(p.id))
      : projectOptions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = editing
        ? {
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            breakMinutes: Number(form.breakMinutes) || 0,
            discipline: form.discipline,
            photoboothPackage: form.photoboothPackage || undefined,
            equipmentPickup: form.equipmentPickup,
            equipmentDropoff: form.equipmentDropoff,
            hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
            skillLevel: form.skillLevel || undefined,
            notes: form.notes,
          }
        : { ...form, breakMinutes: Number(form.breakMinutes) || 0, hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined };
      const res = await fetch(editing ? `/api/timesheets/${editing.id}` : '/api/timesheets', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (editing ? 'Failed to update shift' : 'Failed to log shift'));
      toast({ title: editing ? 'Updated' : 'Logged', description: editing ? 'Shift updated.' : `${data.timesheet.totalHours}h shift logged.` });
      setDialogOpen(false);
      fetchTimesheets(unbilledOnly);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : (editing ? 'Failed to update shift' : 'Failed to log shift'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnbill = async (t: TimesheetItem) => {
    if (!confirm(`Revert this shift for ${t.staff.name} back to unbilled so it can be edited? Its payslip will be recomputed (or removed if this was its only shift).`)) return;
    try {
      const res = await fetch(`/api/timesheets/${t.id}/unbill`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to revert shift');
      toast({ title: 'Reverted', description: 'Shift is unbilled again and can be edited.' });
      fetchTimesheets(unbilledOnly);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to revert shift', variant: 'destructive' });
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
        <Button onClick={() => openCreate()} className="flex items-center gap-2">
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
                      <div className="flex items-center gap-1">
                        {t.payslipId ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t.payslip?.status === 'PAID' ? 'Payslip is paid - revert it to Draft first' : 'Revert to unbilled so it can be edited'}
                            disabled={t.payslip?.status === 'PAID'}
                            className="disabled:text-neutral-300"
                            onClick={() => handleUnbill(t)}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Link href={`/admin/payslips?genStaffId=${t.staff.id}&genDate=${t.date.slice(0, 10)}`}>
                              <Button variant="ghost" size="icon" title="Generate Payslip">
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </Link>
                          </>
                        )}
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDismiss}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Shift' : 'Log Shift'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Correct the details of this logged shift.' : 'Record hours worked by a staff member on a specific project.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ts-staff">Staff Member *</Label>
                {editing ? (
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{editing.staff.name}</div>
                ) : (
                  <Select id="ts-staff" required value={form.staffId} onChange={(e) => handleStaffChange(e.target.value)}>
                    <option value="">Choose staff...</option>
                    {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ts-project">Project *</Label>
                  {!editing && assignedProjectIds && assignedProjectIds.size > 0 && !showAllProjects && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAllProjects(true)}>
                      Not listed? Show all projects
                    </button>
                  )}
                </div>
                {editing ? (
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{editing.project.title}</div>
                ) : (
                  <>
                    <Select id="ts-project" required value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                      <option value="">Choose project...</option>
                      {visibleProjectOptions.map((p) => <option key={p.id} value={p.id}>{p.client?.companyName} — {p.title}</option>)}
                    </Select>
                    {form.staffId && assignedProjectIds && assignedProjectIds.size === 0 && (
                      <p className="text-xs text-muted-foreground">Not yet assigned to any project — picking one here will assign them to it.</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-discipline">Discipline *</Label>
                <Select
                  id="ts-discipline"
                  required
                  value={form.discipline}
                  onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value, hourlyRate: '', skillLevel: '', photoboothPackage: '' }))}
                >
                  <option value="">Choose discipline...</option>
                  {SKILL_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                  {PHOTOBOOTH_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              {isPhotobooth ? (
                <div className="space-y-2">
                  <Label htmlFor="ts-package">Client&apos;s Package *</Label>
                  <Select
                    id="ts-package"
                    required
                    value={form.photoboothPackage}
                    onChange={(e) => setForm((f) => ({ ...f, photoboothPackage: e.target.value }))}
                  >
                    <option value="">Choose package...</option>
                    <option value="A">Package A</option>
                    <option value="BC">Package B / C</option>
                  </Select>
                  {photoboothRate != null && (
                    <p className="text-xs text-muted-foreground">${photoboothRate.toFixed(2)}/hr</p>
                  )}
                </div>
              ) : trainedLevel ? (
                <div className="space-y-2">
                  <Label htmlFor="ts-level">Bill This Shift As</Label>
                  <Select
                    id="ts-level"
                    value={chosenLevel || ''}
                    onChange={(e) => setForm((f) => ({ ...f, skillLevel: e.target.value as SkillLevel }))}
                  >
                    {eligibleLevels.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </Select>
                  {cardRate != null && selectedDiscipline && (
                    <p className="text-xs text-muted-foreground">${cardRate.toFixed(2)}/hr — {groupLabelFor(selectedDiscipline, cardRate)}</p>
                  )}
                </div>
              ) : (
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
                      Pick staff and discipline to see rate
                    </div>
                  )}
                </div>
              )}
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
            {isPhotobooth && (
              <div className="flex flex-wrap items-center gap-6 rounded-md border border-input bg-muted/20 px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={form.equipmentPickup}
                    onChange={(e) => setForm((f) => ({ ...f, equipmentPickup: e.target.checked }))}
                  />
                  Picked up equipment (+$10)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={form.equipmentDropoff}
                    onChange={(e) => setForm((f) => ({ ...f, equipmentDropoff: e.target.checked }))}
                  />
                  Dropped off equipment (+$10)
                </label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ts-notes">Notes</Label>
              <Textarea id="ts-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => handleDismiss(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? 'Save Changes' : 'Log Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
