import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/refresh-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { Users, FolderKanban, FileText, DollarSign, ArrowRight, Plus, Building2 } from 'lucide-react';
import { PROJECT_TYPE_LABELS, INVOICE_STATUS_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let clientCount = 0;
  let activeProjectCount = 0;
  let pendingInvoiceCount = 0;
  let totalCollected = 0;
  let recentProjects: any[] = [];
  let recentClients: any[] = [];
  let recentInvoices: any[] = [];
  let loadFailed = false;

  try {
    const [
      cCount,
      pCount,
      iCount,
      totalPaidResult,
      rProjects,
      rClients,
      rInvoices,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.project.count({
        where: { pipelineStatus: { not: 'CLOSED' } },
      }),
      prisma.invoice.count({
        where: { status: { in: ['SENT', 'PARTIAL', 'DRAFT'] } },
      }),
      prisma.invoice.aggregate({
        where: { status: { not: 'VOID' } },
        _sum: { paidAmount: true },
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

    clientCount = cCount;
    activeProjectCount = pCount;
    pendingInvoiceCount = iCount;
    totalCollected = Number(totalPaidResult._sum.paidAmount ?? 0);
    recentProjects = rProjects;
    recentClients = rClients;
    recentInvoices = rInvoices;
  } catch (err) {
    loadFailed = true;
    console.error('Failed to load dashboard metrics:', err);
  }

  const stats = [
    { name: 'Total Clients', value: clientCount.toString(), icon: Users, description: 'Active client records', href: '/admin/clients' },
    { name: 'Active Projects', value: activeProjectCount.toString(), icon: FolderKanban, description: 'Projects in pipeline', href: '/admin/projects' },
    { name: 'Pending Invoices', value: pendingInvoiceCount.toString(), icon: FileText, description: 'Awaiting client settlement', href: '/admin/invoices' },
    { name: 'Collected Revenue', value: `SGD $${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, description: 'Total payments to date', href: '/admin/invoices' },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-neutral-500">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
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
