import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Invoice from '@/models/Invoice';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';

const servicePrefixMap: Record<string, string> = {
  Trademark: 'TM',
  Patent: 'P',
  Design: 'D',
  Copyright: 'C',
  Others: 'O',
  Litigation: 'O',
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const serviceId = (searchParams.get('serviceId') || '').trim();
    const clientId = (searchParams.get('clientId') || '').trim();
    const countryId = (searchParams.get('countryId') || '').trim();
    const invoiceDate = (searchParams.get('invoiceDate') || '').trim();

    if (
      !mongoose.Types.ObjectId.isValid(serviceId) ||
      !mongoose.Types.ObjectId.isValid(clientId) ||
      !mongoose.Types.ObjectId.isValid(countryId)
    ) {
      return NextResponse.json({ error: 'Service, client, and country are required.' }, { status: 400 });
    }

    const [service, client, country] = await Promise.all([
      Service.findById(serviceId).lean(),
      Client.findById(clientId).lean(),
      Country.findById(countryId).lean(),
    ]);

    if (!service || !client || !country) {
      return NextResponse.json({ error: 'Selected invoice data was not found.' }, { status: 404 });
    }

    const date = invoiceDate ? new Date(invoiceDate) : new Date();
    const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
    const category = String(service.category || service.name || 'Others');
    const prefix = servicePrefixMap[category] || servicePrefixMap[service.name] || 'O';
    const countryCode = String(country.abbreviation || 'XX').toUpperCase();
    const assignedId = String(client.assignedId || '').toUpperCase();

    const existingCount = await Invoice.countDocuments({
      invoiceNumber: { $regex: `^${prefix} ${year}-`, $options: 'i' },
    });
    const sequence = String(existingCount + 1).padStart(3, '0');
    const invoiceNumber = `${prefix} ${year}-${sequence}${assignedId ? ` ${assignedId}` : ''} ${countryCode}`.trim();
    return NextResponse.json({ invoiceNumber });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate invoice number';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
