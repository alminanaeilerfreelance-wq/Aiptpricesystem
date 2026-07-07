import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECRET =
  process.env.INVOICE_PDF_QR_SECRET ||
  process.env.JWT_SECRET ||
  'fallback-invoice-pdf-secret-change-in-production';

const toBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const fromBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const sign = (payload: string): string => createHmac('sha256', SECRET).update(payload).digest('hex');

export function generateInvoicePdfToken(invoiceId: string, ttlMs: number = DEFAULT_TOKEN_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${invoiceId}.${expiresAt}`;
  return toBase64Url(`${payload}.${sign(payload)}`);
}

export function verifyInvoicePdfToken(token: string, invoiceId: string): boolean {
  try {
    const decoded = fromBase64Url(token);
    const [tokenInvoiceId, rawExpiry, tokenSignature] = decoded.split('.');
    if (!tokenInvoiceId || !rawExpiry || !tokenSignature) return false;
    if (tokenInvoiceId !== invoiceId) return false;

    const expiry = Number(rawExpiry);
    if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

    const expected = sign(`${tokenInvoiceId}.${rawExpiry}`);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(tokenSignature, 'utf8');

    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
