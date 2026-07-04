import { z } from 'zod';
import { invoicingModuleTypes, serviceModuleTypes } from '@/types/invoicing';

const objectIdMessage = 'Please select a valid item.';
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, objectIdMessage);
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));
const optionalObjectIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(objectIdSchema.optional());

export const bankFormSchema = z.object({
  moduleType: z.literal('Bank'),
  bankName: z.string().trim().min(1, 'Bank name is required.'),
  bankHeader: z.string().trim().min(1, 'Bank header is required.'),
  bankDescription: z.string().trim().min(1, 'Bank description is required.'),
  accountName: z.string().trim().min(1, 'Account name is required.'),
  accountNumber: z.string().trim().min(1, 'Account number is required.'),
  iban: z.string().trim().min(1, 'IBAN is required.'),
  swift: z.string().trim().min(1, 'SWIFT is required.'),
  currency: z.string().trim().min(1, 'Currency is required.'),
});

export const serviceApplicationFormSchema = z
  .object({
    moduleType: z.enum(serviceModuleTypes),
    clientId: objectIdSchema,
    countryId: objectIdSchema,
    aiptReferenceId: optionalObjectIdSchema,
    aiptReference: optionalText,
    classNo: z.coerce.number().min(1).max(45).optional(),
    filingNumber: optionalText,
    applicationName: z.string().trim().min(1, 'Application name is required.'),
    allowDuplicateFilingNumber: z.coerce.boolean().default(false),
    markImage: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.moduleType === 'Trademark' && !value.classNo) {
      ctx.addIssue({
        code: 'custom',
        path: ['classNo'],
        message: 'Class is required for trademark.',
      });
    }

    if (!value.aiptReferenceId || !value.aiptReference) {
      ctx.addIssue({
        code: 'custom',
        path: ['aiptReferenceId'],
        message: 'AIPT Reference is required.',
      });
    }

    if (!value.filingNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['filingNumber'],
        message: 'Filing number is required.',
      });
    }
  });

export const invoicingFormSchema = z.discriminatedUnion('moduleType', [
  bankFormSchema,
  serviceApplicationFormSchema,
]);

export type BankFormInput = z.input<typeof bankFormSchema>;
export type ServiceApplicationFormInput = z.input<typeof serviceApplicationFormSchema>;
export type InvoicingFormInput = z.input<typeof invoicingFormSchema>;
export type BankFormValues = z.infer<typeof bankFormSchema>;
export type ServiceApplicationFormValues = z.infer<typeof serviceApplicationFormSchema>;

export const moduleTitles: Record<(typeof invoicingModuleTypes)[number], string> = {
  Bank: 'Bank',
  Trademark: 'Trademark',
  Patent: 'Patent',
  Design: 'Design',
  Litigation: 'Litigation',
  Copyright: 'Copyright',
  Others: 'Others',
};
