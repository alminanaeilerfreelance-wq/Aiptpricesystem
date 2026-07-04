import React from 'react';
import type { InvoicingModuleType } from '@/types/invoicing';
import InvoicingModulePage from './invoicing-module-page';

export interface InvoicePageProps {
  invoiceType: InvoicingModuleType;
}

export default function InvoicePage({ invoiceType }: InvoicePageProps) {
  if (invoiceType === 'Bank') return null;
  return <InvoicingModulePage moduleType={invoiceType} />;
}
