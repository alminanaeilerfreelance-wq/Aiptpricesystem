'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { showSuccessToast } from '@/components/feedback/heroToast';
import { Country, countriesService } from '@/services/countries.service';
import { useAuth } from '@/hooks/useAuth';
import {
  ReferenceNumber,
  ReferenceNumberStatus,
  ReferencePreview,
  ReferenceServiceType,
  referenceNumbersService,
} from '@/services/reference-numbers.service';

const SERVICE_TYPES: Array<{ label: ReferenceServiceType; code: string }> = [
  { label: 'Trademark', code: 'T' },
  { label: 'Patent', code: 'P' },
  { label: 'Design', code: 'D' },
  { label: 'Copyright', code: 'C' },
  { label: 'Other', code: 'O' },
];

const STATUSES: ReferenceNumberStatus[] = ['Available', 'Reserved', 'Used', 'Cancelled'];
const SORTABLE_COLUMNS = ['referenceNo', 'countryName', 'serviceType', 'sequence', 'status', 'createdAt'] as const;
type SortBy = typeof SORTABLE_COLUMNS[number];
type SortOrder = 'asc' | 'desc';

interface ReferenceNumberManagerProps {
  clientId?: string;
  clientName?: string;
  assignedId?: string;
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

const getCountryLabel = (country: Country) => `${country.name} (${country.abbreviation})`;

const renderCountryOption = (props: React.HTMLAttributes<HTMLLIElement> & { key: React.Key }, country: Country) => {
  const { key: _key, ...optionProps } = props;
  return (
    <li key={country._id} {...optionProps}>
      {getCountryLabel(country)}
    </li>
  );
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string; details?: string } } }).response;
    return response?.data?.error || response?.data?.details || fallback;
  }
  return err instanceof Error ? err.message : fallback;
};

const exportRows = (rows: ReferenceNumber[]) =>
  rows.map((row) => ({
    'Reference Number': row.referenceNo,
    Country: row.countryName,
    'Service Type': row.serviceType,
    'Client Name': row.usedByClientName || '-',
    'Assigned ID': row.usedByAssignedId || '-',
    Sequence: row.sequence,
    Status: row.status,
    'Created Date': formatDate(row.createdAt),
  }));

