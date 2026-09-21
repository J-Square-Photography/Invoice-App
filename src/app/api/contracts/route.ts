import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';
import { makeSnapshot, parseSnapshot, resolveCompany, snapshotForDb } from '@/lib/payment-snapshot';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateSigningToken } from '@/lib/audit-crypto';
import { CONTRACT_TEMPLATES, renderContractTemplate } from '@/lib/contract-templates';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const signed = searchParams.get('signed');

  const where: Record<string, unknown> = {};
  if (signed === 'true') where.isSigned = true;
  if (signed === 'false') where.isSigned = false;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      { invoice: { project: { title: { contains: q, mode: 'insensitive' } } } },
      { invoice: { project: { client: { companyName: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      invoice: {
        include: {
          project: {
            include: { client: true },
          },
        },
      },
      signatureAudit: {
        select: {
          signerName: true,
          signerEmail: true,
          signedUtcTimestamp: true,
          documentSha256: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ contracts, templates: CONTRACT_TEMPLATES });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      invoiceId,
      title,
      contractBody,
      templateId,
      expiresInDays = 30,
    } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Check if contract already exists for this invoice
    const existing = await prisma.contract.findUnique({
      where: { invoiceId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A contract already exists for this invoice. View or manage the existing contract.' },
        { status: 409 }
      );
    }

    // Retrieve invoice and project details for token substitution
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        project: {
          include: { client: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    let finalBody = contractBody;
    let finalTitle = title;

    // If a template was selected and no custom body provided, render template
    if (templateId && !finalBody) {
      const tmpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId) || CONTRACT_TEMPLATES[0];
      finalTitle = finalTitle || tmpl.defaultTitle;
      const depositAmount = (invoice.totalAmount * 0.5).toFixed(2);
      const balanceDue = (invoice.totalAmount - parseFloat(depositAmount)).toFixed(2);

      const company = resolveCompany(invoice, await getCompanySettings());
      finalBody = renderContractTemplate(tmpl.body, {
        company_uen: company.uen,
        studio_name: company.companyName.toUpperCase(),
        company_name: invoice.project.client.companyName,
        client_name: invoice.project.client.contactName,
        project_title: invoice.project.title,
        shoot_date: invoice.project.shootDate
          ? new Date(invoice.project.shootDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'To be scheduled',
        total_amount: invoice.totalAmount.toFixed(2),
        deposit_amount: depositAmount,
        balance_due: balanceDue,
        due_date: new Date(invoice.dueDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }),
      });
    }

    if (!finalBody) {
      return NextResponse.json({ error: 'Contract body cannot be empty' }, { status: 400 });
    }

    // Creating a contract freezes the invoice's payment details (if not already frozen)
    if (!parseSnapshot(invoice.paymentSnapshot)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentSnapshot: snapshotForDb(makeSnapshot(await getCompanySettings(), invoice.paymentMethod)) },
      });
    }

    const signingToken = generateSigningToken();
    const tokenExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const contract = await prisma.contract.create({
      data: {
        invoiceId,
        title: finalTitle || 'Client Photography Agreement',
        contractBody: finalBody,
        signingToken,
        tokenExpiresAt,
        isSigned: false,
      },
      include: {
        invoice: {
          include: {
            project: {
              include: { client: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    console.error('Create contract error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
