import InvoiceTable from '@/components/invoicing/invoice-table';
import type { InvoiceType } from '@/types/invoice';

const DEFAULT_INVOICE_TYPE: InvoiceType = 'Trademark';

export default function AdminInvoicePage() {
  return <InvoiceTable invoiceType={DEFAULT_INVOICE_TYPE} />;
}
