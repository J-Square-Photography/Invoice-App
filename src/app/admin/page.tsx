import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { FolderKanban, FileText, DollarSign, ArrowRight, Plus, Building2, AlertCircle, CalendarDays, Wallet } from 'lucide-react';
import { PROJECT_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/lib/constants';
import { getCompanySettings } from '@/lib/company-settings';
import { usesSamplePaymentDetails } from '@/lib/payment-config';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { startOfSingaporeDay, startOfSingaporeMonth, startOfSingaporeYear } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let activeProjectCount = 0;
  let outstanding = { amount: 0, count: 0 };
  let overdue = { amount: 0, count: 0 };
  let collected = { month: 0, year: 0, total: 0 };
  let overdueInvoices: any[] = [];
  let upcomingShoots: any[] = [];
  let openQuotes: any[] = [];
  let unverifiedPayments = 0;
  let usingSampleDetails = false;
  let canOpenSettings = false;
  try {
    usingSampleDetails = usesSamplePaymentDetails(await getCompanySettings());
    canOpenSettings = hasPermission(await getCurrentUser(), 'settings');
  } catch {
    // the dashboard still loads without this notice
  }
  let recentProjects: any[] = [];
  let recentClients: any[] = [];
  let recentInvoices: any[] = [];
  let loadFailed = false;

  try {
    // "Today", "this month" and "this year" start at midnight Singapore time, whatever the server's clock says
    const startOfMonth = startOfSingaporeMonth();
    const startOfYear = startOfSingaporeYear();
    const startOfToday = startOfSingaporeDay();
    // Only invoices that have actually been issued and still owe money count as outstanding
    const owing = { status: { in: ['SENT', 'PARTIAL'] } };
    const [
      pCount,
      outstandingResult,
      overdueResult,
      monthPaid,
      yearPaid,
      totalPaidResult,
      overdueList,
      shootList,
      unverifiedCount,
      quoteList,
      rProjects,
      rClients,
      rInvoices,
    ] = await Promise.all([
      prisma.project.count({
        where: { pipelineStatus: { not: 'CLOSED' } },
      }),
      prisma.invoice.aggregate({ where: owing, _sum: { balanceDue: true }, _count: true }),
      prisma.invoice.aggregate({ where: { ...owing, dueDate: { lt: startOfToday } }, _sum: { balanceDue: true }, _count: true }),
      prisma.paymentLog.aggregate({ where: { paymentDate: { gte: startOfMonth }, invoice: { status: { not: 'VOID' } } }, _sum: { amountPaid: true } }),
      prisma.paymentLog.aggregate({ where: { paymentDate: { gte: startOfYear }, invoice: { status: { not: 'VOID' } } }, _sum: { amountPaid: true } }),
      prisma.invoice.aggregate({
        where: { status: { not: 'VOID' } },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.findMany({
        where: { ...owing, dueDate: { lt: startOfToday } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: { project: { include: { client: { select: { companyName: true } } } } },
      }),
      prisma.project.findMany({
        where: { shootDate: { gte: startOfToday }, pipelineStatus: { not: 'CLOSED' } },
        orderBy: { shootDate: 'asc' },
        take: 5,
        include: { client: { select: { companyName: true } } },
      }),
      // Payments recorded but not yet checked against the bank
      prisma.paymentLog.count({ where: { verifiedAt: null, invoice: { status: { not: 'VOID' } } } }),
      // Quotations sent and still waiting for a yes or no (soonest to expire first)
      prisma.quote.findMany({
        where: { status: 'SENT' },
        orderBy: { validUntil: 'asc' },
        take: 5,
        include: { project: { include: { client: { select: { companyName: true } } } } },
      }),
      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, companyName: true } },
        },
      }),
      prisma.client.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { projects: true } },
        },
      }),
      prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            include: {
              client: { select: { companyName: true } },
            },
          },
        },
      }),
    ]);

    activeProjectCount = pCount;
    outstanding = { amount: Number(outstandingResult._sum.balanceDue ?? 0), count: outstandingResult._count };
    overdue = { amount: Number(overdueResult._sum.balanceDue ?? 0), count: overdueResult._count };
    collected = {
      month: Number(monthPaid._sum.amountPaid ?? 0),
      year: Number(yearPaid._sum.amountPaid ?? 0),
      total: Number(totalPaidResult._sum.paidAmount ?? 0),
    };
    overdueInvoices = overdueList;
    upcomingShoots = shootList;
    openQuotes = quoteList;
    unverifiedPayments = unverifiedCount;
    recentProjects = rProjects;
    recentClients = rClients;
    recentInvoices = rInvoices;
  } catch (err) {
    loadFailed = true;
    console.error('Failed to load dashboard metrics:', err);
  }

  const money = (n: number) => `SGD $${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  const startOfToday = startOfSingaporeDay();
  const daysBetween = (a: Date | string, b: Date) => Math.round((new Date(a).getTime() - b.getTime()) / 86400000);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const stats = [
    { name: 'Outstanding', value: money(outstanding.amount), icon: Wallet, description: `${plural(outstanding.count, 'sent invoice')} awaiting payment`, href: '/admin/invoices', tone: 'text-amber-600' },
    { name: 'Overdue', value: money(overdue.amount), icon: AlertCircle, description: overdue.count > 0 ? `${plural(overdue.count, 'invoice')} past due date` : 'Nothing overdue', href: '/admin/invoices?status=OVERDUE', tone: overdue.count > 0 ? 'text-red-600' : '' },
    { name: 'Collected This Month', value: money(collected.month), icon: DollarSign, description: `This year ${money(collected.year)} · All time ${money(collected.total)}`, href: '/admin/invoices', tone: 'text-emerald-600' },
    { name: 'Active Projects', value: activeProjectCount.toString(), icon: FolderKanban, description: 'Not yet closed', href: '/admin/projects', tone: '' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INQUIRY': return <Badge variant="secondary">Inquiry</Badge>;
      case 'QUOTED': return <Badge variant="outline">Quoted</Badge>;
      case 'BOOKED': return <Badge variant="default">Booked</Badge>;
      case 'IN_PROGRESS': return <Badge variant="warning">In Progress</Badge>;
      case 'DELIVERED': return <Badge variant="success">Delivered</Badge>;
      case 'CLOSED': return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInvoiceBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
      case 'SENT': return <Badge variant="outline">Sent</Badge>;
      case 'PARTIAL': return <Badge variant="warning">Partial</Badge>;
      case 'PAID': return <Badge variant="success">Paid</Badge>;
      case 'VOID': return <Badge variant="secondary">Void</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Dashboard</h1><RefreshButton /></div>
          <p className="text-neutral-500">Welcome to J Square Photography CRM</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/clients">
            <Button variant="outline" size="sm">
              <Building2 className="mr-1.5 h-4 w-4" /> Clients
            </Button>
          </Link>
          <Link href="/admin/projects">
            <Button variant="outline" size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> New Project
            </Button>
          </Link>
          <Link href="/admin/invoices">
            <Button size="sm">
              <FileText className="mr-1.5 h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Couldn&apos;t load the latest data, so the numbers below may be out of date. Refresh the page to try again.
        </div>
      )}

      {usingSampleDetails && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>Set your real company details before sending any invoice.</strong> The UEN and bank account are still the built-in
          samples, so invoices and PayNow QR codes would point clients to the wrong account. Invoices can&apos;t be marked Sent until this is fixed.{' '}
          {canOpenSettings ? (
            <Link href="/admin/settings" className="font-semibold underline">Open Settings →</Link>
          ) : (
            'Ask a Developer to fill in Settings.'
          )}
        </div>
      )}

      {unverifiedPayments > 0 && (
        <Link href="/admin/payments?status=unverified" className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100 transition-colors">
          <strong>{unverifiedPayments}</strong> payment{unverifiedPayments === 1 ? ' is' : 's are'} waiting to be checked against the bank. Open Payments to verify {unverifiedPayments === 1 ? 'it' : 'them'} →
        </Link>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card className="hover:border-neutral-400 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">
                  {stat.name}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className={`text-lg sm:text-2xl font-bold ${stat.tone}`}>{stat.value}</div>
                <p className="text-xs text-neutral-500">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Needs attention */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Quotes Awaiting Reply</CardTitle>
              <CardDescription className="text-xs">Sent, no answer yet</CardDescription>
            </div>
            <Link href="/admin/quotes" className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {openQuotes.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No quotations waiting for a reply.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {openQuotes.map((q) => {
                  const left = daysBetween(q.validUntil, startOfToday);
                  return (
                    <Link key={q.id} href={`/admin/quotes/${q.id}`} className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{q.project?.client?.companyName || 'General Client'}</p>
                        <p className="text-xs text-neutral-500 truncate">{q.quoteNumber} · {q.project?.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-neutral-900">SGD ${Number(q.totalAmount).toFixed(2)}</p>
                        <p className={`text-xs ${left < 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                          {left < 0 ? 'Expired' : left === 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Overdue Invoices</CardTitle>
              <CardDescription className="text-xs">Oldest first, worth chasing</CardDescription>
            </div>
            <Link href="/admin/invoices?status=OVERDUE" className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">Nothing overdue.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {overdueInvoices.map((inv) => {
                  const late = Math.abs(daysBetween(inv.dueDate, startOfToday));
                  return (
                    <Link key={inv.id} href={`/admin/invoices/${inv.id}`} className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{inv.project?.client?.companyName || 'General Client'}</p>
                        <p className="text-xs text-neutral-500 truncate">{inv.invoiceNumber} · due {fmtDate(inv.dueDate)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-red-600">SGD ${Number(inv.balanceDue).toFixed(2)}</p>
                        <p className="text-xs text-neutral-500">{late} day{late === 1 ? '' : 's'} late</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Upcoming Shoots</CardTitle>
              <CardDescription className="text-xs">Next events on the calendar</CardDescription>
            </div>
            <CalendarDays className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            {upcomingShoots.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No upcoming shoots. Add a shoot date to a project.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {upcomingShoots.map((p) => {
                  const d = daysBetween(p.shootDate, startOfToday);
                  return (
                    <Link key={p.id} href={`/admin/projects/${p.id}`} className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{p.title}</p>
                        <p className="text-xs text-neutral-500 truncate">{p.client?.companyName || 'General Client'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-neutral-900">{fmtDate(p.shootDate)}</p>
                        <p className="text-xs text-neutral-500">{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <CardDescription className="text-xs">Assignments in pipeline</CardDescription>
            </div>
            <Link href="/admin/projects" className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No projects created yet.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/admin/projects/${project.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-neutral-900 truncate">{project.title}</p>
                      <p className="text-xs text-neutral-500 truncate">{project.client?.companyName || 'General Client'}</p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(project.pipelineStatus)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <CardDescription className="text-xs">Latest billing activities</CardDescription>
            </div>
            <Link href="/admin/invoices" className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No invoices drafted yet.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recentInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/admin/invoices/${inv.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-neutral-900 font-mono truncate">{inv.invoiceNumber}</p>
                      <p className="text-xs text-neutral-500 truncate">{inv.project?.client?.companyName || 'General Client'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-neutral-900">SGD ${(inv.totalAmount || 0).toFixed(2)}</p>
                      <div className="mt-0.5">{getInvoiceBadge(inv.status)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Clients</CardTitle>
              <CardDescription className="text-xs">Newest client directory</CardDescription>
            </div>
            <Link href="/admin/clients" className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No clients added yet.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recentClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/admin/clients/${client.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-neutral-50 rounded-md px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-neutral-900 truncate">{client.companyName}</p>
                      <p className="text-xs text-neutral-500 truncate">{client.contactName}</p>
                    </div>
                    <span className="text-xs text-neutral-500 shrink-0">
                      {client._count.projects} project{client._count.projects !== 1 ? 's' : ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
