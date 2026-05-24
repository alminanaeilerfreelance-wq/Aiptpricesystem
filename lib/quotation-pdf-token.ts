import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SECRET =
  process.env.QUOTATION_PDF_QR_SECRET ||
  process.env.JWT_SECRET ||
  'fallback-quotation-pdf-secret-change-in-production';

const toBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64url');

const fromBase64Url = (value: string): string =>
  Buffer.from(value, 'base64url').toString('utf8');

const sign = (payload: string): string =>
  createHmac('sha256', SECRET).update(payload).digest('hex');

export function generateQuotationPdfToken(
  quotationId: string,
  ttlMs: number = DEFAULT_TOKEN_TTL_MS
): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${quotationId}.${expiresAt}`;
  const signature = sign(payload);
  return toBase64Url(`${payload}.${signature}`);
}

export function verifyQuotationPdfToken(token: string, quotationId: string): boolean {
  try {
    const decoded = fromBase64Url(token);
    const [tokenQuotationId, rawExpiry, tokenSignature] = decoded.split('.');

    if (!tokenQuotationId || !rawExpiry || !tokenSignature) return false;
    if (tokenQuotationId !== quotationId) return false;

    const expiry = Number(rawExpiry);
    if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

    const payload = `${tokenQuotationId}.${rawExpiry}`;
    const expected = sign(payload);

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(tokenSignature, 'utf8');

    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  } catch {
    return false;
  }
}
