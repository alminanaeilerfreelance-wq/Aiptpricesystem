import { randomUUID } from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';

export const COMPANY_LOGO_MAX_SIZE_BYTES = 255 * 1024 * 1024;
export const COMPANY_LOGO_ROUTE_PREFIX = '/api/company-details/logos/';
export const COMPANY_LOGO_BUCKET_NAME = 'companyLogos';

type UploadableFile = {
  name?: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const getSafeLogoExtension = (file: UploadableFile): string => {
  const fromMime = file.type ? IMAGE_EXTENSION_BY_TYPE[file.type.toLowerCase()] : '';
  if (fromMime) return fromMime;

  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'png';
};

export const getCompanyLogoBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready for company logo upload.');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: COMPANY_LOGO_BUCKET_NAME });
};

export const getCompanyLogoObjectId = (logoUrl: string) => {
  const value = String(logoUrl || '').trim();
  if (!value) return null;

  let pathname = value;
  try {
    pathname = new URL(value).pathname;
  } catch {
    pathname = value;
  }

  if (!pathname.startsWith(COMPANY_LOGO_ROUTE_PREFIX)) return null;
  const rawId = pathname.slice(COMPANY_LOGO_ROUTE_PREFIX.length).split(/[?#]/)[0];
  return mongoose.mongo.ObjectId.isValid(rawId) ? new mongoose.mongo.ObjectId(rawId) : null;
};

export const saveCompanyLogoFile = async (file: UploadableFile | null | undefined): Promise<string | undefined> => {
  if (!file || file.size === 0) return undefined;

  if (file.size > COMPANY_LOGO_MAX_SIZE_BYTES) {
    throw new Error('Company logo must be 255 MB or smaller.');
  }

  if (file.type && !file.type.toLowerCase().startsWith('image/')) {
    throw new Error('Company logo must be an image file.');
  }

  const extension = getSafeLogoExtension(file);
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = getCompanyLogoBucket();
  const uploadStream = bucket.openUploadStream(fileName, {
    contentType: file.type || 'application/octet-stream',
    metadata: {
      originalName: file.name || fileName,
      uploadedAt: new Date(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.once('error', reject);
    uploadStream.once('finish', () => resolve());
    uploadStream.end(buffer);
  });

  return `${COMPANY_LOGO_ROUTE_PREFIX}${String(uploadStream.id)}`;
};

export const deleteCompanyLogoFile = async (logoUrl: string | null | undefined): Promise<void> => {
  const objectId = getCompanyLogoObjectId(String(logoUrl || ''));
  if (!objectId) return;

  try {
    await getCompanyLogoBucket().delete(objectId);
  } catch {
    // Best-effort cleanup only. A missing old logo should not block saving company details.
  }
};
