import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import connectDB from '@/lib/mongodb';
import Bank from '@/models/Bank';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Invoice from '@/models/Invoice';
import InvoicingApplication from '@/models/InvoicingApplication';
import { getUserFromRequest } from '@/lib/auth';
import { verifyInvoicePdfToken } from '@/lib/invoice-pdf-token';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const valueOrDash = (value: unknown): string => String(value ?? '').trim() || '-';

const formatDate = (value: unknown): string => {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10);
};

const formatMoney = (currency: string, value: unknown): string =>
  `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;

const fileNameSafe = (value: string): string =>
  value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'invoice';

const getPdfImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG';
  if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
  return 'JPEG';
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = getUserFromRequest(req);
    const token = new URL(req.url).searchParams.get('t') || '';
    const tokenValid = token ? verifyInvoicePdfToken(token, id) : false;
    if (!user && !tokenValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });

    const applicationIds = Array.isArray(invoice.applicationIds)
      ? invoice.applicationIds.map((applicationId) => String(applicationId)).filter(Boolean)
      : [];

    const [client, country, bank, applications] = await Promise.all([
      invoice.clientId ? Client.findById(invoice.clientId).select('name companyName assignedId address email phone').lean() : null,
      invoice.countryId ? Country.findById(invoice.countryId).select('name abbreviation').lean() : null,
      invoice.bankId ? Bank.findById(invoice.bankId).lean() : null,
      applicationIds.length
        ? InvoicingApplication.find({
            $or: [{ _id: { $in: applicationIds } }, { aiptReferenceId: { $in: applicationIds } }],
          })
            .select('moduleType applicationName markImage filingNumber classNo aiptReference aiptReferenceId')
            .lean()
        : Promise.resolve([]),
    ]);

    const origin = new URL(req.url).origin;
    const pdfUrl = `${origin}/api/invoices/${id}/pdf${invoice.pdfAccessToken ? `?t=${encodeURIComponent(String(invoice.pdfAccessToken))}&download=0` : '?download=0'}`;
    const qrDataUrl = await QRCode.toDataURL(pdfUrl, { margin: 1, width: 180 });
    const currency = String(invoice.currency || 'USD');
    const clientName = valueOrDash(client?.companyName || client?.name || invoice.clientMaster);
    const clientLabel = client?.assignedId ? `${clientName} - ${client.assignedId}` : clientName;
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const trademarkApplication = applications.find((application: any) => /trademark/i.test(String(application.moduleType || invoice.invoiceType || '')));
    const markImage = String((trademarkApplication as any)?.markImage || '');
    const canRenderMarkImage = markImage.startsWith('data:image/');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const navy = '#071A5F';
    const accent = '#2A59FF';
    const border = '#C9D4F4';
    const soft = '#EEF3FF';

    doc.setTextColor(navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('INVOICE', margin, 54);
    doc.setDrawColor(accent);
    doc.setLineWidth(2.2);
    doc.line(margin, 68, margin + 50, 68);

    doc.setFontSize(22);
    doc.text(valueOrDash(bank?.bankHeader || bank?.bankName), pageWidth / 2, 56, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(valueOrDash(bank?.bankDescription), pageWidth / 2, 76, { align: 'center', maxWidth: 220 });

    const qrX = pageWidth - margin - 120;
    doc.setFillColor(navy);
    doc.roundedRect(qrX, 24, 120, 18, 4, 4, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('SCAN TO VIEW INVOICE', qrX + 60, 36, { align: 'center' });
    doc.setDrawColor(navy);
    doc.roundedRect(qrX, 24, 120, 142, 4, 4);
    doc.addImage(qrDataUrl, 'PNG', qrX + 18, 54, 84, 84);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Online PDF', qrX + 60, 152, { align: 'center' });

    const card = (x: number, y: number, width: number, height: number) => {
      doc.setDrawColor(border);
      doc.setFillColor('#FFFFFF');
      doc.roundedRect(x, y, width, height, 5, 5, 'FD');
    };
    const pill = (label: string, x: number, y: number, width: number) => {
      doc.setFillColor(navy);
      doc.roundedRect(x, y, width, 20, 3, 3, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, x + 8, y + 13);
      doc.setTextColor(navy);
    };
    const metaRow = (label: string, value: string, x: number, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, x, y);
      doc.text(':', x + 92, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value || '-', x + 116, y, { maxWidth: 130 });
    };

    const cardTop = 190;
    const colGap = 12;
    const cardWidth = (pageWidth - margin * 2 - colGap) / 2;
    card(margin, cardTop, cardWidth, 112);
    pill('BILLED TO', margin + 14, cardTop + 16, 66);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(clientLabel, cardWidth - 36), margin + 16, cardTop + 62);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(valueOrDash(invoice.toAddress || client?.address), cardWidth - 36), margin + 16, cardTop + 88);

    const metaX = margin + cardWidth + colGap;
    card(metaX, cardTop, cardWidth, 112);
    metaRow('Invoice Date', formatDate(invoice.invoiceDate), metaX + 22, cardTop + 36);
    metaRow('Invoice No', valueOrDash(invoice.invoiceNumber), metaX + 22, cardTop + 60);
    metaRow('Country', country?.abbreviation ? `${country.name} (${country.abbreviation})` : valueOrDash(country?.name), metaX + 22, cardTop + 84);
    metaRow('Client Reference', valueOrDash(invoice.clientReference), metaX + 22, cardTop + 108);

    const subjectTop = 318;
    card(margin, subjectTop, pageWidth - margin * 2, 84);
    pill('SUBJECT', margin + 14, subjectTop + 14, 58);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (canRenderMarkImage) {
      try {
        doc.addImage(markImage, getPdfImageFormat(markImage), margin + 16, subjectTop + 40, 84, 58);
      } catch {
        // Ignore image rendering issues.
      }
    }
    const subjectTextX = margin + 16 + (canRenderMarkImage ? 104 : 0);
    const subjectTextWidth = pageWidth - margin * 2 - 40 - (canRenderMarkImage ? 104 : 0);
    doc.text(doc.splitTextToSize(valueOrDash(invoice.subject), subjectTextWidth), subjectTextX, subjectTop + 54);

    autoTable(doc, {
      head: [['Procedure', 'Official Fee', 'Attorney Fee', 'Qty', `VAT (${Number(invoice.vatPercentage || 0)}%)`, 'Total']],
      body: items.map((item: any) => [
        valueOrDash(item.procedure || item.item),
        formatMoney(currency, item.officialFee),
        formatMoney(currency, item.attorneyFee),
        String(item.quantity || 1),
        formatMoney(currency, item.vatAmount),
        formatMoney(currency, item.total),
      ]),
      startY: 422,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 8, textColor: navy, lineColor: border, lineWidth: 0.5 },
      headStyles: { fillColor: navy, textColor: '#FFFFFF', fontStyle: 'bold', halign: 'center' },
      foot: [['', '', '', 'Totals', formatMoney(currency, invoice.totalVat), formatMoney(currency, invoice.grandTotal || invoice.total)]],
      footStyles: { fillColor: soft, textColor: navy, fontStyle: 'bold', halign: 'center' },
      theme: 'grid',
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 488;
    const bankY = Math.min(Math.max(finalY + 18, 608), 656);
    card(margin, bankY, 250, 96);
    doc.setFillColor(navy);
    doc.rect(margin, bankY, 250, 18, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('BANK DETAILS', margin + 10, bankY + 12);
    doc.setTextColor(navy);
    const bankRows: Array<[string, unknown]> = [
      ['Bank Name', bank?.bankName],
      ['Account Name', bank?.accountName],
      ['Account Number', bank?.accountNumber],
      ['IBAN', bank?.iban],
      ['SWIFT', bank?.swift],
    ];
    bankRows.forEach(([label, value], index) => {
      const y = bankY + 35 + index * 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(label, margin + 10, y);
      doc.text(':', margin + 96, y);
      doc.text(valueOrDash(value), margin + 116, y, { maxWidth: 122 });
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Signature', pageWidth - 170, bankY + 48, { align: 'center' });
    doc.setDrawColor(navy);
    doc.line(pageWidth - 240, bankY + 70, pageWidth - 100, bankY + 70);
    doc.setFont('helvetica', 'bold');
    doc.text('Mohammad Saleh Alotaishan', pageWidth - 170, bankY + 86, { align: 'center' });

    doc.setFillColor(soft);
    doc.setDrawColor(border);
    doc.roundedRect(margin, pageHeight - 72, pageWidth - margin * 2, 44, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Thank you for your business!', margin + 14, pageHeight - 47);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Scan the QR code to open this invoice online as a PDF.', margin + 14, pageHeight - 31);
    doc.setFillColor(navy);
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const download = new URL(req.url).searchParams.get('download') !== '0';
    const fileName = `${fileNameSafe(String(invoice.invoiceNumber || 'invoice'))}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate invoice PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
