import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { project: { include: { client: true } }, items: true },
  });
  if (!quote) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });

  try {
    const company = await getCompanySettings();
    const pdfBytes = await generateInvoicePDF({
      documentType: 'QUOTE',
      company,
      invoiceNumber: quote.quoteNumber,
      issueDate: quote.issueDate,
      dueDate: quote.validUntil,
      status: quote.status,
      paymentMethod: null,
      subtotal: quote.subtotal,
      discounts: Array.isArray(quote.discounts)
        ? (quote.discounts as unknown as Array<{ name: string; type: string; value: number; amount: number }>)
        : [],
      discountAmount: quote.discountAmount,
      depositAmount: Number(quote.depositAmount ?? 0),
      isGstApplied: quote.isGstApplied,
      gstRate: quote.gstRate,
      gstAmount: quote.gstAmount,
      totalAmount: quote.totalAmount,
      paidAmount: 0,
      balanceDue: quote.totalAmount,
      notes: quote.notes,
      client: {
        companyName: quote.project.client.companyName,
        contactName: quote.project.client.contactName,
        email: quote.project.client.email,
        phone: quote.project.client.phone,
        uen: quote.project.client.uen,
        address: quote.project.client.address,
      },
      projectTitle: quote.project.title,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    });

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Quotation-${quote.quoteNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Quotation PDF error:', error);
    return NextResponse.json({ error: 'Failed to compile quotation PDF' }, { status: 500 });
  }
}
