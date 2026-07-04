'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
  createServiceRecord,
  listInvoicingRecords,
  listUsedAiptReferenceIds,
  updateInvoicingStatus,
  updateServiceRecord,
} from '@/actions/invoicing-actions';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';
import {
  serviceApplicationFormSchema,
  type ServiceApplicationFormInput,
} from '@/schemas/invoicing-schema';
import { clientsService, type Client } from '@/services/clients.service';
import { countriesService, type Country } from '@/services/countries.service';
import { referenceNumbersService, type ReferenceNumber } from '@/services/reference-numbers.service';
import type {
  InvoicingRecord,
  ServiceApplicationRecord,
  ServiceModuleType,
} from '@/types/invoicing';

const SIDEBAR_COLOR = '#0B1739';
const STATUS_OPTIONS = ['Active', 'Abandon', 'Cancel'] as const;
type RegistrationStatus = (typeof STATUS_OPTIONS)[number];
type SortDirection = 'asc' | 'desc';
type DialogMode = 'create' | 'view' | 'edit';

const REFERENCE_SERVICE_MAP: Record<ServiceModuleType, ReferenceNumber['serviceType']> = {
  Trademark: 'Trademark',
  Patent: 'Patent',
  Design: 'Design',
  Litigation: 'Litigation',
  Copyright: 'Copyright',
  Others: 'Other',
};

const MODULE_COPY: Record<ServiceModuleType, { title: string; accent: string }> = {
  Trademark: { title: 'Trademark Registration', accent: '#2563EB' },
  Patent: { title: 'Patent Registration', accent: '#16A34A' },
  Design: { title: 'Design Registration', accent: '#7C3AED' },
  Litigation: { title: 'Litigation Registration', accent: '#DC2626' },
  Copyright: { title: 'Copyright Registration', accent: '#0891B2' },
  Others: { title: 'Others Registration', accent: '#475569' },
};

const defaultForm = (moduleType: ServiceModuleType): ServiceApplicationFormInput => ({
  moduleType,
  clientId: '',
  countryId: '',
  aiptReferenceId: '',
  aiptReference: '',
  classNo: moduleType === 'Trademark' ? 1 : undefined,
  filingNumber: '',
  applicationName: '',
  allowDuplicateFilingNumber: false,
  markImage: '',
});

const recordToForm = (
  moduleType: ServiceModuleType,
  record?: ServiceApplicationRecord | null
): ServiceApplicationFormInput => {
  if (!record) return defaultForm(moduleType);

  return {
    moduleType,
    clientId: record.clientId,
    countryId: record.countryId,
    aiptReferenceId: record.aiptReferenceId || '',
    aiptReference: record.aiptReference || '',
    classNo: record.classNo || (moduleType === 'Trademark' ? 1 : undefined),
    filingNumber: record.filingNumber || '',
    applicationName: record.applicationName,
    allowDuplicateFilingNumber: moduleType === 'Trademark' && record.allowDuplicateFilingNumber,
    markImage: record.markImage || '',
  };
};

const isServiceRecord = (record: InvoicingRecord): record is ServiceApplicationRecord =>
  'applicationName' in record;

const getClientLabel = (client: Client) => {
  const name = client.companyName?.trim() || client.name?.trim() || 'Unnamed Client';
  return client.assignedId ? `${name} - ${client.assignedId}` : name;
};

const getCountryLabel = (country: Country) =>
  country.abbreviation ? `${country.name} (${country.abbreviation})` : country.name;

const renderCountryOption = (props: React.HTMLAttributes<HTMLLIElement> & { key: React.Key }, country: Country) => {
  const { key: _key, ...optionProps } = props;
  return (
    <li key={country._id} {...optionProps}>
      {getCountryLabel(country)}
    </li>
  );
};

