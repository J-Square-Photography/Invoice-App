'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { UserPlus, Shield, ShieldCheck, Loader2, Trash2, Eye, EyeOff, Pencil, AlertTriangle } from 'lucide-react';
import { ResetDataDialog } from '@/components/reset-data-dialog';

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Create Form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState('MANAGER');

  // Edit Form state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('MANAGER');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch {
      toast('Failed to fetch team members', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDeleteMember(userId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently remove ${name}? This will delete their account credentials.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Removed', description: `${name} has been permanently removed.` });
        fetchUsers();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete member.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error deleting user.', variant: 'destructive' });
    }
  }

  function openEditDialog(member: TeamUser) {
    setEditingUser(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditPassword('');
    setShowEditPassword(false);
    setEditDialogOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);

    try {
      const payload: Record<string, unknown> = {
        name: editName,
        email: editEmail,
        role: editRole,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to update member.', variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: `${editName}'s profile has been updated.` });
      setEditDialogOpen(false);
      fetchUsers();
    } catch {
      toast({ title: 'Error', description: 'Network error updating user.', variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || 'Failed to create user', 'error');
        return;
      }

      toast(`${newName} has been added to the team`, 'success');
      setDialogOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowPassword(false);
      setNewRole('MANAGER');
      fetchUsers();
    } catch {
      toast('Network error', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(userId: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        toast(
          `User ${!currentStatus ? 'activated' : 'deactivated'}`,
          !currentStatus ? 'success' : 'info'
        );
        fetchUsers();
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to update user', 'error');
      }
    } catch {
      toast('Network error', 'error');
    }
  }

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

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Team Management</h1><RefreshButton onRefresh={fetchUsers} /></div>
          <p className="text-neutral-500">Manage your team members, permissions, and staff accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setResetOpen(true)}
            className="text-red-700 border-red-300 hover:bg-red-50"
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-red-600" /> Delete All Data
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Create credentials for a new team member. They will use these to sign in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Full Name</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@jsquarephotography.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="MANAGER">Manager / Finance</option>
                  <option value="SUPER_ADMIN">Developer</option>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>{users.length} member{users.length !== 1 ? 's' : ''} provisioned</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="pb-3 text-left font-medium text-neutral-500">Name</th>
                    <th className="pb-3 text-left font-medium text-neutral-500">Email</th>
                    <th className="pb-3 text-left font-medium text-neutral-500">Role</th>
                    <th className="pb-3 text-left font-medium text-neutral-500">Status</th>
                    <th className="pb-3 text-left font-medium text-neutral-500">Joined</th>
                    <th className="pb-3 text-right font-medium text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.map((member) => (
                    <tr key={member.id} className="hover:bg-neutral-50">
                      <td className="py-3 font-medium">{member.name}</td>
                      <td className="py-3 text-neutral-600">{member.email}</td>
                      <td className="py-3">
                        <Badge variant={member.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                          {member.role === 'SUPER_ADMIN' ? (
                            <><ShieldCheck className="mr-1 h-3 w-3" /> Developer</>
                          ) : (
                            <><Shield className="mr-1 h-3 w-3" /> Manager</>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={member.isActive ? 'success' : 'destructive'}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 text-neutral-600">
                        {formatDate(member.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2 text-neutral-700 hover:text-neutral-900"
                            title="Edit Member Details"
                            onClick={() => openEditDialog(member)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          {member.id !== user?.userId ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8"
                                onClick={() => toggleActive(member.id, member.isActive)}
                              >
                                {member.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Permanently Remove Member"
                                onClick={() => handleDeleteMember(member.id, member.name)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-neutral-400 italic pr-2">(You)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ResetDataDialog open={resetOpen} onOpenChange={setResetOpen} />

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update member details, assign roles, or reset login password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="jane@jsquarephotography.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                New Password <span className="text-neutral-400 font-normal text-xs">(Leave blank to keep unchanged)</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Min 8 characters to reset"
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                  title={showEditPassword ? 'Hide password' : 'Show password'}
                >
                  {showEditPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                id="edit-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                disabled={editingUser?.id === user?.userId}
              >
                <option value="MANAGER">Manager / Finance</option>
                <option value="SUPER_ADMIN">Developer</option>
              </Select>
              {editingUser?.id === user?.userId && (
                <p className="text-[11px] text-neutral-400">You cannot demote your own Developer role.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
