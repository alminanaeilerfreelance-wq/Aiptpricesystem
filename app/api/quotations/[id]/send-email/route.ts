import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import { getUserFromRequest } from '@/lib/auth';
import { sendMail } from '@/lib/mailer';

interface RouteContext {
  params: { id: string };
}

function buildQuotationEmailHtml(quotation: {
  quotationNo: string;
  clientName: string;
  clientEmail?: string;
  clientType?: string;
  service: string;
  procedure: string;
  country: string;
  numberOfClasses: number;
  fees: {
    governmentFee: number;
    serviceFee: number;
    classFee: number;
    procedureFee: number;
  };
  multiplier: number;
  subtotal: number;
  total: number;
  currency: string;
  status: string;
  validDays: number;
  notes?: string;
  createdAt: Date;
}): string {
  const issueDate = new Date(quotation.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const expiryDate = new Date(
    new Date(quotation.createdAt).getTime() + quotation.validDays * 24 * 60 * 60 * 1000
  ).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatCurrency = (amount: number) =>
    `${quotation.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const feeRows = [
    { label: 'Government Fee', amount: quotation.fees.governmentFee },
    { label: 'Service Fee', amount: quotation.fees.serviceFee },
    {
      label: `Class Fee (${quotation.numberOfClasses} class${quotation.numberOfClasses !== 1 ? 'es' : ''})`,
      amount: quotation.fees.classFee * quotation.numberOfClasses,
    },
    { label: 'Procedure Fee', amount: quotation.fees.procedureFee },
  ]
    .filter((row) => row.amount > 0)
    .map(
      (row) => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; color: #555;">${row.label}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #333;">${formatCurrency(row.amount)}</td>
      </tr>`
    )
    .join('');

  const multiplierRow =
    quotation.multiplier !== 1
      ? `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; color: #555;">Multiplier</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #333;">× ${quotation.multiplier}</td>
      </tr>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation ${quotation.quotationNo}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a3c5e 0%, #2d6a9f 100%); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">IP Law Firm</h1>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.75); font-size: 13px;">Professional Intellectual Property Services</p>
            </td>
          </tr>

          <!-- Quotation Title -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <h2 style="margin: 0 0 4px; color: #1a3c5e; font-size: 20px; font-weight: 600;">Quotation</h2>
              <p style="margin: 0; color: #2d6a9f; font-size: 22px; font-weight: 700;">${quotation.quotationNo}</p>
            </td>
          </tr>

          <!-- Meta Info -->
          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Prepared For</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${quotation.clientName}</p>
                    ${quotation.clientEmail ? `<p style="margin: 2px 0 0; font-size: 13px; color: #666;">${quotation.clientEmail}</p>` : ''}
                    ${quotation.clientType ? `<p style="margin: 2px 0 0; font-size: 12px; color: #888;">${quotation.clientType}</p>` : ''}
                  </td>
                  <td width="50%" style="vertical-align: top; text-align: right;">
                    <p style="margin: 0 0 4px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Issue Date</p>
                    <p style="margin: 0 0 12px; font-size: 13px; color: #333;">${issueDate}</p>
                    <p style="margin: 0 0 4px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Valid Until</p>
                    <p style="margin: 0; font-size: 13px; color: #333;">${expiryDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;"><hr style="border: none; border-top: 1px solid #e8ecf0; margin: 0;" /></td>
          </tr>

          <!-- Service Details -->
          <tr>
            <td style="padding: 24px 40px 16px;">
              <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #1a3c5e; text-transform: uppercase; letter-spacing: 0.5px;">Service Details</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e8ecf0; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; width: 40%;">Service</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #333;">${quotation.service}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #f0f0f0;">Procedure</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #333; border-top: 1px solid #f0f0f0;">${quotation.procedure}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #f0f0f0;">Country</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #333; border-top: 1px solid #f0f0f0;">${quotation.country}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #f0f0f0;">Number of Classes</td>
                  <td style="padding: 10px 16px; font-size: 13px; color: #333; border-top: 1px solid #f0f0f0;">${quotation.numberOfClasses}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fee Breakdown -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #1a3c5e; text-transform: uppercase; letter-spacing: 0.5px;">Fee Breakdown</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e8ecf0; border-radius: 6px; overflow: hidden;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Description</td>
                  <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Amount</td>
                </tr>
                ${feeRows}
                ${multiplierRow}
                <tr style="background-color: #f0f5fa;">
                  <td style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1a3c5e; border-top: 2px solid #d0dcea;">Subtotal</td>
                  <td style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1a3c5e; text-align: right; border-top: 2px solid #d0dcea;">${formatCurrency(quotation.subtotal)}</td>
                </tr>
                <tr style="background: linear-gradient(135deg, #1a3c5e 0%, #2d6a9f 100%);">
                  <td style="padding: 16px; font-size: 16px; font-weight: 700; color: #ffffff;">Total</td>
                  <td style="padding: 16px; font-size: 16px; font-weight: 700; color: #ffffff; text-align: right;">${formatCurrency(quotation.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            quotation.notes
              ? `
          <!-- Notes -->
          <tr>
            <td style="padding: 0 40px 16px;">
              <h3 style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #1a3c5e; text-transform: uppercase; letter-spacing: 0.5px;">Notes</h3>
              <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.6; background-color: #f8fafc; padding: 14px 16px; border-radius: 6px; border-left: 3px solid #2d6a9f;">${quotation.notes}</p>
            </td>
          </tr>`
              : ''
          }

          <!-- Validity Notice -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <p style="margin: 0; font-size: 12px; color: #888; line-height: 1.6; padding: 12px 16px; background-color: #fffbf0; border-radius: 6px; border: 1px solid #fde68a;">
                <strong style="color: #92400e;">Important:</strong> This quotation is valid for ${quotation.validDays} days from the issue date (until ${expiryDate}). Prices are subject to change after the validity period.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e8ecf0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #aaa;">This is an automated quotation from IP Law Firm's management system.</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #aaa;">For questions, please contact us at your assigned account manager.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findById(params.id)
      .populate('clientId', 'name email phone country type')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Resolve recipient: from request body, then quotation clientEmail, else reject
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = body.email || quotation.clientEmail;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No recipient email address found. Provide an email in the request body.' },
        { status: 400 }
      );
    }

    const html = buildQuotationEmailHtml({
      quotationNo: quotation.quotationNo,
      clientName: quotation.clientName,
      clientEmail: quotation.clientEmail,
      clientType: quotation.clientType,
      service: quotation.service,
      procedure: quotation.procedure,
      country: quotation.country,
      numberOfClasses: quotation.numberOfClasses,
      fees: quotation.fees,
      multiplier: quotation.multiplier,
      subtotal: quotation.subtotal,
      total: quotation.total,
      currency: quotation.currency,
      status: quotation.status,
      validDays: quotation.validDays,
      notes: quotation.notes,
      createdAt: quotation.createdAt,
    });

    await sendMail({
      to: recipientEmail,
      subject: `Quotation ${quotation.quotationNo} – ${quotation.service} (${quotation.country})`,
      html,
    });

    return NextResponse.json({
      message: `Quotation ${quotation.quotationNo} sent successfully to ${recipientEmail}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
