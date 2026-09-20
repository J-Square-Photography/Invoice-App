export interface OverdueInvoiceItem {
  id: string;
  invoiceNumber: string;
  companyName: string;
  contactName: string;
  clientEmail: string;
  projectTitle: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: Date;
  daysOverdue: number;
}

export interface OverdueReport {
  count: number;
  totalOverdueAmount: number;
  invoices: OverdueInvoiceItem[];
  generatedAt: Date;
}

export interface NotificationConfig {
  discordWebhookUrl?: string | null;
  slackWebhookUrl?: string | null;
  resendApiKey?: string | null;
  alertEmail?: string | null;
}

/**
 * Dispatches a formatted Discord Embed alert to the internal team channel.
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  report: OverdueReport
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl) return { success: false, error: 'No Discord webhook URL configured' };

    const fields = report.invoices.slice(0, 10).map((inv) => ({
      name: `📄 ${inv.invoiceNumber} — ${inv.companyName}`,
      value: [
        `**Project:** ${inv.projectTitle}`,
        `**Contact:** ${inv.contactName} (${inv.clientEmail})`,
        `**Overdue Balance:** SGD $${inv.balanceDue.toFixed(2)} (${inv.daysOverdue} day${inv.daysOverdue !== 1 ? 's' : ''} late)`,
        `**Due Date:** ${new Date(inv.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}`,
      ].join('\n'),
      inline: false,
    }));

    if (report.invoices.length > 10) {
      fields.push({
        name: `... and ${report.invoices.length - 10} more overdue invoices`,
        value: 'Please log in to the CRM dashboard to review all pending accounts.',
        inline: false,
      });
    }

    const payload = {
      username: 'J Square Alert Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
      embeds: [
        {
          title: `🚨 Internal Alert: ${report.count} Overdue Invoice${report.count !== 1 ? 's' : ''}`,
          description: `Daily 00:00 SGT automated sweep detected **SGD $${report.totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** in outstanding overdue invoices requiring team follow-up.\n\n*(Note: No automated emails were sent to clients.)*`,
          color: 0xe02424, // Red
          fields,
          footer: {
            text: `J Square Photography Internal Sweeper • ${new Date().toLocaleDateString('en-SG')}`,
          },
          timestamp: report.generatedAt.toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Discord HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send Discord alert' };
  }
}

/**
 * Dispatches a formatted Slack Block Kit alert to the internal team channel.
 */
export async function sendSlackAlert(
  webhookUrl: string,
  report: OverdueReport
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl) return { success: false, error: 'No Slack webhook URL configured' };

    const invoiceLines = report.invoices.slice(0, 8).map(
      (inv) => `• *${inv.invoiceNumber}* - ${inv.companyName} | *SGD $${inv.balanceDue.toFixed(2)}* (${inv.daysOverdue} days late, Due: ${new Date(inv.dueDate).toLocaleDateString('en-SG')})`
    );

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 Overdue Invoices Alert: ${report.count} Accounts Pending`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Daily 00:00 SGT automated sweep detected *SGD $${report.totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}* in unpaid overdue accounts.\n\n${invoiceLines.join('\n')}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `J Square Photography Internal Sweeper | Strictly Internal Alert (No client emails sent)`,
          },
        ],
      },
    ];

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Slack HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send Slack alert' };
  }
}

/**
 * Dispatches an internal management digest email via Resend (Free Tier).
 */
export async function sendEmailAlert(
  apiKey: string,
  recipientEmail: string,
  report: OverdueReport
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey || !recipientEmail) {
      return { success: false, error: 'Resend API key or recipient email not configured' };
    }

    const tableRows = report.invoices.map(
      (inv) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-family: monospace; font-weight: bold;">${inv.invoiceNumber}</td>
        <td style="padding: 10px;">${inv.companyName}<br/><span style="color: #6b7280; font-size: 12px;">${inv.contactName} (${inv.clientEmail})</span></td>
        <td style="padding: 10px;">${inv.projectTitle}</td>
        <td style="padding: 10px; color: #dc2626; font-weight: bold;">SGD $${inv.balanceDue.toFixed(2)}</td>
        <td style="padding: 10px; color: #b91c1c;">${inv.daysOverdue} days</td>
      </tr>
    `
    ).join('');

    const html = `
      <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #991b1b;">🚨 J Square Photography — Overdue Invoices Alert</h2>
        <p>Daily 00:00 SGT automated sweep detected <strong>${report.count}</strong> overdue invoices totaling <strong>SGD $${report.totalOverdueAmount.toFixed(2)}</strong>.</p>
        <p style="font-size: 13px; color: #4b5563;"><em>Strictly internal management alert. No automated emails have been sent to clients.</em></p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th style="padding: 10px;">Invoice #</th>
              <th style="padding: 10px;">Client</th>
              <th style="padding: 10px;">Project</th>
              <th style="padding: 10px;">Balance Due</th>
              <th style="padding: 10px;">Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p style="margin-top: 25px; font-size: 12px; color: #9ca3af;">
          Generated automatically by J Square Photography CRM at ${report.generatedAt.toUTCString()}.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'J Square CRM <alerts@jsquarephotography.com>',
        to: [recipientEmail],
        subject: `[ACTION REQUIRED] ${report.count} Overdue Invoices (SGD $${report.totalOverdueAmount.toFixed(2)})`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send email alert' };
  }
}

/**
 * Master dispatcher: sends alerts to all configured internal notification channels.
 */
export async function dispatchOverdueNotifications(
  report: OverdueReport,
  config: NotificationConfig
): Promise<Record<string, { success: boolean; error?: string }>> {
  const results: Record<string, { success: boolean; error?: string }> = {};

  if (report.count === 0) {
    return { status: { success: true, error: 'No overdue invoices detected' } };
  }

  // 1. Discord Webhook
  if (config.discordWebhookUrl) {
    results.discord = await sendDiscordAlert(config.discordWebhookUrl, report);
  } else {
    results.discord = { success: false, error: 'Not configured' };
  }

  // 2. Slack Webhook
  if (config.slackWebhookUrl) {
    results.slack = await sendSlackAlert(config.slackWebhookUrl, report);
  } else {
    results.slack = { success: false, error: 'Not configured' };
  }

  // 3. Resend Email
  if (config.resendApiKey && config.alertEmail) {
    results.email = await sendEmailAlert(config.resendApiKey, config.alertEmail, report);
  } else {
    results.email = { success: false, error: 'Not configured' };
  }

  return results;
}
