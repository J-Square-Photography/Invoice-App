'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RequirePermission } from '@/components/require-permission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Download, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { STAFF_TYPE_LABELS, type StaffType } from '@/lib/staff-types';

interface PayGroupBreakdown {
  group: string;
  hourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  basicPay: number;
  overtimePay: number;
}

interface LineItem { label: string; amount: number }

interface PayslipDetail {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalHours: string | number;
  overtimeHours: string | number;
  hourlyRate: string | number;
  basicPay: string | number;
  overtimePay: string | number;
  payBreakdown: PayGroupBreakdown[] | null;
  allowances: LineItem[] | null;
  deductions: LineItem[] | null;
  netPay: string | number;
  status: 'DRAFT' | 'PAID';
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  staff: {
    id: string;
    name: string;
    type: StaffType;
    email: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    payNowNumber: string | null;
  };
  timesheets: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    totalHours: string | number;
    discipline: string | null;
    hourlyRate: string | number | null;
    equipmentPickup: boolean;
    equipmentDropoff: boolean;
    project: { title: string };
  }>;
}

const money = (n: string | number) => `SGD ${Number(n).toFixed(2)}`;

export default function PayslipDetailPage() {
  return (
    <RequirePermission permission="staff">
      <PayslipDetailPageInner />
    </RequirePermission>
  );
}

function PayslipDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchPayslip = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/payslips/${id}`);
      if (!res.ok) throw new Error('Failed to load payslip');
      const data = await res.json();
      setPayslip(data.payslip);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payslip.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchPayslip(); }, [fetchPayslip]);

  const markPaid = async () => {
    if (!payslip || !confirm(`Mark this payslip for ${payslip.staff.name} as paid? This locks it.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payslips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Updated', description: 'Payslip marked as paid.' });
      fetchPayslip();
    } catch {
      toast({ title: 'Error', description: 'Failed to update payslip', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!payslip || !confirm('Delete this draft payslip? Its shifts will become unbilled again.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payslips/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast({ title: 'Deleted', description: 'Payslip removed.' });
      router.push('/admin/payslips');
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!payslip) {
    return <div className="text-center text-muted-foreground py-12">Payslip not found.</div>;
  }

  const grossPay = Number(payslip.basicPay) + Number(payslip.overtimePay) + (payslip.allowances || []).reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/payslips"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{payslip.staff.name}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(payslip.periodStart)} – {formatDate(payslip.periodEnd)}</p>
          </div>
          <Badge variant={payslip.status === 'PAID' ? 'success' : 'secondary'}>{payslip.status === 'PAID' ? 'Paid' : 'Draft'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open(`/api/payslips/${id}/pdf`, '_blank')}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          {payslip.status === 'DRAFT' && (
            <>
              <Button onClick={markPaid} disabled={busy}><CheckCircle className="mr-2 h-4 w-4" /> Mark Paid</Button>
              <Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Hours Worked</CardTitle></CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b">
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Description</th>
                      <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Hours</th>
                      <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Rate</th>
                      <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payslip.payBreakdown || []).flatMap((group) => {
                      const rows = [];
                      if (group.regularHours > 0) {
                        rows.push(
                          <tr key={`${group.group}-reg`} className="border-b">
                            <td className="p-2">Basic Pay – {group.group}</td>
                            <td className="p-2 text-right">{group.regularHours.toFixed(2)}h</td>
                            <td className="p-2 text-right">{money(group.hourlyRate)}</td>
                            <td className="p-2 text-right font-medium">{money(group.basicPay)}</td>
                          </tr>
                        );
                      }
                      if (group.overtimeHours > 0) {
                        rows.push(
                          <tr key={`${group.group}-ot`} className="border-b">
                            <td className="p-2">Overtime Pay – {group.group}</td>
                            <td className="p-2 text-right">{group.overtimeHours.toFixed(2)}h</td>
                            <td className="p-2 text-right">{money(group.hourlyRate * 1.5)}</td>
                            <td className="p-2 text-right font-medium">{money(group.overtimePay)}</td>
                          </tr>
                        );
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Logged Shifts ({payslip.timesheets.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b">
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Date</th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Project</th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Shift</th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Discipline</th>
                      <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslip.timesheets.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="p-2 whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="p-2 text-muted-foreground">{t.project.title}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{t.startTime}–{t.endTime}</td>
                        <td className="p-2 text-muted-foreground">
                          {t.discipline || '—'}
                          {(t.equipmentPickup || t.equipmentDropoff) && (
                            <span className="ml-1 text-xs text-amber-600">
                              ({[t.equipmentPickup && 'pickup', t.equipmentDropoff && 'drop-off'].filter(Boolean).join(', ')})
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right">{Number(t.totalHours).toFixed(2)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Employee</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{payslip.staff.name}</p>
              <p className="text-muted-foreground">{STAFF_TYPE_LABELS[payslip.staff.type]}</p>
              {payslip.staff.email && <p className="text-muted-foreground">{payslip.staff.email}</p>}
              {payslip.staff.bankName && payslip.staff.bankAccountNumber ? (
                <p className="text-muted-foreground">Bank: {payslip.staff.bankName} {payslip.staff.bankAccountNumber}</p>
              ) : payslip.staff.payNowNumber ? (
                <p className="text-muted-foreground">PayNow: {payslip.staff.payNowNumber}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Basic Pay</span><span>{money(payslip.basicPay)}</span></div>
              {Number(payslip.overtimePay) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Overtime Pay</span><span>{money(payslip.overtimePay)}</span></div>
              )}
              {(payslip.allowances || []).map((a, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted-foreground">{a.label}</span><span>{money(a.amount)}</span></div>
              ))}
              <div className="flex justify-between border-t pt-2 font-medium"><span>Gross Pay</span><span>{money(grossPay)}</span></div>
              {(payslip.deductions || []).map((d, i) => (
                <div key={i} className="flex justify-between text-red-600"><span>{d.label}</span><span>-{money(d.amount)}</span></div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Net Pay</span><span>{money(payslip.netPay)}</span></div>
              {payslip.status === 'PAID' && payslip.paidAt && (
                <p className="pt-1 text-xs text-muted-foreground">Paid on {formatDate(payslip.paidAt)}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
