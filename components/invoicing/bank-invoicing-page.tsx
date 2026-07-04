'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import {
  createBankRecord,
  listInvoicingRecords,
  updateBankRecord,
  updateInvoicingStatus,
} from '@/actions/invoicing-actions';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';
import { bankFormSchema, type BankFormInput } from '@/schemas/invoicing-schema';
import type { BankRecord, InvoicingRecord } from '@/types/invoicing';

const SIDEBAR_COLOR = '#0B1739';
const STATUS_OPTIONS = ['Active', 'Abandon', 'Cancel'] as const;
type BankStatus = (typeof STATUS_OPTIONS)[number];
type DialogMode = 'create' | 'view' | 'edit';
type SortDirection = 'asc' | 'desc';

const defaultForm: BankFormInput = {
  moduleType: 'Bank',
  bankName: '',
  logoUrl: '',
  bankHeader: '',
  bankDescription: '',
  accountName: '',
  accountNumber: '',
  iban: '',
  swift: '',
  currency: 'US$',
};

const isBankRecord = (record: InvoicingRecord): record is BankRecord => 'bankName' in record;

const recordToForm = (record?: BankRecord | null): BankFormInput => {
  if (!record) return defaultForm;
  return {
    moduleType: 'Bank',
    bankName: record.bankName || '',
    logoUrl: record.logoUrl || '',
    bankHeader: record.bankHeader || '',
    bankDescription: record.bankDescription || '',
    accountName: record.accountName || '',
    accountNumber: record.accountNumber || '',
    iban: record.iban || '',
    swift: record.swift || '',
    currency: record.currency || 'US$',
  };
};

