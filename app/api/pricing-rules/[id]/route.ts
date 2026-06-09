import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PricingRule from '@/models/PricingRule';
import { getUserFromRequest } from '@/lib/auth';
import { buildPricingRulePayload, enrichPricingRuleObject } from '@/lib/pricing-rule-payload';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const pricingRule = await PricingRule.findById(id);
    if (!pricingRule) {
      return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
    }

    const pricingRuleWithDetails = await enrichPricingRuleObject(pricingRule.toObject());

    return NextResponse.json(pricingRuleWithDetails);
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

    await connectDB();

    const body = (await req.json()) as Record<string, unknown>;
    const existingRule = await PricingRule.findById(id);

    if (!existingRule) {
      return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
    }

    const payload = await buildPricingRulePayload(body, existingRule.toObject());
    if ('error' in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const pricingRule = await PricingRule.findByIdAndUpdate(
      id,
      { $set: payload.data },
      { new: true, runValidators: true }
    );

    if (!pricingRule) {
      return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
    }

    const pricingRuleWithDetails = await enrichPricingRuleObject(pricingRule.toObject());

    return NextResponse.json(pricingRuleWithDetails);
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

    await connectDB();

    const pricingRule = await PricingRule.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!pricingRule) {
      return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Pricing rule deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
