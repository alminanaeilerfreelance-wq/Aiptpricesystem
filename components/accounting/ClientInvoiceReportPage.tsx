'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DataTable, { type Column } from '@/components/tables/DataTable';
import { showErrorToast } from '@/components/feedback/heroToast';
import { useSettingsContext } from '@/context/SettingsContext';

const SIDEBAR_COLOR = '#0B1739';

interface ClientOption {
  _id: string;
  assignedId?: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  companyName?: string;
}

interface ClientInvoiceRow {
  id: string;
  paymentRef: string;
  country: string;
  datePayment: string;
  invoiceDate: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  bank: string;
  status: string;
}

interface Totals {
  total: number;
  unpaid: number;
  paid: number;
  cancelled: number;
  invoiceCount: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data as T;
}

function formatAmount(value: number, currency = '') {
  return `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))}`;
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'Paid') return 'success';
  if (status === 'Pending') return 'warning';
  if (status === 'Cancelled') return 'error';
  if (status === 'Unpaid') return 'info';
  return 'default';
}

function buildClientLabel(client: ClientOption) {
  const id = client.assignedId ? `${client.assignedId} - ` : '';
  const company = client.companyName ? ` (${client.companyName})` : '';
  return `${id}${client.name}${company}`;
}

export default function ClientInvoiceReportPage() {
  const { settings } = useSettingsContext();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [rows, setRows] = useState<ClientInvoiceRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, unpaid: 0, paid: 0, cancelled: 0, invoiceCount: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<{ clients: ClientOption[] }>('/api/clients?all=true&limit=1000')
      .then((data) => setClients(data.clients || []))
      .catch((error) => showErrorToast(error instanceof Error ? error.message : 'Failed to load clients.'));
  }, []);

  const loadClientInvoices = useCallback(async () => {
    if (!selectedClient?._id) {
      setRows([]);
      setTotals({ total: 0, unpaid: 0, paid: 0, cancelled: 0, invoiceCount: 0 });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ clientId: selectedClient._id });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (serverSearch.trim()) params.set('search', serverSearch.trim());
      const data = await fetchJson<{ records: ClientInvoiceRow[]; totals: Totals }>(
        `/api/accounting/client-invoices?${params.toString()}`
      );
      setRows(data.records || []);
      setTotals(data.totals || { total: 0, unpaid: 0, paid: 0, cancelled: 0, invoiceCount: 0 });
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to load client invoices.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, selectedClient?._id, serverSearch, toDate]);

  useEffect(() => {
    loadClientInvoices();
  }, [loadClientInvoices]);

  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        datePaymentLabel: formatDate(row.datePayment || row.invoiceDate),
        amountLabel: formatAmount(row.amount, row.currency),
      })),
    [rows]
  );

  const columns: Column<any>[] = useMemo(
    () => [
      { key: 'paymentRef', label: 'Payment Ref' },
      { key: 'country', label: 'Country' },
      { key: 'datePaymentLabel', label: 'Date Payment' },
      { key: 'invoiceNumber', label: 'Invoice Number' },
      { key: 'amountLabel', label: 'Amount', align: 'right' },
      { key: 'bank', label: 'Bank' },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <Chip label={row.status} color={statusColor(row.status)} size="small" sx={{ fontWeight: 800 }} />,
      },
    ],
    []
  );

  const companyName = settings?.companyName?.trim() || 'IP Law Firm';
  const selectedClientName = selectedClient ? buildClientLabel(selectedClient) : 'All clients';
  const dateRangeLabel = fromDate || toDate ? `${fromDate || 'Any'} to ${toDate || 'Any'}` : 'All dates';

  const summaryCards = [
    { label: 'Total Amount', value: formatAmount(totals.total), tone: SIDEBAR_COLOR },
    { label: 'Unpaid Invoice Total', value: formatAmount(totals.unpaid), tone: '#0EA5E9' },
    { label: 'Paid Invoice Total', value: formatAmount(totals.paid), tone: '#16A34A' },
    { label: 'Cancelled Invoice Total', value: formatAmount(totals.cancelled), tone: '#DC2626' },
    { label: 'Invoices', value: String(totals.invoiceCount), tone: '#475569' },
  ];

  const exportTotals = summaryCards.map((card) => ({ label: card.label, value: card.value }));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
      <Paper
        sx={{
          mb: 2,
          overflow: 'hidden',
          borderRadius: 1.5,
          border: '1px solid #E5E7EB',
          boxShadow: 'none',
        }}
      >
        <Box sx={{ bgcolor: SIDEBAR_COLOR, color: '#fff', px: { xs: 2, md: 3 }, py: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
            {companyName}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0, mt: 0.5 }}>
            Invoice Report
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', mt: 0.75 }}>
            Client invoices with payment status, bank details, exports, and report totals.
          </Typography>
        </Box>
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Client: ${selectedClientName}`} />
          <Chip label={`Date: ${dateRangeLabel}`} />
          <Chip label={`Rows: ${totals.invoiceCount}`} />
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1.4fr) repeat(3, minmax(0, 1fr)) auto' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Autocomplete
            options={clients}
            value={selectedClient}
            getOptionLabel={buildClientLabel}
            isOptionEqualToValue={(option, value) => option._id === value._id}
            onChange={(_, client) => setSelectedClient(client)}
            renderInput={(params) => <TextField {...params} label="Client" />}
          />
          <TextField
            label="Search by"
            value={serverSearch}
            onChange={(event) => setServerSearch(event.target.value)}
            placeholder="Invoice, method, subject"
          />
          <TextField
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To Date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant="outlined"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setServerSearch('');
            }}
            sx={{ height: 56 }}
          >
            Clear
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
        {summaryCards.map((card) => (
          <Paper key={card.label} sx={{ p: 2, borderRadius: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' }}>
            <Stack spacing={0.75}>
              <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 700 }}>{card.label}</Typography>
              <Typography sx={{ color: card.tone, fontWeight: 900, fontSize: 24, letterSpacing: 0 }}>{card.value}</Typography>
            </Stack>
          </Paper>
        ))}
      </Box>

      <DataTable
        columns={columns}
        data={tableRows}
        loading={loading}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search displayed client invoices..."
        exportFileName={selectedClient ? `client-invoices-${selectedClient.name}` : 'client-invoices'}
        emptyMessage={selectedClient ? 'No invoices found for this client' : 'Select a client'}
        emptyDescription={
          selectedClient
            ? 'Adjust the search or date range to broaden the results.'
            : 'Choose a client to display related invoice and payment rows.'
        }
        reportCompany={companyName}
        reportTitle="Invoice Report"
        reportSubtitle="Client invoice report"
        reportMeta={[
          { label: 'Client', value: selectedClientName },
          { label: 'Date Range', value: dateRangeLabel },
          { label: 'Search', value: serverSearch.trim() || 'All' },
        ]}
        reportTotals={exportTotals}
      />

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2, color: 'text.secondary' }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading client invoices...</Typography>
        </Stack>
      )}
    </Box>
  );
}
