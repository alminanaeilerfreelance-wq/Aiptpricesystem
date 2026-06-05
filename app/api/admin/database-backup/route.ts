import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKUP_VERSION = 1;
const APP_NAME = 'ip-law-firm-quotation-system';
const COLLECTION_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const { EJSON } = mongoose.mongo.BSON;

type ImportMode = 'merge' | 'replace';

interface BackupCollection {
  name: string;
  documents: Array<Record<string, unknown>>;
}

interface DatabaseBackupPayload {
  version: number;
  app: string;
  exportedAt?: string;
  database?: string;
  collections: BackupCollection[];
}

function requireAdmin(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (user.role !== 'admin') {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
    };
  }

  return { user, error: null };
}

function getDatabase() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready');
  }
  return db;
}

function isSafeCollectionName(name: string) {
  return (
    Boolean(name) &&
    !name.startsWith('system.') &&
    !name.includes('$') &&
    !name.includes('\0') &&
    COLLECTION_NAME_PATTERN.test(name)
  );
}

function getBackupFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `aipt-database-backup-${stamp}.json`;
}

function parseImportMode(req: NextRequest): ImportMode {
  const mode = req.nextUrl.searchParams.get('mode');
  return mode === 'replace' ? 'replace' : 'merge';
}

function validateBackupPayload(payload: unknown): DatabaseBackupPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup file must contain a JSON object.');
  }

  const backup = payload as DatabaseBackupPayload;
  if (!Array.isArray(backup.collections)) {
    throw new Error('Backup file is missing the collections array.');
  }

  backup.collections.forEach((collection, index) => {
    if (!collection || typeof collection !== 'object') {
      throw new Error(`Collection entry ${index + 1} is invalid.`);
    }

    if (typeof collection.name !== 'string' || !isSafeCollectionName(collection.name)) {
      throw new Error(`Collection entry ${index + 1} has an unsafe collection name.`);
    }

    if (!Array.isArray(collection.documents)) {
      throw new Error(`Collection "${collection.name}" is missing its documents array.`);
    }
  });

  return backup;
}

async function importCollection(
  collection: BackupCollection,
  mode: ImportMode
): Promise<{ name: string; documents: number; mode: ImportMode }> {
  const db = getDatabase();
  const target = db.collection(collection.name);
  const documents = collection.documents;

  if (mode === 'replace') {
    await target.deleteMany({});
  }

  if (documents.length === 0) {
    return { name: collection.name, documents: 0, mode };
  }

  if (mode === 'merge') {
    const withIds = documents.filter((document) => document._id !== undefined);
    const withoutIds = documents.filter((document) => document._id === undefined);

    if (withIds.length > 0) {
      const operations = withIds.map((document) => ({
        replaceOne: {
          filter: { _id: document._id },
          replacement: document,
          upsert: true,
        },
      })) as Parameters<typeof target.bulkWrite>[0];

      await target.bulkWrite(operations, { ordered: false });
    }

    if (withoutIds.length > 0) {
      await target.insertMany(withoutIds, { ordered: false });
    }

    return { name: collection.name, documents: documents.length, mode };
  }

  await target.insertMany(documents, { ordered: false });
  return { name: collection.name, documents: documents.length, mode };
}

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireAdmin(req);
    if (error) return error;

    await connectDB();
    const db = getDatabase();
    const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray();
    const safeCollections = collectionInfos
      .map((collection) => collection.name)
      .filter(isSafeCollectionName)
      .sort((left, right) => left.localeCompare(right));

    const collections = await Promise.all(
      safeCollections.map(async (name) => ({
        name,
        documents: await db.collection(name).find({}).toArray(),
      }))
    );

    const backup = {
      version: BACKUP_VERSION,
      app: APP_NAME,
      exportedAt: new Date().toISOString(),
      exportedBy: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
      database: db.databaseName,
      collections,
    };

    return new NextResponse(EJSON.stringify(backup, undefined, 2, { relaxed: false }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${getBackupFilename()}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export database backup';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = requireAdmin(req);
    if (error) return error;

    const mode = parseImportMode(req);
    if (mode === 'replace' && req.headers.get('x-backup-confirm') !== 'DATABASE') {
      return NextResponse.json(
        { error: 'Type DATABASE to confirm replace import mode.' },
        { status: 400 }
      );
    }

    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ error: 'Backup file is empty.' }, { status: 400 });
    }

    const backup = validateBackupPayload(EJSON.parse(rawBody, { relaxed: false }));

    await connectDB();
    const results = [];
    for (const collection of backup.collections) {
      results.push(await importCollection(collection, mode));
    }

    const totalDocuments = results.reduce((sum, result) => sum + result.documents, 0);

    return NextResponse.json({
      success: true,
      mode,
      importedAt: new Date().toISOString(),
      source: {
        app: backup.app || 'unknown',
        version: backup.version || null,
        exportedAt: backup.exportedAt || null,
        database: backup.database || null,
      },
      collections: results,
      totalDocuments,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to import database backup';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
