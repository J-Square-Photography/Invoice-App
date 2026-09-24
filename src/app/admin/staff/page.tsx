'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RequirePermission } from '@/components/require-permission';
import { PhoneInput } from '@/components/phone-input';
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
import { FieldTag } from '@/components/field-tag';
import { SkillTagPicker, type SkillCategoryOption } from '@/components/skill-tag-picker';
import { Search, UserPlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { STAFF_TYPES, STAFF_TYPE_LABELS, type StaffType } from '@/lib/staff-types';
import { SKILL_DISCIPLINES, SKILL_LEVELS, type StaffSkill, type ExtraSkillTag } from '@/lib/skill-levels';
import { formatDate } from '@/lib/utils';

interface StaffListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: StaffType;
  skills: StaffSkill[] | null;
  extraSkills: ExtraSkillTag[] | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  payNowNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { assignments: number; timesheets: number; payslips: number };
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  type: 'PT' as StaffType,
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  payNowNumber: '',
  notes: '',
};

// The rate-card disciplines double as built-in skill categories in the picker, alongside whatever
// custom categories (e.g. "DSLR Photobooth") admins have defined via the "+ Add skill" pill.
const BUILT_IN_CATEGORIES: SkillCategoryOption[] = SKILL_DISCIPLINES.map((d) => ({ id: d, label: d, options: [...SKILL_LEVELS] }));

const skillValuesFromMember = (member: Pick<StaffListItem, 'skills' | 'extraSkills'> | null): Record<string, string | null> => {
  const values: Record<string, string | null> = {};
  for (const s of member?.skills || []) values[s.discipline] = s.level;
  for (const s of member?.extraSkills || []) values[s.categoryId] = s.value;
  return values;
};

export default function StaffPage() {
  return (
    <RequirePermission permission="staff">
      <StaffPageInner />
    </RequirePermission>
  );
}

function StaffPageInner() {
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skillValues, setSkillValues] = useState<Record<string, string | null>>({});
  const [customCategories, setCustomCategories] = useState<SkillCategoryOption[]>([]);
  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories];

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/skill-categories');
      const data = await res.json();
      setCustomCategories((data.categories || []).map((c: { id: string; name: string; options: string[] }) => ({ id: c.id, label: c.name, options: c.options, isCustom: true })));
    } catch {
      // Non-fatal: the built-in Photography/Videography pickers still work without custom categories.
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const fetchStaff = useCallback(async (q: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/staff${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch staff');
      const data = await res.json();
      setStaff(data.staff || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load staff. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => fetchStaff(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchStaff]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSkillValues({});
    setDialogOpen(true);
  };

  const openEdit = (member: StaffListItem) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      type: member.type,
      bankName: member.bankName || '',
      bankAccountNumber: member.bankAccountNumber || '',
      bankAccountName: member.bankAccountName || '',
      payNowNumber: member.payNowNumber || '',
      notes: member.notes || '',
    });
    setSkillValues(skillValuesFromMember(member));
    setDialogOpen(true);
  };

  const handleAddCategory = async (name: string, options: string[]) => {
    const res = await fetch('/api/skill-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, options }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: 'Error', description: data.error || 'Failed to add skill category', variant: 'destructive' });
      return;
    }
    await fetchCategories();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = customCategories.find((c) => c.id === categoryId);
    if (!confirm(`Delete the "${category?.label ?? 'skill'}" skill category? It will be removed from every staff member.`)) return;
    try {
      const res = await fetch(`/api/skill-categories/${categoryId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete skill category');
      }
      setSkillValues((v) => {
        const next = { ...v };
        delete next[categoryId];
        return next;
      });
      await fetchCategories();
      toast({ title: 'Deleted', description: 'Skill category removed.' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const skills = SKILL_DISCIPLINES.filter((d) => skillValues[d]).map((d) => ({ discipline: d, level: skillValues[d] }));
      const extraSkills = customCategories.filter((c) => skillValues[c.id]).map((c) => ({ categoryId: c.id, value: skillValues[c.id] }));
      const payload = { ...form, skills, extraSkills };
      const res = await fetch(editing ? `/api/staff/${editing.id}` : '/api/staff', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save staff member');

      toast({ title: 'Success', description: editing ? 'Staff member updated' : 'Staff member added' });
      setDialogOpen(false);
      fetchStaff(search);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: StaffListItem) => {
    if (!confirm(`Permanently remove ${member.name}? This also removes their timesheets and payslip history.`)) return;
    try {
      const res = await fetch(`/api/staff/${member.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove staff member');
      }
      toast({ title: 'Removed', description: `${member.name} has been removed.` });
      fetchStaff(search);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <RefreshButton onRefresh={() => fetchStaff(search)} />
        </div>
        <div className="flex gap-2">
          <Link href="/admin/timesheets"><Button variant="outline">Timesheets</Button></Link>
          <Link href="/admin/payslips"><Button variant="outline">Payslips</Button></Link>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Staff
          </Button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search staff..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Skills</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={5} className="h-24 text-center text-muted-foreground">No staff found.</td></tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{member.name}</td>
                    <td className="p-4 align-middle"><Badge variant="secondary">{STAFF_TYPE_LABELS[member.type]}</Badge></td>
                    <td className="p-4 align-middle">
                      {(member.skills?.length || 0) + (member.extraSkills?.length || 0) > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(member.skills || []).map((s) => (
                            <Badge key={s.discipline} variant="outline" className="text-xs">{s.discipline}: {s.level}</Badge>
                          ))}
                          {(member.extraSkills || []).map((s) => (
                            <Badge key={s.categoryId} variant="outline" className="text-xs">
                              {customCategories.find((c) => c.id === s.categoryId)?.label ?? 'Skill'}: {s.value}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant={member.isActive ? 'success' : 'destructive'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(member)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Remove" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(member)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update their details, pay rate or bank/PayNow details.' : 'Add a part-timer, freelancer or full-time staff member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Full Name <FieldTag required /></Label>
                <Input id="staff-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-type">Classification <FieldTag required /></Label>
                <Select id="staff-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as StaffType }))}>
                  {STAFF_TYPES.map((t) => (
                    <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email <FieldTag /></Label>
                <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone <FieldTag /></Label>
                <PhoneInput id="staff-phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Skills <FieldTag /></Label>
              <p className="text-xs text-neutral-500">Tap a skill to set the level they've been trained to. Tap again to change it, or use Clear to remove it.</p>
              <SkillTagPicker
                categories={allCategories}
                values={skillValues}
                onChange={(categoryId, value) => setSkillValues((v) => ({ ...v, [categoryId]: value }))}
                onAddCategory={handleAddCategory}
                onDeleteCategory={handleDeleteCategory}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
              <p className="text-sm font-semibold">Salary payment details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-name">Bank Name <FieldTag /></Label>
                  <Input id="staff-bank-name" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-acc">Bank Account Number <FieldTag /></Label>
                  <Input id="staff-bank-acc" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-acc-name">Account Name <FieldTag /></Label>
                  <Input id="staff-bank-acc-name" value={form.bankAccountName} onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-paynow">PayNow Number <FieldTag /></Label>
                  <Input id="staff-paynow" placeholder="Mobile or UEN" value={form.payNowNumber} onChange={(e) => setForm((f) => ({ ...f, payNowNumber: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-notes">Internal Notes <FieldTag /></Label>
              <Textarea id="staff-notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? 'Save Changes' : 'Add Staff Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
