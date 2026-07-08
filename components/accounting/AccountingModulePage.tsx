'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DataTable, { type Column } from '@/components/tables/DataTable';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/components/feedback/heroToast';

const SIDEBAR_COLOR = '#0B1739';

type PageMode = 'new-invoice' | 'create-payment' | 'unpaid' | 'cancelled' | 'pending' | 'paid';
type Status = 'Unpaid' | 'Pending' | 'Paid' | 'Cancelled';

interface InvoiceRow {
  id: string;
  countryId: string;
  countryName: string;
  countryAbbreviation: string;
  countryFlag: string;
  invoiceNumber: string;
  procedure: string;
  amount: number;
  currency: string;
  status: Status | string;
  reason: string;
  createdDate: string;
  invoiceDate: string;
  recordType?: string;
}

interface PaymentRow {
  id: string;
  paymentRef: string;
  countryId: string;
  countryName: string;
  countryAbbreviation: string;
  countryFlag: string;
  datePayment: string;
  invoiceId: string;
  invoiceNumber: string;
  procedure: string;
  amount: number;
  bankId: string;
  bankName: string;
  userName: string;
  status: Status;
  cancellationReason: string;
}

interface BankOption {
  _id: string;
  bankName: string;
}

interface CountryOption {
  _id: string;
  name: string;
  abbreviation: string;
  flagCode?: string;
}

interface FilterState {
  status: string;
  countryId: string;
  bankId: string;
  date: string;
}

const modeConfig = {
  'new-invoice': {
    title: 'New Invoice',
    subtitle: 'Latest invoices created today from the Invoice model.',
    endpoint: '/api/accounting/invoices/today',
    kind: 'invoices',
  },
  'create-payment': {
    title: 'Create Payment',
    subtitle: 'Create payment records from existing invoices and track their statuses.',
    endpoint: '/api/accounting/payments',
    kind: 'payments',
  },
  unpaid: {
    title: 'Unpaid Invoice',
    subtitle: 'Invoices that are waiting for a payment record.',
    endpoint: '/api/accounting/invoices/unpaid',
    kind: 'invoices',
  },
  cancelled: {
    title: 'Cancelled Invoice',
    subtitle: 'Cancelled invoices and cancelled payment invoices with reasons.',
    endpoint: '/api/accounting/invoices/cancelled',
    kind: 'cancelled',
  },
  pending: {
    title: 'Pending Payment Invoice',
    subtitle: 'Payment invoice records waiting for completion.',
    endpoint: '/api/accounting/payments/pending',
    kind: 'payments',
  },
  paid: {
    title: 'Paid Invoice',
    subtitle: 'Completed paid payment invoice records.',
    endpoint: '/api/accounting/payments/paid',
    kind: 'payments',
  },
} as const;

const statusOptions: Status[] = ['Unpaid', 'Pending', 'Paid', 'Cancelled'];

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

function countryLabel(row: { countryFlag?: string; countryName?: string; countryAbbreviation?: string }) {
  const suffix = row.countryAbbreviation ? ` (${row.countryAbbreviation})` : '';
  return `${row.countryFlag ? `${row.countryFlag} ` : ''}${row.countryName || 'Unknown Country'}${suffix}`;
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'Paid') return 'success';
  if (status === 'Pending') return 'warning';
  if (status === 'Cancelled') return 'error';
  if (status === 'Unpaid') return 'info';
  return 'default';
}