const getStatusChipStyles = (status: BankStatus) => {
  if (status === 'Active') return { bgcolor: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' };
  if (status === 'Abandon') return { bgcolor: '#FFEDD5', color: '#C2410C', borderColor: '#FDBA74' };
  return { bgcolor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' };
};

export default function BankInvoicingPage() {
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('bankName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [selected, setSelected] = useState<BankRecord | null>(null);
  const [formData, setFormData] = useState<BankFormInput>(defaultForm);
  const [formError, setFormError] = useState('');
  const [isPending, startTransition] = useTransition();

  const loadRecords = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await listInvoicingRecords({
          moduleType: 'Bank',
          page: page + 1,
          pageSize,
          search,
          sortBy,
          sortDirection,
        });
        setRecords(result.records.filter(isBankRecord));
        setTotal(result.total);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load bank records.');
      }
    });
  }, [page, pageSize, search, sortBy, sortDirection]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const columns = useMemo(
    () => [
      { label: 'Bank Name', key: 'bankName', sortable: true },
      { label: 'Bank Header', key: 'bankHeader', sortable: true },
      { label: 'Account Name', key: 'accountName', sortable: true },
      { label: 'Account Number', key: 'accountNumber', sortable: true },
      { label: 'IBAN', key: 'iban', sortable: true },
      { label: 'SWIFT', key: 'swift', sortable: true },
      { label: 'Currency', key: 'currency', sortable: true },
      { label: 'Status', key: 'status', sortable: true },
      { label: 'Actions', key: 'actions', sortable: false },
    ],
    []
  );

  const openDialog = (mode: DialogMode, record?: BankRecord) => {
    const nextSelected = record || null;
    setSelected(nextSelected);
    setDialogMode(mode);
    setFormData(recordToForm(nextSelected));
    setFormError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelected(null);
    setFormError('');
  };

  const updateForm = <K extends keyof BankFormInput>(key: K, value: BankFormInput[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
    setFormError('');
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please upload an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateForm('logoUrl', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
    setPage(0);
  };

  const handleSubmit = async () => {
    const parsed = bankFormSchema.safeParse({ ...formData, moduleType: 'Bank' });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Please check the form fields.');
      return;
    }

    try {
      if (dialogMode === 'edit' && selected) {
        await updateBankRecord(selected.id, parsed.data);
        showSuccessToast('Bank updated successfully.');
      } else {
        await createBankRecord(parsed.data);
        showSuccessToast('Bank created successfully.');
      }
      closeDialog();
      loadRecords();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save bank.');
    }
  };

  const handleStatusChange = async (record: BankRecord, status: BankStatus) => {
    try {
      await updateInvoicingStatus('Bank', record.id, status);
      showSuccessToast('Bank status updated.');
      loadRecords();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update bank status.');
    }
  };

  const readOnly = dialogMode === 'view';

  return (
    <>
      <Topbar
        title="Bank Registration"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoice' },
          { label: 'Bank Registration' },
        ]}
      />

      <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2.5 }}>
        <Card sx={{ border: '1px solid #E5E7EB', borderRadius: 2, boxShadow: 'none' }}>
          <CardContent
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              pb: '20px !important',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                <Box sx={{ width: 8, height: 28, borderRadius: 1, bgcolor: '#0EA5E9' }} />
                <Typography variant="overline" sx={{ color: '#64748B', fontWeight: 800 }}>
                  Invoicing Registration
                </Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
                Bank Registration
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                label="Search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: { xs: '100%', sm: 280 } }}
              />
              <Button variant="contained" onClick={() => openDialog('create')} sx={{ bgcolor: SIDEBAR_COLOR }}>
                New Bank
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Paper sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', boxShadow: 'none' }}>
          <TableContainer>
            <Table sx={{ minWidth: 1220 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      sx={{ bgcolor: SIDEBAR_COLOR, color: '#fff', fontWeight: 800, whiteSpace: 'nowrap' }}
                    >
                      {column.sortable ? (
                        <TableSortLabel
                          active={sortBy === column.key}
                          direction={sortBy === column.key ? sortDirection : 'asc'}
                          onClick={() => handleSort(column.key)}
                          sx={{
                            color: '#fff !important',
                            '& .MuiTableSortLabel-icon': { color: '#fff !important' },
                          }}
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isPending ? (
                  Array.from({ length: pageSize }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columns.length}>
                        <Skeleton height={26} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Box sx={{ py: 7, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          No bank records found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75 }}>
                          Create the first bank record or adjust your search.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{record.bankName}</TableCell>
                      <TableCell>{record.bankHeader}</TableCell>
                      <TableCell>{record.accountName || '-'}</TableCell>
                      <TableCell>{record.accountNumber || '-'}</TableCell>
                      <TableCell>{record.iban || '-'}</TableCell>
                      <TableCell>{record.swift || '-'}</TableCell>
                      <TableCell>{record.currency || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={record.status}
                          variant="outlined"
                          sx={{ ...getStatusChipStyles(record.status), fontWeight: 800 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Button size="small" variant="outlined" onClick={() => openDialog('view', record)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => openDialog('edit', record)}>
                            Edit
                          </Button>
                          <Select
                            size="small"
                            value={record.status}
                            onChange={(event) => handleStatusChange(record, event.target.value as BankStatus)}
                            sx={{ minWidth: 118 }}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 15, 25, 50]}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setPage(0);
              setPageSize(Number(event.target.value));
            }}
          />
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: SIDEBAR_COLOR, color: '#fff', fontWeight: 800 }}>
          {dialogMode === 'create' ? 'New Bank Registration' : dialogMode === 'edit' ? 'Edit Bank Registration' : 'View Bank Registration'}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#fff', p: 0 }}>
          <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
                gap: 2,
                alignItems: 'center',
                bgcolor: '#F8FAFC',
              }}
            >
              <Box
                sx={{
                  width: 150,
                  height: 88,
                  border: '1px dashed #CBD5E1',
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                {formData.logoUrl ? (
                  <Box
                    component="img"
                    src={formData.logoUrl}
                    alt="Bank logo"
                    sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }}
                  />
                ) : (
                  <Typography sx={{ color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>
                    Bank Logo
                  </Typography>
                )}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                <Button variant="outlined" component="label" disabled={readOnly}>
                  Upload Image
                  <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
                </Button>
                {!readOnly && formData.logoUrl && (
                  <Button variant="text" color="error" onClick={() => updateForm('logoUrl', '')}>
                    Remove
                  </Button>
                )}
              </Stack>
            </Paper>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField
                size="small"
                label="Bank Name"
                disabled={readOnly}
                value={formData.bankName}
                onChange={(event) => updateForm('bankName', event.target.value)}
              />
              <TextField
                size="small"
                label="Bank Header"
                disabled={readOnly}
                value={formData.bankHeader}
                onChange={(event) => updateForm('bankHeader', event.target.value)}
              />
              <TextField
                size="small"
                label="Account Name"
                disabled={readOnly}
                value={formData.accountName}
                onChange={(event) => updateForm('accountName', event.target.value)}
              />
              <TextField
                size="small"
                label="Account Number"
                disabled={readOnly}
                value={formData.accountNumber}
                onChange={(event) => updateForm('accountNumber', event.target.value)}
              />
              <TextField
                size="small"
                label="IBAN"
                disabled={readOnly}
                value={formData.iban}
                onChange={(event) => updateForm('iban', event.target.value)}
              />
              <TextField
                size="small"
                label="SWIFT"
                disabled={readOnly}
                value={formData.swift}
                onChange={(event) => updateForm('swift', event.target.value)}
              />
              <TextField
                size="small"
                label="Currency"
                disabled={readOnly}
                value={formData.currency}
                onChange={(event) => updateForm('currency', event.target.value)}
              />
              <TextField
                size="small"
                label="Bank Description"
                disabled={readOnly}
                value={formData.bankDescription}
                onChange={(event) => updateForm('bankDescription', event.target.value)}
                multiline
                minRows={3}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#fff', p: 2 }}>
          <Button variant="outlined" color="inherit" onClick={closeDialog}>
            Close
          </Button>
          {!readOnly && (
            <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: SIDEBAR_COLOR }}>
              {dialogMode === 'edit' ? 'Update' : 'Create'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
