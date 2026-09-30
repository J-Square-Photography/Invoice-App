import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { getCompanySettings } from '@/lib/company-settings';
import { resolveCompany } from '@/lib/payment-snapshot';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow authenticated users OR check for public download token if needed
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: {
        include: { client: true },
      },
      items: true,
      paymentLogs: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  try {
    const company = resolveCompany(invoice, await getCompanySettings());
    const pdfBytes = await generateInvoicePDF({
      company,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paymentMethod: invoice.paymentMethod,
      subtotal: invoice.subtotal,
      discounts: Array.isArray(invoice.discounts)
        ? (invoice.discounts as unknown as Array<{ name: string; type: string; value: number; amount: number }>)
        : [],
      discountAmount: invoice.discountAmount,
      depositAmount: Number(invoice.depositAmount ?? 0),
      isGstApplied: invoice.isGstApplied,
      gstRate: invoice.gstRate,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balanceDue: invoice.balanceDue,
      notes: invoice.notes,
      client: {
        companyName: invoice.project.client.companyName,
        contactName: invoice.project.client.contactName,
        email: invoice.project.client.email,
        phone: invoice.project.client.phone,
        uen: invoice.project.client.uen,
        address: invoice.project.client.address,
      },
      projectTitle: invoice.project.title,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    });

    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to compile invoice PDF' },
      { status: 500 }
    );
  }
}
