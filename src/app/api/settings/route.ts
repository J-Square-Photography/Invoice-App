import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { getCompanySettings, toPublicPaymentConfig, SETTINGS_ROW_ID } from '@/lib/company-settings';

// A static QR is stored as a data URL. PNG or JPEG only (what the PDF generator can embed).
const STATIC_QR_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_STATIC_QR_CHARS = 1_400_000; // roughly a 1 MB image once base64-encoded

const TEXT_FIELDS: Record<string, { label: string; max: number; pattern?: RegExp; hint?: string; optional?: boolean }> = {
  companyName: { label: 'Company name', max: 100 },
  uen: { label: 'UEN', max: 10, pattern: /^[A-Za-z0-9]{8,10}$/, hint: 'A UEN is 8 to 10 letters and digits, e.g. 201912345A.' },
  bankName: { label: 'Bank name', max: 100 },
  bankAccountNumber: { label: 'Bank account number', max: 40, pattern: /^[0-9][0-9\- ]{3,39}$/, hint: 'Use digits, spaces or dashes only.' },
  bankBranchCode: { label: 'Bank branch code', max: 20 },
  bankAccountName: { label: 'Account name', max: 100 },
  gstRegNo: {
    label: 'GST registration number',
    max: 15,
    pattern: /^[A-Za-z0-9-]{8,15}$/,
    hint: 'Use 8 to 15 letters, digits or dashes, e.g. M90376150R.',
    optional: true,
  },
  address: {
    label: 'Business address',
    max: 200,
    pattern: /^[^\r\n<>]{5,200}$/,
    hint: 'Use 5 to 200 characters on a single line, e.g. 123 Example Road, #01-23, Singapore 123456.',
    optional: true,
  },
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const settings = await getCompanySettings();
  const row = await prisma.companySettings
    .findUnique({ where: { id: SETTINGS_ROW_ID }, select: { updatedAt: true, updatedBy: true } })
    .catch(() => null);

  return NextResponse.json({
    settings: toPublicPaymentConfig(settings),
    hasStaticQr: !!settings.staticQrDataUrl,
    // The image itself is only needed on the Settings page
    staticQrDataUrl: user.role === ROLES.SUPER_ADMIN ? settings.staticQrDataUrl : undefined,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden. Developer role only.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: Record<string, string | null> = {};

    for (const [key, rule] of Object.entries(TEXT_FIELDS)) {
      if (body[key] === undefined) continue;
      const value = typeof body[key] === 'string' ? body[key].trim() : '';
      if (!value) {
        // Optional fields can be cleared, which removes them from invoices
        if (rule.optional) {
          data[key] = null;
          continue;
        }
        return NextResponse.json({ error: `${rule.label} cannot be empty.` }, { status: 400 });
      }
      if (value.length > rule.max || (rule.pattern && !rule.pattern.test(value))) {
        return NextResponse.json(
          { error: `${rule.label} looks invalid. ${rule.hint ?? `Keep it under ${rule.max} characters.`}` },
          { status: 400 }
        );
      }
      data[key] = key === 'uen' ? value.toUpperCase() : value;
    }

    if (body.staticQrDataUrl !== undefined) {
      if (body.staticQrDataUrl === null) {
        data.staticQrDataUrl = null;
      } else if (
        typeof body.staticQrDataUrl !== 'string' ||
        body.staticQrDataUrl.length > MAX_STATIC_QR_CHARS ||
        !STATIC_QR_PATTERN.test(body.staticQrDataUrl)
      ) {
        return NextResponse.json(
          { error: 'The QR image must be a PNG or JPEG under 1 MB.' },
          { status: 400 }
        );
      } else {
        data.staticQrDataUrl = body.staticQrDataUrl;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const updatedBy = user.email;
    await prisma.companySettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      create: { id: SETTINGS_ROW_ID, ...data, updatedBy },
      update: { ...data, updatedBy },
    });

    console.warn(`Company settings changed by ${updatedBy}: ${Object.keys(data).join(', ')}`);

    const settings = await getCompanySettings();
    return NextResponse.json({
      settings: toPublicPaymentConfig(settings),
      hasStaticQr: !!settings.staticQrDataUrl,
      staticQrDataUrl: settings.staticQrDataUrl,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
