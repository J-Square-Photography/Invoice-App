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
import { Search, UserPlus, Loader2, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { STAFF_TYPES, STAFF_TYPE_LABELS, type StaffType } from '@/lib/staff-types';
import { formatDate } from '@/lib/utils';

interface StaffListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: StaffType;
  role: string | null;
  hourlyRate: string | number | null;
  dayRate: string | number | null;
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
  role: '',
  hourlyRate: '',
  dayRate: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  payNowNumber: '',
  notes: '',
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
    setDialogOpen(true);
  };

  const openEdit = (member: StaffListItem) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      type: member.type,
      role: member.role || '',
      hourlyRate: member.hourlyRate != null ? String(member.hourlyRate) : '',
      dayRate: member.dayRate != null ? String(member.dayRate) : '',
      bankName: member.bankName || '',
      bankAccountNumber: member.bankAccountNumber || '',
      bankAccountName: member.bankAccountName || '',
      payNowNumber: member.payNowNumber || '',
      notes: member.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        hourlyRate: form.hourlyRate.trim() === '' ? null : Number(form.hourlyRate),
        dayRate: form.dayRate.trim() === '' ? null : Number(form.dayRate),
      };
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
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rate</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">No staff found.</td></tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{member.name}</td>
                    <td className="p-4 align-middle"><Badge variant="secondary">{STAFF_TYPE_LABELS[member.type]}</Badge></td>
                    <td className="p-4 align-middle text-muted-foreground">{member.role || '-'}</td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {member.hourlyRate ? `SGD ${Number(member.hourlyRate).toFixed(2)}/hr` : member.dayRate ? `SGD ${Number(member.dayRate).toFixed(2)}/day` : '-'}
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
                <Label htmlFor="staff-name">Full Name *</Label>
                <Input id="staff-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-type">Classification</Label>
                <Select id="staff-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as StaffType }))}>
                  {STAFF_TYPES.map((t) => (
                    <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <PhoneInput id="staff-phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role / Skills</Label>
                <Input id="staff-role" placeholder="e.g. Photographer, Videographer" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
              </div>
              <div />
              <div className="space-y-2">
                <Label htmlFor="staff-hourly">Hourly Rate (SGD)</Label>
                <Input id="staff-hourly" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-day">Standard Day Rate (SGD)</Label>
                <Input id="staff-day" type="number" min="0" step="0.01" value={form.dayRate} onChange={(e) => setForm((f) => ({ ...f, dayRate: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
              <p className="text-sm font-semibold">Salary payment details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-name">Bank Name</Label>
                  <Input id="staff-bank-name" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-acc">Bank Account Number</Label>
                  <Input id="staff-bank-acc" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-bank-acc-name">Account Name</Label>
                  <Input id="staff-bank-acc-name" value={form.bankAccountName} onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-paynow">PayNow Number</Label>
                  <Input id="staff-paynow" placeholder="Mobile or UEN" value={form.payNowNumber} onChange={(e) => setForm((f) => ({ ...f, payNowNumber: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-notes">Internal Notes</Label>
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