const getStatusChipStyles = (status: RegistrationStatus) => {
  if (status === 'Active') return { bgcolor: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' };
  if (status === 'Abandon') return { bgcolor: '#FFEDD5', color: '#C2410C', borderColor: '#FDBA74' };
  return { bgcolor: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1' };
};

const normalizeText = (value?: string | null) => String(value || '').trim().toLowerCase();

export default function InvoicingModulePage({ moduleType }: { moduleType: ServiceModuleType }) {
  const { title, accent } = MODULE_COPY[moduleType];
  const [records, setRecords] = useState<ServiceApplicationRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [references, setReferences] = useState<ReferenceNumber[]>([]);
  const [usedReferenceIds, setUsedReferenceIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceApplicationRecord | null>(null);
  const [formData, setFormData] = useState<ServiceApplicationFormInput>(() => defaultForm(moduleType));
  const [formError, setFormError] = useState('');
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [markImagePreview, setMarkImagePreview] = useState('');
  const [isPending, startTransition] = useTransition();

  const selectedClient = clients.find((client) => client._id === formData.clientId) || null;
  const selectedCountry = countries.find((country) => country._id === formData.countryId) || null;
  const selectedReference = references.find((reference) => reference._id === formData.aiptReferenceId) || null;
  const selectedClass =
    typeof formData.classNo === 'number'
      ? Array.from({ length: 45 }, (_, index) => index + 1).find((value) => value === formData.classNo) || null
      : null;

  const currentReferenceId = selected?.aiptReferenceId || '';
  const visibleReferences = useMemo(
    () =>
      references.filter((reference) => {
        if (reference._id === currentReferenceId) return true;
        return !usedReferenceIds.has(reference._id);
      }),
    [currentReferenceId, references, usedReferenceIds]
  );

  const loadRecords = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await listInvoicingRecords({
          moduleType,
          search,
          page: page + 1,
          pageSize,
          sortBy,
          sortDirection,
        });
        setRecords(result.records.filter(isServiceRecord));
        setTotal(result.total);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : `Failed to load ${title}.`);
      }
    });
  }, [moduleType, page, pageSize, search, sortBy, sortDirection, title]);

  const refreshUsedReferences = useCallback(
    async (excludeId?: string) => {
      const ids = await listUsedAiptReferenceIds(moduleType, excludeId);
      setUsedReferenceIds(new Set(ids));
    },
    [moduleType]
  );

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        setLookupsLoading(true);
        const [clientResponse, countryResponse] = await Promise.all([
          clientsService.list({ page: 1, limit: 1000, all: true }),
          countriesService.listAll(),
          refreshUsedReferences(),
        ]);

        if (!mounted) return;
        setClients(clientResponse.clients || []);
        setCountries(countryResponse || []);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load dropdown data.');
      } finally {
        if (mounted) setLookupsLoading(false);
      }
    }

    loadLookups();
    return () => {
      mounted = false;
    };
  }, [refreshUsedReferences]);

  useEffect(() => {
    let mounted = true;

    async function loadReferences() {
      if (!formData.clientId || !formData.countryId) {
        setReferences([]);
        return;
      }

      try {
        setReferencesLoading(true);
        const response = await referenceNumbersService.listAvailable({
          clientId: formData.clientId,
          countryId: formData.countryId,
          serviceType: REFERENCE_SERVICE_MAP[moduleType],
          limit: 200,
        });

        if (!mounted) return;
        const current =
          selected?.aiptReferenceId && selected?.aiptReference
            ? [
                {
                  _id: selected.aiptReferenceId,
                  referenceNo: selected.aiptReference,
                  countryId: selected.countryId,
                  countryName: selected.countryName,
                  countryCode: '',
                  serviceType: REFERENCE_SERVICE_MAP[moduleType],
                  serviceCode: '',
                  sequence: 0,
                  status: 'Used' as const,
                  usedBy: selected.clientId,
                  createdAt: selected.createdAt,
                  updatedAt: selected.updatedAt,
                },
              ]
            : [];

        const merged = [...current, ...(response.referenceNumbers || [])].filter(
          (reference, index, all) => all.findIndex((item) => item._id === reference._id) === index
        );
        setReferences(merged);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load AIPT references.');
      } finally {
        if (mounted) setReferencesLoading(false);
      }
    }

    loadReferences();
    return () => {
      mounted = false;
    };
  }, [formData.clientId, formData.countryId, moduleType, selected]);

  const updateForm = <K extends keyof ServiceApplicationFormInput>(
    key: K,
    value: ServiceApplicationFormInput[K]
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
    setFormError('');
  };

  const openDialog = (mode: DialogMode, record?: ServiceApplicationRecord) => {
    const nextSelected = record || null;
    setSelected(nextSelected);
    setDialogMode(mode);
    setFormData(recordToForm(moduleType, nextSelected));
    setMarkImagePreview(nextSelected?.markImage || '');
    setFormError('');
    setDialogOpen(true);
    refreshUsedReferences(nextSelected?.id).catch(() => undefined);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelected(null);
    setFormError('');
  };

  const validateDuplicates = () => {
    const duplicateReference = records.find(
      (record) => record.aiptReferenceId === formData.aiptReferenceId && record.id !== selected?.id
    );
    if (duplicateReference) return 'This AIPT Reference is already used.';

    const filing = normalizeText(formData.filingNumber);
    const duplicateFiling = records.find(
      (record) => normalizeText(record.filingNumber) === filing && record.id !== selected?.id
    );
    if (duplicateFiling && !(moduleType === 'Trademark' && formData.allowDuplicateFilingNumber)) {
      return 'Filing number already exists. Enable duplicate filing number to continue.';
    }

    return '';
  };

  const handleSubmit = async () => {
    const parsed = serviceApplicationFormSchema.safeParse({
      ...formData,
      moduleType,
      allowDuplicateFilingNumber: moduleType === 'Trademark' && formData.allowDuplicateFilingNumber,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Please check the form fields.');
      return;
    }

    const duplicateError = validateDuplicates();
    if (duplicateError) {
      setFormError(duplicateError);
      return;
    }

    try {
      if (dialogMode === 'edit' && selected) {
        await updateServiceRecord(selected.id, parsed.data);
        showSuccessToast(`${title} updated successfully.`);
      } else {
        await createServiceRecord(parsed.data);
        showSuccessToast(`${title} created successfully.`);
      }
      closeDialog();
      await refreshUsedReferences();
      loadRecords();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Failed to save ${title}.`);
    }
  };

  const handleStatusChange = async (record: ServiceApplicationRecord, status: RegistrationStatus) => {
    try {
      await updateInvoicingStatus(moduleType, record.id, status);
      showSuccessToast('Status updated.');
      await refreshUsedReferences();
      loadRecords();
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update status.');
    }
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

  const columns = [
    { label: 'Client', key: 'clientName', sortable: false },
    { label: 'Country', key: 'countryName', sortable: false },
    { label: 'AIPT Reference', key: 'aiptReference', sortable: true },
    ...(moduleType === 'Trademark' ? [{ label: 'Class', key: 'classNo', sortable: true }] : []),
    { label: 'Filing Number', key: 'filingNumber', sortable: true },
    { label: 'Application Name', key: 'applicationName', sortable: true },
    { label: 'Status', key: 'status', sortable: false },
    ...(moduleType === 'Trademark' ? [{ label: 'Image', key: 'markImage', sortable: false }] : []),
    { label: 'Actions', key: 'actions', sortable: false },
  ];

  const readOnly = dialogMode === 'view';
  const referencesDisabled = readOnly || !formData.clientId || !formData.countryId;
  const classOptions = Array.from({ length: 45 }, (_, index) => index + 1);

  return (
    <>
      <Topbar
        title={title}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoice' },
          { label: title },
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
                <Box sx={{ width: 8, height: 28, borderRadius: 1, bgcolor: accent }} />
                <Typography variant="overline" sx={{ color: '#64748B', fontWeight: 800 }}>
                  Invoicing Registration
                </Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
                {title}
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
                New Registration
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Paper sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', boxShadow: 'none' }}>
          <TableContainer>
            <Table sx={{ minWidth: moduleType === 'Trademark' ? 1280 : 1120 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      sx={{
                        bgcolor: SIDEBAR_COLOR,
                        color: '#fff',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
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
                          No registrations found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748B', mt: 0.75 }}>
                          Create the first record or adjust your search.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{record.clientName}</TableCell>
                      <TableCell>{record.countryName}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{record.aiptReference || '-'}</TableCell>
                      {moduleType === 'Trademark' && <TableCell>{record.classNo || '-'}</TableCell>}
                      <TableCell>{record.filingNumber || '-'}</TableCell>
                      <TableCell>{record.applicationName}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={record.status}
                          variant="outlined"
                          sx={{ ...getStatusChipStyles(record.status), fontWeight: 800 }}
                        />
                      </TableCell>
                      {moduleType === 'Trademark' && (
                        <TableCell>
                          {record.markImage?.startsWith('data:image') ? (
                            <Box
                              component="img"
                              src={record.markImage}
                              alt="Trademark"
                              sx={{
                                width: 58,
                                height: 58,
                                objectFit: 'contain',
                                border: '1px solid #E2E8F0',
                                borderRadius: 1,
                                bgcolor: '#fff',
                              }}
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
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
                            onChange={(event) => handleStatusChange(record, event.target.value as RegistrationStatus)}
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
          {dialogMode === 'create' ? `New ${title}` : dialogMode === 'edit' ? `Edit ${title}` : `View ${title}`}
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#F8FAFC' }}>
          <Box sx={{ p: 3, display: 'grid', gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Autocomplete
                size="small"
                disabled={readOnly || lookupsLoading}
                options={clients}
                value={selectedClient}
                getOptionLabel={getClientLabel}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                onChange={(_, value) => {
                  updateForm('clientId', value?._id || '');
                  updateForm('aiptReferenceId', '');
                  updateForm('aiptReference', '');
                }}
                renderInput={(params) => <TextField {...params} label="Client" />}
              />

              <Autocomplete
                size="small"
                disabled={readOnly || lookupsLoading}
                options={countries}
                value={selectedCountry}
                getOptionLabel={getCountryLabel}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                renderOption={renderCountryOption}
                onChange={(_, value) => {
                  updateForm('countryId', value?._id || '');
                  updateForm('aiptReferenceId', '');
                  updateForm('aiptReference', '');
                }}
                renderInput={(params) => <TextField {...params} label="Country" />}
              />

              <Autocomplete
                size="small"
                disabled={referencesDisabled || referencesLoading}
                options={visibleReferences}
                value={selectedReference}
                getOptionLabel={(option) => option.referenceNo || ''}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                onChange={(_, value) => {
                  updateForm('aiptReferenceId', value?._id || '');
                  updateForm('aiptReference', value?.referenceNo || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="AIPT Reference"
                    helperText={!formData.clientId || !formData.countryId ? 'Select client and country first.' : ''}
                  />
                )}
              />

              {moduleType === 'Trademark' && (
                <Autocomplete
                  size="small"
                  disabled={readOnly}
                  options={classOptions}
                  value={selectedClass}
                  getOptionLabel={(option) => String(option)}
                  onChange={(_, value) => updateForm('classNo', value || undefined)}
                  renderInput={(params) => <TextField {...params} label="Class" />}
                />
              )}

              <TextField
                size="small"
                label="Filing Number"
                disabled={readOnly}
                value={formData.filingNumber || ''}
                onChange={(event) => updateForm('filingNumber', event.target.value)}
              />

              <TextField
                size="small"
                label="Application Name"
                disabled={readOnly}
                value={formData.applicationName}
                onChange={(event) => updateForm('applicationName', event.target.value)}
              />
            </Box>

            {moduleType === 'Trademark' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  size="small"
                  label="Image"
                  disabled={readOnly}
                  type="file"
                  slotProps={{
                    htmlInput: { accept: 'image/*' },
                    inputLabel: { shrink: true },
                  }}
                  onChange={(event) => {
                    const input = event.target as HTMLInputElement;
                    const file = input.files?.[0];
                    if (!file) {
                      updateForm('markImage', '');
                      setMarkImagePreview('');
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = typeof reader.result === 'string' ? reader.result : '';
                      updateForm('markImage', result);
                      setMarkImagePreview(result);
                    };
                    reader.readAsDataURL(file);
                  }}
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      disabled={readOnly}
                      checked={Boolean(formData.allowDuplicateFilingNumber)}
                      onChange={(event) => updateForm('allowDuplicateFilingNumber', event.target.checked)}
                    />
                  }
                  label="Allow Duplicate Filing Number"
                />

                {markImagePreview && (
                  <Box
                    component="img"
                    src={markImagePreview}
                    alt="Trademark preview"
                    sx={{
                      width: 140,
                      height: 140,
                      objectFit: 'contain',
                      border: '1px solid #E2E8F0',
                      borderRadius: 1,
                      bgcolor: '#fff',
                    }}
                  />
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#fff' }}>
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