function StatusChip({ status }: { status: string }) {
  return <Chip label={status} color={statusColor(status)} size="small" sx={{ fontWeight: 800 }} />;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data as T;
}

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.countryId) params.set('countryId', filters.countryId);
  if (filters.bankId) params.set('bankId', filters.bankId);
  if (filters.date) params.set('date', filters.date);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function FilterBar({
  mode,
  filters,
  countries,
  banks,
  onChange,
}: {
  mode: PageMode;
  filters: FilterState;
  countries: CountryOption[];
  banks: BankOption[];
  onChange: (filters: FilterState) => void;
}) {
  const showStatus = mode === 'create-payment';
  const showBank = ['create-payment', 'pending', 'paid', 'cancelled'].includes(mode);

  return (
    <Paper sx={{ p: 2, mb: 2, borderRadius: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: showStatus ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {showStatus && (
          <Box>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
                <MenuItem value="">All</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Box>
          <Autocomplete
            size="small"
            options={countries}
            value={countries.find((country) => country._id === filters.countryId) || null}
            getOptionLabel={(country) => `${country.name}${country.abbreviation ? ` (${country.abbreviation})` : ''}`}
            onChange={(_, country) => onChange({ ...filters, countryId: country?._id || '' })}
            renderInput={(params) => <TextField {...params} label="Country" />}
          />
        </Box>
        {showBank && (
          <Box>
            <Autocomplete
              size="small"
              options={banks}
              value={banks.find((bank) => bank._id === filters.bankId) || null}
              getOptionLabel={(bank) => bank.bankName}
              onChange={(_, bank) => onChange({ ...filters, bankId: bank?._id || '' })}
              renderInput={(params) => <TextField {...params} label="Bank" />}
            />
          </Box>
        )}
        <Box>
          <TextField
            fullWidth
            size="small"
            label="Date"
            type="date"
            value={filters.date}
            onChange={(event) => onChange({ ...filters, date: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Box>
    </Paper>
  );
}

function PaymentCreator({
  banks,
  onCreated,
  compact = false,
}: {
  banks: BankOption[];
  onCreated: () => void;
  compact?: boolean;
}) {
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceRow[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [datePayment, setDatePayment] = useState(new Date().toISOString().slice(0, 10));
  const [cart, setCart] = useState<InvoiceRow[]>([]);
  const [saving, setSaving] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await fetchJson<{ records: InvoiceRow[] }>('/api/accounting/invoices/lookup');
      setInvoiceOptions(data.records);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to load invoices.');
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const addToCart = () => {
    if (!selectedInvoice) {
      showWarningToast('Select invoice number first.');
      return;
    }
    if (cart.some((invoice) => invoice.id === selectedInvoice.id)) {
      showWarningToast('Invoice already exists in the payment cart.');
      return;
    }
    setCart((current) => [...current, selectedInvoice]);
    setSelectedInvoice(null);
    showSuccessToast('Invoice added to payment cart.');
  };

  const createPayments = async () => {
    if (!selectedBank) {
      showWarningToast('Bank is required.');
      return;
    }
    if (cart.length === 0) {
      showWarningToast('Add at least one invoice into the cart.');
      return;
    }
    setSaving(true);
    try {
      for (const invoice of cart) {
        await fetchJson('/api/accounting/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoice.id,
            bankId: selectedBank._id,
            datePayment,
            status: 'Pending',
          }),
        });
      }
      showSuccessToast('Payment created successfully.');
      setCart([]);
      setSelectedBank(null);
      await loadInvoices();
      onCreated();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ p: 2.5, mb: 3, borderRadius: 1.5, border: '1px solid #E5E7EB', boxShadow: 'none' }}>
      <Typography sx={{ fontWeight: 900, mb: 0.5 }}>{compact ? 'Add Invoice to Payment Cart' : 'Create Payment'}</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2, fontSize: 13 }}>
        Invoice number, country, procedure, and amount are loaded from the Invoice model.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        <Box>
          <Autocomplete
            options={invoiceOptions}
            value={selectedInvoice}
            getOptionLabel={(invoice) => `${invoice.invoiceNumber} - ${countryLabel(invoice)} - ${formatAmount(invoice.amount, invoice.currency)}`}
            onChange={(_, invoice) => setSelectedInvoice(invoice)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Invoice Number" helperText="Select invoice number first." />}
          />
        </Box>
        <Box>
          <Autocomplete
            options={banks}
            value={selectedBank}
            getOptionLabel={(bank) => bank.bankName}
            onChange={(_, bank) => setSelectedBank(bank)}
            renderInput={(params) => <TextField {...params} label="Bank" />}
          />
        </Box>
        <Box>
          <TextField
            fullWidth
            label="Date Payment"
            type="date"
            value={datePayment}
            onChange={(event) => setDatePayment(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mt: 2 }}>
        <Box>
          <TextField fullWidth label="Country" value={selectedInvoice ? countryLabel(selectedInvoice) : ''} disabled helperText={!selectedInvoice ? 'Select invoice number first.' : ' '} />
        </Box>
        <Box>
          <TextField fullWidth label="Procedure" value={selectedInvoice?.procedure || ''} disabled helperText={!selectedInvoice ? 'Select invoice number first.' : ' '} />
        </Box>
        <Box>
          <TextField fullWidth label="Amount" value={selectedInvoice ? formatAmount(selectedInvoice.amount, selectedInvoice.currency) : ''} disabled helperText={!selectedInvoice ? 'Select invoice number first.' : ' '} />
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={addToCart}>
          Add to Cart
        </Button>
        {!compact && (
          <Button variant="contained" onClick={createPayments} disabled={saving} sx={{ bgcolor: SIDEBAR_COLOR }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Create Payment'}
          </Button>
        )}
      </Stack>

      {cart.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <DataTable
            columns={[
              { key: 'countryLabel', label: 'Country' },
              { key: 'invoiceNumber', label: 'Invoice Number' },
              { key: 'procedure', label: 'Procedure' },
              { key: 'amountLabel', label: 'Amount' },
              {
                key: 'actions',
                label: 'Action',
                render: (row) => (
                  <Button size="small" color="error" onClick={() => setCart((current) => current.filter((invoice) => invoice.id !== row.id))}>
                    Remove
                  </Button>
                ),
              },
            ]}
            data={cart.map((invoice) => ({
              ...invoice,
              countryLabel: countryLabel(invoice),
              amountLabel: formatAmount(invoice.amount, invoice.currency),
            }))}
            exportFileName="payment-cart"
            emptyMessage="No invoices in cart"
            searchPlaceholder="Search cart..."
          />
        </Box>
      )}
      {compact && cart.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={createPayments} disabled={saving} sx={{ bgcolor: SIDEBAR_COLOR }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Create Payment from Cart'}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

export default function AccountingModulePage({ mode }: { mode: PageMode }) {
  const config = modeConfig[mode];
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [filters, setFilters] = useState<FilterState>({ status: '', countryId: '', bankId: '', date: '' });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<InvoiceRow | PaymentRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | PaymentRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [countryData, bankData] = await Promise.all([
        fetchJson<{ countries: CountryOption[] }>('/api/countries?limit=100'),
        fetchJson<{ banks: BankOption[] }>('/api/banks?limit=100'),
      ]);
      setCountries(countryData.countries || []);
      setBanks(bankData.banks || []);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to load filters.');
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      if (config.kind === 'payments') {
        const data = await fetchJson<{ records: PaymentRow[] }>(`${config.endpoint}${buildQuery(filters)}`);
        setPaymentRows(data.records);
        setInvoiceRows([]);
      } else if (config.kind === 'cancelled') {
        const [invoiceData, paymentData] = await Promise.all([
          fetchJson<{ records: InvoiceRow[] }>(`${config.endpoint}${buildQuery(filters)}`),
          fetchJson<{ records: PaymentRow[] }>(`/api/accounting/payments${buildQuery({ ...filters, status: 'Cancelled' })}`),
        ]);
        setInvoiceRows([
          ...invoiceData.records.map((record) => ({ ...record, recordType: 'Invoice' })),
          ...paymentData.records.map((record) => ({
            id: record.id,
            countryId: record.countryId,
            countryName: record.countryName,
            countryAbbreviation: record.countryAbbreviation,
            countryFlag: record.countryFlag,
            invoiceNumber: record.invoiceNumber,
            procedure: record.procedure,
            amount: record.amount,
            currency: '',
            status: record.status,
            reason: record.cancellationReason,
            createdDate: record.datePayment,
            invoiceDate: record.datePayment,
            recordType: 'Payment',
          })),
        ]);
        setPaymentRows([]);
      } else {
        const data = await fetchJson<{ records: InvoiceRow[] }>(`${config.endpoint}${buildQuery(filters)}`);
        setInvoiceRows(data.records);
        setPaymentRows([]);
      }
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to load accounting records.');
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.kind, filters]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const updateInvoiceStatus = useCallback(async (invoice: InvoiceRow, status: Status, reason?: string) => {
    await fetchJson(`/api/accounting/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, cancellationReason: reason }),
    });
    showSuccessToast('Invoice status updated.');
    loadRows();
  }, [loadRows]);

  const updatePaymentStatus = useCallback(async (payment: PaymentRow, status: Status, reason?: string) => {
    await fetchJson(`/api/accounting/payments/${payment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, cancellationReason: reason }),
    });
    showSuccessToast('Payment status updated.');
    loadRows();
  }, [loadRows]);

  const submitCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      showWarningToast('Cancellation reason is required.');
      return;
    }
    try {
      if ('paymentRef' in cancelTarget) {
        await updatePaymentStatus(cancelTarget, 'Cancelled', cancelReason);
      } else {
        await updateInvoiceStatus(cancelTarget, 'Cancelled', cancelReason);
      }
      setCancelTarget(null);
      setCancelReason('');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to cancel record.');
    }
  };

  const invoiceColumns: Column<any>[] = useMemo(
    () => [
      { key: 'countryLabel', label: 'Country with flag' },
      { key: 'invoiceNumber', label: 'Invoice Number' },
      { key: 'procedure', label: 'Procedure' },
      { key: 'amountLabel', label: 'Amount', align: 'right' },
      { key: 'reason', label: 'Reason' },
      { key: 'statusText', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
      { key: 'createdDateLabel', label: 'Created Date' },
      {
        key: 'actions',
        label: 'Action',
        render: (row) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button size="small" component={Link} href={`/admin/invoice/create-new?id=${row.id}&mode=view`} variant="outlined">
              View
            </Button>
            {row.recordType !== 'Payment' && (
              <Button size="small" component={Link} href={`/admin/invoice/create-new?id=${row.id}&mode=edit`} variant="outlined">
                Edit
              </Button>
            )}
            {row.recordType !== 'Payment' && (
              <Select
                size="small"
                value={row.status}
                onChange={(event) => updateInvoiceStatus(row, event.target.value as Status).catch((error) => showErrorToast(error.message))}
                sx={{ minWidth: 118 }}
              >
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            )}
            <Button size="small" color="error" variant="outlined" onClick={() => setCancelTarget(row)}>
              Cancel
            </Button>
          </Stack>
        ),
      },
    ],
    [updateInvoiceStatus]
  );

  const paymentColumns: Column<any>[] = useMemo(
    () => [
      { key: 'paymentRef', label: 'Payment Ref' },
      { key: 'countryLabel', label: 'Country' },
      { key: 'datePaymentLabel', label: 'Date Payment' },
      { key: 'invoiceNumber', label: 'Invoice Number' },
      { key: 'procedure', label: 'Procedure' },
      { key: 'amountLabel', label: 'Amount', align: 'right' },
      { key: 'bankName', label: 'Bank' },
      { key: 'userName', label: 'User' },
      { key: 'statusText', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
      {
        key: 'actions',
        label: 'Action',
        render: (row) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button size="small" variant="outlined" onClick={() => setSelectedRecord(row)}>
              View
            </Button>
            <Select
              size="small"
              value={row.status}
              onChange={(event) => updatePaymentStatus(row, event.target.value as Status).catch((error) => showErrorToast(error.message))}
              sx={{ minWidth: 118 }}
            >
              {statusOptions.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
            <Button size="small" color="error" variant="outlined" onClick={() => setCancelTarget(row)}>
              Cancel
            </Button>
          </Stack>
        ),
      },
    ],
    [updatePaymentStatus]
  );

  const tableRows =
    config.kind === 'payments'
      ? paymentRows.map((row) => ({
          ...row,
          countryLabel: countryLabel(row),
          amountLabel: formatAmount(row.amount),
          datePaymentLabel: formatDate(row.datePayment),
          statusText: row.status,
        }))
      : invoiceRows.map((row) => ({
          ...row,
          countryLabel: countryLabel(row),
          amountLabel: formatAmount(row.amount, row.currency),
          createdDateLabel: formatDate(row.createdDate),
          statusText: row.status,
        }));

  const visibleInvoiceColumns = mode === 'cancelled' ? invoiceColumns : invoiceColumns.filter((column) => column.key !== 'reason');

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
            Dashboard / Accounting / {config.title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0 }}>
            {config.title}
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>{config.subtitle}</Typography>
        </Box>
        <Button component={Link} href="/dashboard/accounting/create-payment" variant="contained" sx={{ bgcolor: SIDEBAR_COLOR, alignSelf: { xs: 'stretch', md: 'center' } }}>
          Create Payment
        </Button>
      </Box>

      {(mode === 'create-payment' || mode === 'new-invoice') && (
        <PaymentCreator banks={banks} onCreated={loadRows} compact={mode === 'new-invoice'} />
      )}

      <FilterBar mode={mode} filters={filters} countries={countries} banks={banks} onChange={setFilters} />

      <DataTable
        columns={config.kind === 'payments' ? paymentColumns : visibleInvoiceColumns}
        data={tableRows}
        loading={loading}
        keyExtractor={(row) => `${row.recordType || config.kind}-${row.id}`}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        exportFileName={`accounting-${mode}`}
        emptyMessage={`No ${config.title.toLowerCase()} records found`}
        emptyDescription="Create or update invoices and payments to populate this page."
      />

      <Dialog open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: SIDEBAR_COLOR, color: '#fff', fontWeight: 900 }}>Accounting Details</DialogTitle>
        <DialogContent sx={{ bgcolor: '#fff', pt: 2.5 }}>
          {selectedRecord && (
            <Stack spacing={1.25}>
              {Object.entries(selectedRecord).map(([key, value]) => (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, borderBottom: '1px solid #EEF2F7', pb: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>{key}</Typography>
                  <Typography sx={{ textAlign: 'right', color: 'text.secondary' }}>{String(value || '-')}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#fff', px: 3, pb: 2 }}>
          <Button onClick={() => setSelectedRecord(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: SIDEBAR_COLOR, color: '#fff', fontWeight: 900 }}>Cancel Accounting Record</DialogTitle>
        <DialogContent sx={{ bgcolor: '#fff', pt: 2.5 }}>
          <Typography sx={{ mb: 2 }}>Please confirm cancellation and provide a reason.</Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#fff', px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)}>Close</Button>
          <Button color="error" variant="contained" onClick={submitCancel}>
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
