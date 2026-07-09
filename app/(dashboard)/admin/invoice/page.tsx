import { Box } from '@mui/material';
import InvoiceTable from '@/components/invoicing/invoice-table';
import Topbar from '@/components/layout/Topbar';

export default function AdminInvoicePage() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F5F7FA' }}>
      <Topbar
        title="Created Invoices"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoicing' },
          { label: 'Created Invoices' },
        ]}
      />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <InvoiceTable />
      </Box>
    </Box>
  );
}
