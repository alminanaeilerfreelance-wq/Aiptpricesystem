import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import '@/models/Requirement';
import '@/models/Country';
import '@/models/Client';
import { getUserFromRequest } from '@/lib/auth';
import { verifyQuotationPdfToken } from '@/lib/quotation-pdf-token';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const stripHtml = (value: string): string =>
  value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const formatMoney = (amount: number, currency: string): string =>
  `${currency} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = getUserFromRequest(req);
    const token = new URL(req.url).searchParams.get('t');
    const tokenValid = token ? verifyQuotationPdfToken(token, id) : false;

    if (!user && !tokenValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findById(id)
      .populate('clientId', 'name email phone country type address city')
      .populate({
        path: 'requirementIds',
        select: 'requirements country',
        populate: { path: 'country', select: 'name abbreviation' },
      });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(20, 35, 64);
    doc.rect(0, 0, pageWidth, 92, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Quotation Details', 40, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.quotationNo, 40, 62);
    doc.text(`Status: ${quotation.status}`, pageWidth - 150, 62);

    doc.setTextColor(20, 28, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Client Information', 40, 120);

    autoTable(doc, {
      startY: 130,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 6, textColor: [30, 41, 59] },
      head: [['Field', 'Value']],
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      body: [
        ['Client Name', quotation.clientName || '—'],
        ['Email', quotation.clientEmail || '—'],
        ['Client Type', quotation.clientType || '—'],
        ['Service', quotation.service || '—'],
        ['Procedure', quotation.procedure || '—'],
        ['Country', quotation.country || '—'],
      ],
      bodyStyles: {
        fillColor: [248, 250, 252],
      },
      alternateRowStyles: {
        fillColor: [241, 245, 249],
      },
    });

    const officialFees =
      Number(quotation.fees?.governmentFee || 0) +
      Number(quotation.fees?.classFee || 0) +
      Number(quotation.fees?.procedureFee || 0);
    const attorneyFees = Number(quotation.fees?.serviceFee || 0);
    const totalFees = Number(quotation.total || 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Fee Breakdown', 40, (doc as any).lastAutoTable.finalY + 28);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 36,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 6, textColor: [30, 41, 59] },
      head: [['Procedure', 'Official Fees', 'Atty Fees', 'Total Fees']],
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
      },
      body: [
        [
          quotation.procedure || '—',
          formatMoney(officialFees, quotation.currency),
          formatMoney(attorneyFees, quotation.currency),
          formatMoney(totalFees, quotation.currency),
        ],
      ],
      columnStyles: {
        1: { fillColor: [255, 247, 237] },
        2: { fillColor: [236, 253, 245] },
        3: { fillColor: [239, 246, 255], fontStyle: 'bold' },
      },
      foot: [
        [
          'Grand Total',
          formatMoney(officialFees, quotation.currency),
          formatMoney(attorneyFees, quotation.currency),
          formatMoney(totalFees, quotation.currency),
        ],
      ],
      footStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
    });

    const requirements = Array.isArray((quotation as any).requirementIds)
      ? (quotation as any).requirementIds
      : [];

    let nextY = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Requirements', 40, nextY);
    nextY += 8;

    if (requirements.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text('No requirements selected for this quotation.', 40, nextY + 16);
    } else {
      autoTable(doc, {
        startY: nextY + 4,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 6, textColor: [30, 41, 59] },
        head: [['#', 'Requirement']],
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
        },
        body: requirements.map((req: any, index: number) => [
          String(index + 1),
          stripHtml(req?.requirements || ''),
        ]),
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });
      nextY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (quotation.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 28, 38);
      doc.text('Notes', 40, nextY + 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(quotation.notes, pageWidth - 80);
      doc.text(wrapped, 40, nextY + 34);
    }

    const arrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(arrayBuffer);
    const download = new URL(req.url).searchParams.get('download') !== '0';
    const fileName = `${quotation.quotationNo || 'quotation'}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