export default function ReferenceNumberManager({ clientId, clientName, assignedId = '' }: ReferenceNumberManagerProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [serviceType, setServiceType] = useState<ReferenceServiceType | ''>('Trademark');
  const [quantity, setQuantity] = useState('1');
  const [previewRows, setPreviewRows] = useState<ReferencePreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [oldReferenceOpen, setOldReferenceOpen] = useState(false);
  const [oldReferenceNo, setOldReferenceNo] = useState('');
  const [oldCountry, setOldCountry] = useState<Country | null>(null);
  const [oldServiceType, setOldServiceType] = useState<ReferenceServiceType | ''>('');
  const [oldSequence, setOldSequence] = useState('');
  const [oldReferenceLoading, setOldReferenceLoading] = useState(false);

  const [rows, setRows] = useState<ReferenceNumber[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<Country | null>(null);
  const [serviceFilter, setServiceFilter] = useState<ReferenceServiceType>('Trademark');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ReferenceNumberStatus>('Available');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCountries = useCallback(async () => {
    setCountriesLoading(true);
    try {
      const data = await countriesService.listAll();
      setCountries(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load countries'));
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setTableLoading(true);
    setError('');
    try {
      const response = await referenceNumbersService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search.trim() || undefined,
        countryId: countryFilter?._id,
        serviceType: serviceFilter,
        status: statusFilter || undefined,
        usedBy: clientId,
        sortBy,
        sortOrder,
      });
      setRows(response.referenceNumbers || []);
      setTotal(response.total || 0);
      setSelectedIds([]);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(getErrorMessage(err, 'Failed to load reference numbers'));
    } finally {
      setTableLoading(false);
    }
  }, [clientId, countryFilter?._id, page, rowsPerPage, search, serviceFilter, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPage(0);
  }, [countryFilter, search, serviceFilter, statusFilter]);

  const validateGenerate = () => {
    if (!selectedCountry) return 'Country is required';
    if (!serviceType) return 'Service Type is required';
    if (!assignedId.trim()) return 'Assigned ID is required on the client profile';
    if (!quantity.trim()) return 'Quantity is required';
    if (!/^\d+$/.test(quantity.trim())) return 'Quantity must be number only';
    const parsed = Number(quantity);
    if (parsed < 1) return 'Quantity minimum is 1';
    if (parsed > 1000) return 'Quantity maximum is 1000';
    return '';
  };

  const handleGenerate = async () => {
    const validationError = validateGenerate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPreviewLoading(true);
    setError('');
    try {
      const response = await referenceNumbersService.generate({
        countryId: selectedCountry!._id,
        serviceType: serviceType as ReferenceServiceType,
        quantity: Number(quantity),
        assignedId: assignedId.trim(),
      });
      setPreviewRows(response.references || []);
    } catch (err) {
      setPreviewRows([]);
      setError(getErrorMessage(err, 'Failed to generate reference numbers'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRegister = async () => {
    if (previewRows.length === 0) {
      setError('Generate references before registering');
      return;
    }

    setRegisterLoading(true);
    setError('');
    try {
      const response = await referenceNumbersService.register({
        references: previewRows,
        usedBy: clientId,
      });
      showSuccessToast(`Registered ${response.count} reference numbers`);
      setPreviewRows([]);
      setSelectedCountry(null);
      setServiceType(serviceFilter);
      setQuantity('1');
      setPage(0);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to register reference numbers'));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRegisterOldReference = async () => {
    const referenceNo = oldReferenceNo.trim().toUpperCase();
    if (!referenceNo) return setError('Old reference number is required');
    if (!oldCountry) return setError('Country is required');
    if (!oldServiceType) return setError('Service Type is required');
    if (!oldSequence.trim()) return setError('Sequence is required');
    if (!/^\d+$/.test(oldSequence.trim())) return setError('Sequence must be number only');
    const parsedSequence = Number(oldSequence);
    if (parsedSequence < 1) return setError('Sequence minimum is 1');

    const serviceCode = SERVICE_TYPES.find((service) => service.label === oldServiceType)?.code || '';
    setOldReferenceLoading(true);
    setError('');
    try {
      const response = await referenceNumbersService.register({
        references: [
          {
            referenceNo,
            countryId: oldCountry._id,
            countryName: oldCountry.name,
            countryCode: oldCountry.abbreviation,
            serviceType: oldServiceType,
            serviceCode,
            sequence: parsedSequence,
            status: 'Available',
          },
        ],
        usedBy: clientId,
      });
      showSuccessToast(`Old reference registered (${response.count})`);
      setOldReferenceNo('');
      setOldCountry(null);
      setOldServiceType('');
      setOldSequence('');
      setOldReferenceOpen(false);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to register old reference'));
    } finally {
      setOldReferenceLoading(false);
    }
  };

  const getAllFilteredRows = async () => {
    const limit = 200;
    const first = await referenceNumbersService.list({
      page: 1,
      limit,
      search: search.trim() || undefined,
      countryId: countryFilter?._id,
      serviceType: serviceFilter,
      status: statusFilter || undefined,
      usedBy: clientId,
      sortBy,
      sortOrder,
    });
    const all = [...(first.referenceNumbers || [])];
    const totalPages = first.totalPages || Math.ceil((first.total || all.length) / limit) || 1;
    for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
      const response = await referenceNumbersService.list({
        page: nextPage,
        limit,
        search: search.trim() || undefined,
        countryId: countryFilter?._id,
        serviceType: serviceFilter,
        status: statusFilter || undefined,
        usedBy: clientId,
        sortBy,
        sortOrder,
      });
      all.push(...(response.referenceNumbers || []));
    }
    return all;
  };

  const handleExportCsv = async () => {
    const data = exportRows(await getAllFilteredRows());
    if (data.length === 0) return setError('No reference numbers to export');
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reference-numbers.csv';
    link.click();
    URL.revokeObjectURL(url);
    showSuccessToast(`CSV exported (${data.length} rows)`);
  };

  const handleExportExcel = async () => {
    const data = exportRows(await getAllFilteredRows());
    if (data.length === 0) return setError('No reference numbers to export');
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reference Numbers');
    XLSX.writeFile(workbook, 'reference-numbers.xlsx');
    showSuccessToast(`Excel exported (${data.length} rows)`);
  };

  const handleExportPdf = async () => {
    const data = await getAllFilteredRows();
    if (data.length === 0) return setError('No reference numbers to export');
    const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Reference Numbers', 14, 14);
    autoTable.default(doc, {
      startY: 20,
      head: [['Reference Number', 'Country', 'Service Type', 'Client Name', 'Assigned ID', 'Sequence', 'Status', 'Created Date']],
      body: data.map((row) => [
        row.referenceNo,
        row.countryName,
        row.serviceType,
        row.usedByClientName || '-',
        row.usedByAssignedId || '-',
        String(row.sequence),
        row.status,
        formatDate(row.createdAt),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save('reference-numbers.pdf');
    showSuccessToast(`PDF exported (${data.length} rows)`);
  };

  const handlePrint = async () => {
    const data = exportRows(await getAllFilteredRows());
    if (data.length === 0) return setError('No reference numbers to print');
    const html = `
      <html>
        <head>
          <title>Reference Numbers</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #eff6ff; }
          </style>
        </head>
        <body>
          <h2>Reference Numbers</h2>
          <table>
            <thead><tr>${Object.keys(data[0]).map((key) => `<th>${key}</th>`).join('')}</tr></thead>
            <tbody>
              ${data.map((row) => `<tr>${Object.values(row).map((value) => `<td>${value}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return setError('Popup blocked. Please allow popups to print.');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds(checked ? rows.map((row) => row._id) : []);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!isAdmin) {
      setError('Admin access is required to delete reference numbers');
      return;
    }
    const confirmed = window.confirm(`Delete ${selectedIds.length} reference numbers?`);
    if (!confirmed) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map((id) => referenceNumbersService.delete(id)));
      showSuccessToast(`Deleted ${selectedIds.length} reference numbers`);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete selected reference numbers'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedIds.map((id) => referenceNumbersService.update(id, { status: bulkStatus })));
      showSuccessToast(`Updated ${selectedIds.length} reference numbers`);
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update selected reference numbers'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSort = (column: SortBy) => {
    if (sortBy === column) setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderStatus = (status: ReferenceNumberStatus) => {
    const palette: Record<ReferenceNumberStatus, { color: 'default' | 'primary' | 'success' | 'warning' | 'error'; label: string }> = {
      Available: { color: 'success', label: 'Available' },
      Reserved: { color: 'primary', label: 'Assigned' },
      Used: { color: 'warning', label: 'Used' },
      Cancelled: { color: 'error', label: 'Cancelled' },
    };
    const config = palette[status] || palette.Available;
    return <Chip size="small" color={config.color} label={config.label} sx={{ fontWeight: 800 }} />;
  };

  const serviceInitial = serviceType ? serviceType.charAt(0).toUpperCase() : '';
  const formulaSequence = previewRows[0]?.sequence ? String(previewRows[0].sequence) : '785';
  const formulaAssignedId = assignedId.trim() || '102';
  const formulaCountryCode = selectedCountry?.abbreviation || 'AF';
  const formulaReference = `${serviceInitial || 'T'}-${formulaSequence}${formulaAssignedId} ${formulaCountryCode}`;

  const isBusy = previewLoading || registerLoading || tableLoading || bulkLoading || oldReferenceLoading;

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {error && (
        <Alert severity="warning" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 1,
          bgcolor: '#FFFFFF',
          borderColor: '#E2E8F0',
          color: '#0F172A',
          boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
          '& .MuiInputBase-root': {
            bgcolor: '#FFFFFF',
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(15,23,42,0.72)',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#0F172A',
          },
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'flex-start' } }}>
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <Typography sx={{ fontWeight: 900, color: '#0F172A', mb: 0.5 }}>Generate Reference</Typography>
            <Typography sx={{ color: '#64748B', fontSize: 13, mb: 2 }}>
              Generate numbers for {clientName || 'this client'} and assign them only to this client after review.
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                mb: 1.5,
                bgcolor: '#F8FAFC',
                borderColor: '#E2E8F0',
                borderRadius: 1,
              }}
            >
              <Typography sx={{ color: '#64748B', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', mb: 0.75 }}>
                Reference Formula
              </Typography>
              <Typography sx={{ color: '#0B1739', fontWeight: 950, fontSize: 28, letterSpacing: 0 }}>
                {formulaReference}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1, mt: 1 }}>
                {[
                  ['Service Type', `${serviceType || 'Trademark'} - ${serviceInitial || 'T'}`],
                  ['Sequence', formulaSequence],
                  ['Assigned ID', assignedId || 'Missing'],
                  ['Country ABB', formulaCountryCode],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ p: 1, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 1 }}>
                    <Typography sx={{ color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                      {label}
                    </Typography>
                    <Typography sx={{ color: assignedId || label !== 'Assigned ID' ? '#0F172A' : '#B91C1C', fontWeight: 900 }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1.4fr 1fr' }, gap: 1.5 }}>
              <Autocomplete
                options={countries}
                value={selectedCountry}
                loading={countriesLoading}
                onChange={(_event, value) => setSelectedCountry(value)}
                getOptionLabel={getCountryLabel}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                renderOption={renderCountryOption}
                renderInput={(params) => <TextField {...params} label="Country" required />}
              />
              <TextField
                select
                label="Service Type"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value as ReferenceServiceType)}
                required
              >
                {SERVICE_TYPES.map((service) => (
                  <MenuItem key={service.label} value={service.label}>
                    {service.label} ({service.code})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="How Many?"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                required
              />
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Button variant="contained" onClick={handleGenerate} disabled={isBusy}>
                {previewLoading ? 'Generating...' : 'Generate Reference'}
              </Button>
              <Button variant="outlined" onClick={handleRegister} disabled={isBusy || previewRows.length === 0}>
                {registerLoading ? 'Assigning...' : 'Assign to Client'}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setPreviewRows([]);
                  setSelectedCountry(null);
                  setServiceType('');
                  setQuantity('1');
                }}
                disabled={isBusy}
              >
                Reset
              </Button>
              <Button variant="outlined" onClick={() => setOldReferenceOpen((current) => !current)} disabled={isBusy}>
                Old Reference
              </Button>
              <Typography sx={{ alignSelf: 'center', color: '#475569', fontSize: 13 }}>
                Format: {formulaReference}
              </Typography>
            </Stack>
            {oldReferenceOpen && (
              <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: '#FFFFFF' }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Add Old Reference</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1.4fr 1fr 1fr' }, gap: 1.25 }}>
                  <TextField
                    label="Old Reference Number"
                    value={oldReferenceNo}
                    onChange={(event) => setOldReferenceNo(event.target.value)}
                    required
                  />
                  <Autocomplete
                    options={countries}
                    value={oldCountry}
                    loading={countriesLoading}
                    onChange={(_event, value) => setOldCountry(value)}
                    getOptionLabel={getCountryLabel}
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    renderOption={renderCountryOption}
                    renderInput={(params) => <TextField {...params} label="Country" required />}
                  />
                  <TextField
                    select
                    label="Service Type"
                    value={oldServiceType}
                    onChange={(event) => setOldServiceType(event.target.value as ReferenceServiceType)}
                    required
                  >
                    {SERVICE_TYPES.map((service) => (
                      <MenuItem key={service.label} value={service.label}>
                        {service.label} ({service.code})
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Sequence"
                    value={oldSequence}
                    onChange={(event) => setOldSequence(event.target.value)}
                    slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
                    required
                  />
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 1.25, justifyContent: 'flex-end' }}>
                  <Button variant="text" onClick={() => setOldReferenceOpen(false)} disabled={oldReferenceLoading}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleRegisterOldReference} disabled={oldReferenceLoading}>
                    {oldReferenceLoading ? 'Saving...' : 'Save Old Reference'}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Box>

          <Paper variant="outlined" sx={{ width: { xs: '100%', lg: 500 }, overflow: 'hidden', borderRadius: 1 }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#0F172A', color: '#FFFFFF' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Preview Table</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 260 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Reference Number</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>Sequence</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={row.referenceNo}>
                      <TableCell sx={{ fontWeight: 800 }}>{row.referenceNo}</TableCell>
                      <TableCell>{row.countryName}</TableCell>
                      <TableCell>{row.sequence}</TableCell>
                      <TableCell>{renderStatus(row.status)}</TableCell>
                    </TableRow>
                  ))}
                  {previewRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 3, textAlign: 'center', color: '#64748B' }}>
                        Generated references will appear here before assigning to this client.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #E2E8F0', bgcolor: '#FFFFFF' }}>
          <Tabs
            value={serviceFilter}
            onChange={(_event, value) => {
              setServiceFilter(value as ReferenceServiceType);
              setServiceType(value as ReferenceServiceType);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 38,
              mb: 1.5,
              borderBottom: '1px solid #E2E8F0',
              '& .MuiTab-root': { minHeight: 38, fontWeight: 800, textTransform: 'none' },
              '& .Mui-selected': { color: '#0B1739' },
              '& .MuiTabs-indicator': { bgcolor: '#0B1739' },
            }}
          >
            {SERVICE_TYPES.map((service) => (
              <Tab key={service.label} value={service.label} label={service.label} />
            ))}
          </Tabs>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            <Autocomplete
              size="small"
              options={countries}
              value={countryFilter}
              onChange={(_event, value) => setCountryFilter(value)}
              getOptionLabel={getCountryLabel}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderOption={renderCountryOption}
              renderInput={(params) => <TextField {...params} label="Country" />}
              sx={{ minWidth: 230 }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All</MenuItem>
              {STATUSES.map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={loadRows} disabled={tableLoading}>Refresh</Button>
            <Button variant="outlined" onClick={() => handleExportExcel().catch(() => setError('Failed to export Excel'))}>Excel</Button>
            <Button variant="outlined" onClick={() => handleExportCsv().catch(() => setError('Failed to export CSV'))}>CSV</Button>
            <Button variant="outlined" onClick={() => handleExportPdf().catch(() => setError('Failed to export PDF'))}>PDF</Button>
            <Button variant="outlined" onClick={() => handlePrint().catch(() => setError('Failed to print'))}>Print</Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
            <Typography sx={{ color: '#64748B', fontSize: 13 }}>{selectedIds.length} selected</Typography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Bulk Status</InputLabel>
              <Select
                label="Bulk Status"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as ReferenceNumberStatus)}
              >
                {STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" disabled={selectedIds.length === 0 || bulkLoading} onClick={handleBulkStatusUpdate}>
              Update Selected
            </Button>
            {isAdmin && (
              <Button color="error" variant="outlined" disabled={selectedIds.length === 0 || bulkLoading} onClick={handleBulkDelete}>
                Bulk Delete
              </Button>
            )}
          </Stack>
        </Box>

        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < rows.length}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                  />
                </TableCell>
                {[
                  ['referenceNo', 'Reference Number'],
                  ['countryName', 'Country'],
                  ['serviceType', 'Service Type'],
                  ['clientName', 'Client Name'],
                  ['assignedId', 'Assigned ID'],
                  ['sequence', 'Sequence'],
                  ['status', 'Status'],
                  ['createdAt', 'Created Date'],
                ].map(([column, label]) => (
                  <TableCell key={column}>
                    {SORTABLE_COLUMNS.includes(column as SortBy) ? (
                      <TableSortLabel
                        active={sortBy === column}
                        direction={sortBy === column ? sortOrder : 'asc'}
                        onClick={() => handleSort(column as SortBy)}
                      >
                        {label}
                      </TableSortLabel>
                    ) : (
                      label
                    )}
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableLoading && (
                <TableRow>
                  <TableCell colSpan={10} sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!tableLoading && rows.map((row) => (
                <TableRow
                  key={row._id}
                  hover
                  sx={{
                    bgcolor:
                      row.status === 'Used'
                        ? '#FFF7ED'
                        : row.status === 'Reserved'
                          ? '#EFF6FF'
                          : row.status === 'Cancelled'
                            ? '#FEF2F2'
                            : 'inherit',
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(row._id)} onChange={() => toggleSelected(row._id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 900, color: '#1D4ED8' }}>{row.referenceNo}</TableCell>
                  <TableCell>{row.countryName}</TableCell>
                  <TableCell>{row.serviceType}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{row.usedByClientName || clientName || '-'}</TableCell>
                  <TableCell>{row.usedByAssignedId || assignedId || '-'}</TableCell>
                  <TableCell>{row.sequence}</TableCell>
                  <TableCell>{renderStatus(row.status)}</TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        select
                        size="small"
                        value={row.status}
                        onChange={(event) =>
                          referenceNumbersService
                            .update(row._id, { status: event.target.value as ReferenceNumberStatus })
                            .then(() => {
                              showSuccessToast('Reference status updated');
                              loadRows();
                            })
                            .catch((err) => setError(getErrorMessage(err, 'Failed to update status')))
                        }
                        sx={{ minWidth: 120 }}
                      >
                        {STATUSES.map((status) => (
                          <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                      </TextField>
                      {isAdmin && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() =>
                            referenceNumbersService
                              .delete(row._id)
                              .then(() => {
                                showSuccessToast('Reference deleted');
                                loadRows();
                              })
                              .catch((err) => setError(getErrorMessage(err, 'Failed to delete reference')))
                          }
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!tableLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                    No reference numbers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Paper>
    </Box>
  );
}
