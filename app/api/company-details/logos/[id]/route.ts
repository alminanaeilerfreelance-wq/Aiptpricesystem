import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import { getCompanyLogoBucket } from '@/lib/company-logo-upload';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!mongoose.mongo.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid company logo id' }, { status: 400 });
    }

    await connectDB();

    const objectId = new mongoose.mongo.ObjectId(id);
    const bucket = getCompanyLogoBucket();
    const file = await bucket.find({ _id: objectId }).next();

    if (!file) {
      return NextResponse.json({ error: 'Company logo not found' }, { status: 404 });
    }

    const stream = bucket.openDownloadStream(objectId);
    const contentType =
      file.contentType ||
      (typeof file.metadata?.contentType === 'string' ? file.metadata.contentType : '') ||
      'application/octet-stream';

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load company logo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
