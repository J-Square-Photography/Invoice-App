import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/company-settings';
import { resolveCompany } from '@/lib/payment-snapshot';
import { generateContractPDF } from '@/lib/contract-pdf-generator';

function tokensMatch(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow authenticated users OR check for client token
  const { searchParams } = new URL(request.url);
  const clientToken = searchParams.get('token');

  const user = await getCurrentUser();
  if (!user && !clientToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          project: {
            include: { client: true },
          },
        },
      },
      signatureAudit: true,
    },
  });

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  // If client access via token, verify token matches
  if (!user && clientToken && !tokensMatch(contract.signingToken, clientToken)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  try {
    const company = resolveCompany(contract.invoice, await getCompanySettings());
    const pdfBytes = await generateContractPDF({
      company,
      title: contract.title,
      contractBody: contract.contractBody,
      isSigned: contract.isSigned,
      signedAt: contract.signedAt,
      client: {
        companyName: contract.invoice.project.client.companyName,
        contactName: contract.invoice.project.client.contactName,
        email: contract.invoice.project.client.email,
        uen: contract.invoice.project.client.uen,
      },
      projectTitle: contract.invoice.project.title,
      invoiceNumber: contract.invoice.invoiceNumber,
      totalAmount: contract.invoice.totalAmount,
      signatureAudit: contract.signatureAudit,
    });

    const filename = `Contract-${contract.invoice.invoiceNumber}.pdf`;

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Contract PDF compilation error:', error);
    return NextResponse.json({ error: 'Failed to generate contract PDF' }, { status: 500 });
  }
}
