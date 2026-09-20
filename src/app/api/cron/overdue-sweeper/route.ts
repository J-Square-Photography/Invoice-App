import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  OverdueReport,
  OverdueInvoiceItem,
  dispatchOverdueNotifications,
  NotificationConfig,
} from '@/lib/notifications';

export async function GET(request: NextRequest) {
  return handleSweeper(request);
}

export async function POST(request: NextRequest) {
  return handleSweeper(request);
}

async function handleSweeper(request: NextRequest) {
  // 1. Authenticate: Check for Vercel CRON_SECRET or Admin Session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuthorized = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  let user = null;
  if (!isCronAuthorized) {
    user = await getCurrentUser();
  }

  if (!isCronAuthorized && !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid CRON_SECRET bearer token or admin session required' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // 2. Query overdue invoices: due_date < NOW, status != PAID/VOID, balanceDue > 0
    const rawOverdue = await prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['PAID', 'VOID'] },
        balanceDue: { gt: 0.001 },
      },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    let totalOverdueAmount = 0;
    const formattedInvoices: OverdueInvoiceItem[] = rawOverdue.map((inv) => {
      const diffTime = Math.abs(now.getTime() - new Date(inv.dueDate).getTime());
      const daysOverdue = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      totalOverdueAmount += inv.balanceDue;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        companyName: inv.project.client.companyName,
        contactName: inv.project.client.contactName,
        clientEmail: inv.project.client.email,
        projectTitle: inv.project.title,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        daysOverdue,
      };
    });

    totalOverdueAmount = Math.round(totalOverdueAmount * 100) / 100;

    const report: OverdueReport = {
      count: formattedInvoices.length,
      totalOverdueAmount,
      invoices: formattedInvoices,
      generatedAt: now,
    };

    // 3. Resolve notification channels from environment
    const config: NotificationConfig = {
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      resendApiKey: process.env.RESEND_API_KEY,
      alertEmail: process.env.ALERT_EMAIL || 'admin@jsquarephotography.com',
    };

    // 4. Dispatch internal notifications across channels
    const dispatchResults = await dispatchOverdueNotifications(report, config);

    return NextResponse.json({
      success: true,
      sweepTimestamp: now.toISOString(),
      triggeredBy: isCronAuthorized ? 'Vercel_Cron' : `Admin_${user?.name || user?.email}`,
      report: {
        overdueCount: report.count,
        totalOverdueAmount: report.totalOverdueAmount,
        invoices: report.invoices,
      },
      notificationDispatch: dispatchResults,
      configuredChannels: {
        discord: !!config.discordWebhookUrl,
        slack: !!config.slackWebhookUrl,
        email: !!(config.resendApiKey && config.alertEmail),
      },
    });
  } catch (error: any) {
    console.error('Overdue sweeper execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute overdue sweeper', details: error?.message },
      { status: 500 }
    );
  }
}
