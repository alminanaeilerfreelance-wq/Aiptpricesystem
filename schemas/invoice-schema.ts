import { z } from 'zod';

export const invoiceTypes = ['Bank', 'Trademark', 'Patent', 'Design', 'Copyright', 'Others'] as const;
export const invoiceStatuses = ['Draft', 'Pending', 'Paid', 'Cancelled'] as const;

const objectIdMessage = 'Please select a valid item.';
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, objectIdMessage);

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const nullableDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  });

export const invoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required.'),
  invoiceType: z.enum(invoiceTypes),
  referenceNumber: optionalTrimmedString,
  applicationNumber: optionalTrimmedString,
  applicationName: optionalTrimmedString,
  projectName: optionalTrimmedString,
  method: optionalTrimmedString,
  clientMaster: optionalTrimmedString,
  recipient: optionalTrimmedString,
  subject: optionalTrimmedString,
  bankName: optionalTrimmedString,
  clientId: objectIdSchema,
  countryId: objectIdSchema,
  invoiceDate: z
    .union([z.string(), z.date()])
    .transform((value, ctx) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: 'custom', message: 'Invoice date is required.' });
        return z.NEVER;
      }
      return date;
    }),
  dueDate: nullableDate,
  currency: z.string().trim().min(1, 'Currency is required.').default('SAR'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  vat: z.coerce.number().min(0, 'VAT cannot be negative.').default(0),
  discount: z.coerce.number().min(0, 'Discount cannot be negative.').default(0),
  total: z.coerce.number().min(0, 'Total cannot be negative.').optional(),
  status: z.enum(invoiceStatuses, { message: 'Status is required.' }),
  remarks: optionalTrimmedString,
  attachment: optionalTrimmedString,
});

export type InvoiceFormInput = z.input<typeof invoiceSchema>;
export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export function calculateInvoiceTotal(amount: number, vat = 0, discount = 0) {
  return Math.max(Number(amount || 0) + Number(vat || 0) - Number(discount || 0), 0);
}
