import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeDocumentAuditHash } from '@/lib/audit-crypto';

// A drawn signature is a small PNG/JPEG/WebP. Anything bigger is refused so a signing link can't be used to fill the database.
const SIGNATURE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_SIGNATURE_CHARS = 400_000;

class AlreadySigned extends Error {}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Signing token is required' }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { signingToken: token },
    include: {
      invoice: {
        include: {
          project: {
            include: { client: true },
          },
          items: true,
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
  });

  if (!contract) {
    return NextResponse.json({ error: 'Invalid or non-existent signing link' }, { status: 404 });
  }

  const isExpired = new Date() > new Date(contract.tokenExpiresAt);

  return NextResponse.json({
    contract: {
      id: contract.id,
      title: contract.title,
      contractBody: contract.contractBody,
      isSigned: contract.isSigned,
      signedAt: contract.signedAt,
      isExpired,
      tokenExpiresAt: contract.tokenExpiresAt,
      signatureAudit: contract.signatureAudit,
    },
    invoice: {
      id: contract.invoice.id,
      invoiceNumber: contract.invoice.invoiceNumber,
      totalAmount: contract.invoice.totalAmount,
      balanceDue: contract.invoice.balanceDue,
      dueDate: contract.invoice.dueDate,
      items: contract.invoice.items,
    },
    project: {
      title: contract.invoice.project.title,
      projectType: contract.invoice.project.projectType,
      shootDate: contract.invoice.project.shootDate,
    },
    client: {
      companyName: contract.invoice.project.client.companyName,
      contactName: contract.invoice.project.client.contactName,
      email: contract.invoice.project.client.email,
      uen: contract.invoice.project.client.uen,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, signerName, signerEmail, signatureImageBase64, intentConfirmed } = body;

    if (!token) {
      return NextResponse.json({ error: 'Signing token is required' }, { status: 400 });
    }

    if (typeof signerName !== 'string' || !signerName.trim()) {
      return NextResponse.json({ error: 'Signer full name is required' }, { status: 400 });
    }
    if (signerName.trim().length > 120) {
      return NextResponse.json({ error: 'That name is too long' }, { status: 400 });
    }
    if (signerEmail && (typeof signerEmail !== 'string' || signerEmail.trim().length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim()))) {
      return NextResponse.json({ error: 'That email address does not look right' }, { status: 400 });
    }

    if (typeof signatureImageBase64 !== 'string' || signatureImageBase64.length > MAX_SIGNATURE_CHARS || !SIGNATURE_PATTERN.test(signatureImageBase64)) {
      return NextResponse.json({ error: 'Valid signature image is required' }, { status: 400 });
    }

    if (!intentConfirmed) {
      return NextResponse.json(
        { error: 'You must confirm intent to sign under the Singapore Electronic Transactions Act' },
        { status: 400 }
      );
    }

    // Retrieve contract
    const contract = await prisma.contract.findUnique({
      where: { signingToken: token },
      include: { invoice: true },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.isSigned) {
      return NextResponse.json(
        { error: 'This contract has already been signed and sealed.' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(contract.tokenExpiresAt)) {
      return NextResponse.json(
        { error: 'This signing link has expired. Please request a new link from J Square Photography.' },
        { status: 400 }
      );
    }

    // Capture Audit Parameters
    const forwardedHeader = request.headers.get('x-forwarded-for');
    const clientIp = forwardedHeader
      ? forwardedHeader.split(',')[0].trim()
      : request.headers.get('x-real-ip') || '127.0.0.1';

    const userAgent = request.headers.get('user-agent') || 'Unknown Client Device';
    const signedUtcTimestamp = new Date();

    // Compute Cryptographic SHA-256 Checksum
    const documentSha256 = computeDocumentAuditHash({
      contractBody: contract.contractBody,
      signerName,
      signerEmail,
      signatureImageBase64,
      utcTimestamp: signedUtcTimestamp,
      clientIp,
    });

    // Execute atomic transaction: lock contract, stamp audit, update invoice
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create SignatureAudit record
      const audit = await tx.signatureAudit.create({
        data: {
          contractId: contract.id,
          signatureImageBase64,
          signerName: signerName.trim(),
          signerEmail: signerEmail?.trim() || null,
          signerIp: clientIp,
          userAgent,
          documentSha256,
          signedUtcTimestamp,
          intentConfirmed: true,
        },
      });

      // 2. Lock contract state. Only one signature can win if two arrive at the same moment.
      const locked = await tx.contract.updateMany({
        where: { id: contract.id, isSigned: false },
        data: { isSigned: true, signedAt: signedUtcTimestamp },
      });
      if (locked.count === 0) throw new AlreadySigned();
      const updatedContract = await tx.contract.findUniqueOrThrow({ where: { id: contract.id } });

      // 3. Advance invoice from DRAFT to SENT if applicable
      if (contract.invoice.status === 'DRAFT') {
        await tx.invoice.update({
          where: { id: contract.invoice.id },
          data: { status: 'SENT' },
        });
      }

      return { audit, contract: updatedContract };
    });

    return NextResponse.json({
      success: true,
      message: 'Contract successfully signed and legally sealed.',
      contractId: result.contract.id,
      documentSha256,
      signedAt: signedUtcTimestamp,
    });
  } catch (error) {
    if (error instanceof AlreadySigned || (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002')) {
      return NextResponse.json({ error: 'This contract has already been signed and sealed.' }, { status: 400 });
    }
    console.error('Sign contract error:', error);
    return NextResponse.json({ error: 'Internal server error while processing signature' }, { status: 500 });
  }
}
