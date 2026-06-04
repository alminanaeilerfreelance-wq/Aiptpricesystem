import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import type { JWTPayload } from '@/lib/auth';
import FeeBuilderDraft from '@/models/FeeBuilderDraft';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SERVICES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'] as const;
const PRINT_ORIENTATIONS = ['portrait', 'landscape'] as const;
const PAPER_FORMATS = ['A4', 'A3', 'Letter'] as const;
const TABLE_MODES = ['quotation', 'all'] as const;

type DraftBody = Record<string, unknown>;

const cleanString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const cleanNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanArray = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];

const cleanObject = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};

const buildDraftPayload = (body: DraftBody, user: JWTPayload) => {
  const selectedService = SERVICES.includes(body.selectedService as (typeof SERVICES)[number])
    ? (body.selectedService as (typeof SERVICES)[number])
    : 'Trademark';
  const printOrientation = PRINT_ORIENTATIONS.includes(body.printOrientation as (typeof PRINT_ORIENTATIONS)[number])
    ? (body.printOrientation as (typeof PRINT_ORIENTATIONS)[number])
    : 'landscape';
  const paperFormat = PAPER_FORMATS.includes(body.paperFormat as (typeof PAPER_FORMATS)[number])
    ? (body.paperFormat as (typeof PAPER_FORMATS)[number])
    : 'A4';
  const tableMode = TABLE_MODES.includes(body.tableMode as (typeof TABLE_MODES)[number])
    ? (body.tableMode as (typeof TABLE_MODES)[number])
    : cleanArray(body.selectedRuleIds).length > 0
      ? 'quotation'
      : 'all';

  return {
    name: cleanString(body.name) || 'Untitled Draft',
    draftDate: cleanString(body.draftDate),
    selectedService,
    tableMode,
    selectedCountry: cleanString(body.selectedCountry),
    selectedContinent: cleanString(body.selectedContinent),
    selectedProcedure: cleanString(body.selectedProcedure),
    selectedRuleIds: cleanArray(body.selectedRuleIds),
    editedFees: cleanObject(body.editedFees),
    rowOrder: cleanArray(body.rowOrder),
    columnOrder: cleanArray(body.columnOrder),
    columnVisibility: cleanObject(body.columnVisibility),
    columnWidths: cleanObject(body.columnWidths),
    rowHeights: cleanObject(body.rowHeights),
    fontFamily: cleanString(body.fontFamily) || 'Calibri',
    rowHeight: cleanNumber(body.rowHeight, 22),
    columnWidth: cleanNumber(body.columnWidth, 72),
    flagWidth: cleanNumber(body.flagWidth, 26),
    flagHeight: cleanNumber(body.flagHeight, 16),
    headerColor: cleanString(body.headerColor) || '#EAF2FF',
    rowColor: cleanString(body.rowColor) || '#FFFFFF',
    fontColor: cleanString(body.fontColor) || '#111827',
    highlightColor: cleanString(body.highlightColor) || '#FFF2CC',
    printOrientation,
    paperFormat,
    createdByUserId: user.userId,
    createdByName: user.name,
    createdByEmail: user.email,
    isActive: true,
  };
};

const getDraftFilter = (id: string, userId: string) => ({
  _id: id,
  createdByUserId: userId,
  isActive: true,
});

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await connectDB();

    const draft = await FeeBuilderDraft.findOne(getDraftFilter(id, user.userId));
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await connectDB();

    const body = (await req.json()) as DraftBody;
    const draft = await FeeBuilderDraft.findOneAndUpdate(
      getDraftFilter(id, user.userId),
      { $set: buildDraftPayload(body, user) },
      { new: true, runValidators: true }
    );

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await connectDB();

    const draft = await FeeBuilderDraft.findOneAndUpdate(
      getDraftFilter(id, user.userId),
      { $set: { isActive: false } },
      { new: true }
    );

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Draft deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
