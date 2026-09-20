'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Bell,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  ShieldAlert,
  Send,
  Loader2,
  ExternalLink,
  MessageSquare,
  Mail,
  Info,
} from 'lucide-react';

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  companyName: string;
  contactName: string;
  clientEmail: string;
  projectTitle: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string;
  daysOverdue: number;
}

interface SweeperResult {
  success: boolean;
  sweepTimestamp: string;
  triggeredBy: string;
  report: {
    overdueCount: number;
    totalOverdueAmount: number;
    invoices: OverdueInvoice[];
  };
  notificationDispatch: Record<string, { success: boolean; error?: string }>;
  configuredChannels: {
    discord: boolean;
    slack: boolean;
    email: boolean;
  };
}

export default function AlertsPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [sweeperData, setSweeperData] = useState<SweeperResult | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch current overdue status
  const runSweep = useCallback(async (isManualTrigger = false) => {
    if (isManualTrigger) setRunning(true);
    try {
      const res = await fetch('/api/cron/overdue-sweeper', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Sweeper Error', description: data.error || 'Failed to execute sweeper', variant: 'destructive' });
        return;
      }

      setSweeperData(data);
      if (isManualTrigger) {
        toast({
          title: 'Sweeper Completed',
          description: `Processed ${data.report.overdueCount} overdue invoices (SGD $${data.report.totalOverdueAmount.toFixed(2)})`,
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error executing sweeper', variant: 'destructive' });
    } finally {
      setRunning(false);
      setInitialLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    runSweep(false);
  }, [runSweep]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-red-600" /> Overdue Sweeper & Internal Alerts
          </h1>
          <p className="text-neutral-500">
            Daily automated background job querying late invoices and notifying management via Discord/Slack/Email
          </p>
        </div>

        <Button onClick={() => runSweep(true)} disabled={running} className="h-10">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Sweep...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Run Overdue Sweeper Now
            </>
          )}
        </Button>
      </div>

      {/* Schedule Banner */}
      <Card className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white border-0 shadow-md">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Automated Cron Execution Schedule
              </p>
            </div>
            <p className="text-lg font-bold">Every Day at 00:00 SGT (16:00 UTC Daily)</p>
            <p className="text-xs text-neutral-400">
              Vercel Cron Trigger: <code className="text-emerald-300 font-mono">/api/cron/overdue-sweeper</code> • Configured in <code className="text-neutral-300">vercel.json</code>
            </p>
          </div>

          <div className="shrink-0 bg-neutral-700/60 p-3 rounded-xl border border-neutral-600 text-right text-xs space-y-1">
            <p className="text-neutral-400">Last Sweep Executed:</p>
            <p className="font-mono font-bold text-white">
              {sweeperData ? new Date(sweeperData.sweepTimestamp).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Pending'}
            </p>
            <p className="text-[11px] text-neutral-400">Trigger: {sweeperData?.triggeredBy || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Strict Internal Note Alert */}
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Strictly Internal Management Alerting:</strong> The automated sweeper triggers notifications <em>exclusively</em> to internal staff channels (Discord, Slack, Management Email). In accordance with studio policy, no automated emails or payment reminders are ever dispatched directly to clients without human review.
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Overdue Invoices</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${sweeperData?.report.overdueCount ? 'text-red-500' : 'text-neutral-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${sweeperData?.report.overdueCount ? 'text-red-600' : 'text-neutral-900'}`}>
              {initialLoading ? '—' : sweeperData?.report.overdueCount ?? 0}
            </div>
            <p className="text-xs text-neutral-500">Accounts past payment due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Overdue Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {initialLoading
                ? '—'
                : `SGD $${(sweeperData?.report.totalOverdueAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <p className="text-xs text-neutral-500">Unsettled accounts receivable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Discord Alert Channel</CardTitle>
            <MessageSquare className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">
              {sweeperData?.configuredChannels.discord ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              ) : (
                <span className="text-neutral-400">DISCORD_WEBHOOK_URL unset</span>
              )}
            </div>
            <p className="text-xs text-neutral-500">Rich embed mobile notifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Slack / Email Digest</CardTitle>
            <Mail className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">
              {sweeperData?.configuredChannels.slack || sweeperData?.configuredChannels.email ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="text-neutral-400">Optional channels</span>
              )}
            </div>
            <p className="text-xs text-neutral-500">Resend / Slack Block Kit</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding Overdue Accounts</CardTitle>
          <CardDescription className="text-xs">
            Invoices where due_date &lt; NOW() and balance_due &gt; 0
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {initialLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : !sweeperData || sweeperData.report.invoices.length === 0 ? (
            <div className="text-center py-16 px-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">All accounts in good standing</h3>
              <p className="mt-1 text-sm text-neutral-500">
                No invoices have exceeded their payment due dates.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Overdue By</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sweeperData.report.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-neutral-900">
                        <Link href={`/admin/invoices/${inv.id}`} className="hover:underline text-blue-600">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-neutral-900">{inv.companyName}</p>
                        <p className="text-xs text-neutral-500">{inv.contactName} ({inv.clientEmail})</p>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-700">
                        {inv.projectTitle}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">
                        {new Date(inv.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="destructive" className="font-mono text-xs">
                          {inv.daysOverdue} day{inv.daysOverdue !== 1 ? 's' : ''} late
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-red-600">
                        SGD ${inv.balanceDue.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/admin/invoices/${inv.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            View Invoice <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Dispatch Telemetry Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-neutral-600" /> Dispatch Delivery Telemetry
          </CardTitle>
          <CardDescription className="text-xs">
            Results of the most recent notification broadcast to internal management channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-neutral-900">Discord Webhook</span>
                {sweeperData?.notificationDispatch?.discord?.success ? (
                  <Badge variant="success" className="text-[10px]">Delivered</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Idle</Badge>
                )}
              </div>
              <p className="text-neutral-500">
                {sweeperData?.notificationDispatch?.discord?.error || 'Ready for dispatch'}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-neutral-900">Slack Webhook</span>
                {sweeperData?.notificationDispatch?.slack?.success ? (
                  <Badge variant="success" className="text-[10px]">Delivered</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Idle</Badge>
                )}
              </div>
              <p className="text-neutral-500">
                {sweeperData?.notificationDispatch?.slack?.error || 'Ready for dispatch'}
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-neutral-900">Resend Email</span>
                {sweeperData?.notificationDispatch?.email?.success ? (
                  <Badge variant="success" className="text-[10px]">Delivered</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Idle</Badge>
                )}
              </div>
              <p className="text-neutral-500">
                {sweeperData?.notificationDispatch?.email?.error || 'Ready for dispatch'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
