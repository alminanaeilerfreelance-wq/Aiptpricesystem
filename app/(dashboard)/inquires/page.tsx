'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  IconButton,
  Tooltip,
  SvgIcon,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import inquiresService, { Inquire } from '@/services/inquires.service';
import { servicesService, Service } from '@/services/services.service';
import { proceduresService, Procedure } from '@/services/procedures.service';
import { countriesService, Country } from '@/services/countries.service';
import { clientsService, Client } from '@/services/clients.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface InquireFormData {
  inquiryDate: string;
  serviceId: string;
  procedureIds: string[];
  countryIds: string[];
  clientId: string;
  remarks: string;
}

type InquireFormErrors = Partial<Record<keyof InquireFormData, string>>;

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const defaultReferenceSerial = '00001';

const defaultFormData: InquireFormData = {
  inquiryDate: getTodayIso(),
  serviceId: '',
  procedureIds: [],
  countryIds: [],
  clientId: '',
  remarks: '',
};

const FETCH_BATCH_SIZE = 500;

const loadAllPages = async <T,>(
  fetchPage: (page: number, limit: number) => Promise<{ total?: number; totalPages?: number; [key: string]: unknown }>,
  dataKey: string,
  pageSize = 100
): Promise<T[]> => {
  const collected: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await fetchPage(page, pageSize);
    const pageRows = (Array.isArray(response[dataKey]) ? response[dataKey] : []) as T[];
    collected.push(...pageRows);

    if (page === 1) {
      totalPages =
        typeof response.totalPages === 'number' && response.totalPages > 0
          ? response.totalPages
          : Math.ceil(Number(response.total || 0) / pageSize) || 1;
    }

    page += 1;
  }

  return collected;
};

const SERVICE_COLOR_MAP: Record<string, string> = {
  trademark: '#2563EB',
  patent: '#16A34A',
  design: '#9333EA',
  copyright: '#F59E0B',
  litigation: '#DC2626',
};

const normalizeCategory = (value: string): string => value.trim().toLowerCase();

const getServiceCategory = (item: Inquire): string =>
  typeof item.serviceId === 'string' ? '' : item.serviceId?.category || '';

const getServiceColor = (category: string): string | undefined =>
  SERVICE_COLOR_MAP[normalizeCategory(category)];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toObjectIdString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toString?: unknown }).toString === 'function'
  ) {
    const raw = String((value as { toString: () => string }).toString());
    if (/^[a-fA-F0-9]{24}$/.test(raw)) {
      return raw;
    }
  }
  if (!isRecord(value)) return '';

  const directId = value._id;
  if (typeof directId === 'string') return directId;
  if (isRecord(directId) && typeof directId.toString === 'function') {
    return directId.toString();
  }

  const genericId = value.id;
  if (typeof genericId === 'string') return genericId;
  return '';
};

const EyeIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 5c-5 0-9.27 3.11-11 7c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7m0 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8m0-2.5A1.5 1.5 0 1 0 12 10a1.5 1.5 0 0 0 0 3.5"
    />
  </SvgIcon>
);

const NoteIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M3 17.25V21h3.75l11-11l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z"
    />
  </SvgIcon>
);

const TrashIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M9 3h6l1 2h4v2H4V5h4zm1 6h2v9h-2zm4 0h2v9h-2zM7 9h2v9H7zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2"
    />
  </SvgIcon>
);

const toServiceId = (value: Inquire['serviceId']) =>
  typeof value === 'string' ? value : value?._id || '';
const toProcedureIds = (item: Inquire) => {
  if (Array.isArray(item.procedureIds) && item.procedureIds.length > 0) {
    return item.procedureIds.map((procedure) => toObjectIdString(procedure)).filter(Boolean);
  }
  const fallback = toObjectIdString(item.procedureId);
  return fallback ? [fallback] : [];
};
const toClientId = (value: Inquire['clientId']) =>
  typeof value === 'string' ? value : value?._id || '';
const toCountryIds = (value: Inquire['countryIds']) =>
  Array.isArray(value) ? value.map((item) => toObjectIdString(item)).filter(Boolean) : [];

const getServiceLabel = (item: Inquire) =>
  typeof item.serviceId === 'string'
    ? item.serviceId
    : `${item.serviceId.name} (${item.serviceId.category})`;

const getProcedureNameFromId = (
  procedureId: string,
  procedureById?: Map<string, Procedure>
) => {
  const matched = procedureById?.get(procedureId);
  if (!matched) return procedureId;
  return `${matched.name}${matched.countryName ? ` (${matched.countryName})` : ''}`;
};

const getProcedureLabel = (item: Inquire, procedureById?: Map<string, Procedure>) => {
  const list =
    Array.isArray(item.procedureIds) && item.procedureIds.length > 0
      ? item.procedureIds
      : item.procedureId
        ? [item.procedureId]
        : [];

  return list
    .map((procedure) => {
      if (typeof procedure === 'string') {
        return getProcedureNameFromId(procedure, procedureById);
      }

      const procedureName = (procedure?.name || '').trim();
      if (procedureName) {
        return `${procedureName}${procedure?.countryName ? ` (${procedure.countryName})` : ''}`;
      }

      const fallbackId = toObjectIdString(procedure);
      return fallbackId ? getProcedureNameFromId(fallbackId, procedureById) : '';
    })
    .filter(Boolean)
    .join(', ');
};

const getClientLabel = (item: Inquire) =>
  typeof item.clientId === 'string'
    ? item.clientId
    : item.clientId.companyName
      ? `${item.clientId.name} (${item.clientId.companyName})`
      : item.clientId.name;

const getCountryLabel = (item: Inquire) =>
  Array.isArray(item.countryIds)
    ? item.countryIds
        .map((country) =>
          typeof country === 'string'
            ? country
            : `${country.abbreviation}${country.name ? ` (${country.name})` : ''}`
        )
        .join(', ')
    : '';

export default function InquiresPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Inquire[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const [services, setServices] = useState<Service[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [referenceSerial, setReferenceSerial] = useState(defaultReferenceSerial);
  const [formData, setFormData] = useState<InquireFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<InquireFormErrors>({});

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Inquire | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchItems = useCallback(
    async (params?: { nextSearch?: string }) => {
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      try {
        setLoading(true);
        setError('');
        const allRows: Inquire[] = [];
        let nextPage = 1;
        let totalPages = 1;

        while (nextPage <= totalPages) {
          const response = await inquiresService.list({
            page: nextPage,
            limit: FETCH_BATCH_SIZE,
            search: nextSearch || undefined,
          });

          const currentRows = Array.isArray(response.inquires) ? response.inquires : [];
          allRows.push(...currentRows);

          if (nextPage === 1) {
            totalPages =
              typeof response.totalPages === 'number' && response.totalPages > 0
                ? response.totalPages
                : Math.ceil((response.total || 0) / FETCH_BATCH_SIZE);
          }

          nextPage += 1;
        }

        setItems(allRows);
        setTotal(allRows.length);
        return allRows.length;
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load inquires');
        setItems([]);
        setTotal(0);
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch]
  );

  const loadLookups = useCallback(async () => {
    const [allServices, allProcedures, allCountries, allClients] = await Promise.all([
      loadAllPages<Service>(
        (nextPage, nextLimit) => servicesService.list({ page: nextPage, limit: nextLimit }) as Promise<{ services?: Service[]; total?: number; totalPages?: number }>,
        'services'
      ),
      loadAllPages<Procedure>(
        (nextPage, nextLimit) => proceduresService.list({ page: nextPage, limit: nextLimit }) as Promise<{ procedures?: Procedure[]; total?: number; totalPages?: number }>,
        'procedures'
      ),
      loadAllPages<Country>(
        (nextPage, nextLimit) => countriesService.list({ page: nextPage, limit: nextLimit }) as Promise<{ countries?: Country[]; total?: number; totalPages?: number }>,
        'countries'
      ),
      loadAllPages<Client>(
        (nextPage, nextLimit) => clientsService.list({ page: nextPage, limit: nextLimit }) as Promise<{ clients?: Client[]; total?: number; totalPages?: number }>,
        'clients'
      ),
    ]);

    const normalizedServices = allServices.filter((item) => item.isActive);
    const normalizedProcedures = allProcedures.filter((item) => item.isActive);
    const normalizedCountries = allCountries.filter((item) => item.isActive);
    const normalizedClients = allClients.filter((item) => item.isActive);

    setServices(normalizedServices.sort((a, b) => a.name.localeCompare(b.name)));
    setProcedures(normalizedProcedures.sort((a, b) => a.name.localeCompare(b.name)));
    setCountries(normalizedCountries.sort((a, b) => a.name.localeCompare(b.name)));
    setClients(normalizedClients.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    fetchItems({ nextSearch: debouncedSearch }).catch(() => undefined);
  }, [debouncedSearch, fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    loadLookups().catch(() => {
      setServices([]);
      setProcedures([]);
      setCountries([]);
      setClients([]);
    });
  }, [loadLookups]);

  const selectedService = useMemo(
    () => services.find((service) => service._id === formData.serviceId) || null,
    [formData.serviceId, services]
  );

  const filteredProcedures = useMemo(() => {
    if (!selectedService) return procedures;
    return procedures.filter(
      (procedure) =>
        normalizeCategory(procedure.serviceCategory) === normalizeCategory(selectedService.category)
    );
  }, [procedures, selectedService]);

  const procedureById = useMemo(
    () => new Map(procedures.map((procedure) => [procedure._id, procedure])),
    [procedures]
  );
  const countryById = useMemo(
    () => new Map(countries.map((country) => [country._id, country])),
    [countries]
  );

  const selectedCountries = useMemo(
    () =>
      formData.countryIds
        .map((countryId) => countryById.get(countryId))
        .filter((country): country is Country => Boolean(country)),
    [countryById, formData.countryIds]
  );
  const selectedProcedures = useMemo(
    () =>
      formData.procedureIds
        .map((procedureId) => procedureById.get(procedureId))
        .filter((procedure): procedure is Procedure => Boolean(procedure)),
    [formData.procedureIds, procedureById]
  );
  const procedureCartIds = useMemo(
    () => Array.from(new Set(formData.procedureIds.filter(Boolean))),
    [formData.procedureIds]
  );

  const referencePreview = useMemo(() => {
    const countryCodes = selectedCountries
      .map((country) => country.abbreviation?.trim().toUpperCase())
      .filter(Boolean)
      .join('/');

    if (!editingId) {
      return countryCodes ? `Auto (${countryCodes})` : 'Auto-generated on save';
    }

    return `${referenceSerial}${countryCodes || 'COUNTRY'}`;
  }, [editingId, referenceSerial, selectedCountries]);

  const resetForm = () => {
    setEditingId(null);
    setReferenceSerial(defaultReferenceSerial);
    setFormErrors({});
    setFormData({
      ...defaultFormData,
      inquiryDate: getTodayIso(),
    });
  };

  const handleAdd = () => {
    resetForm();
    setError('');
    setOpenForm(true);
  };

  const handleEdit = (item: Inquire) => {
    const serialFromReference =
      typeof item.referenceNo === 'string' && /^\d{5}/.test(item.referenceNo)
        ? item.referenceNo.slice(0, 5)
        : defaultReferenceSerial;

    setEditingId(item._id);
    setReferenceSerial(serialFromReference);
    setFormErrors({});
    setError('');
    setFormData({
      inquiryDate: new Date(item.inquiryDate).toISOString().slice(0, 10),
      serviceId: toServiceId(item.serviceId),
      procedureIds: toProcedureIds(item),
      countryIds: toCountryIds(item.countryIds),
      clientId: toClientId(item.clientId),
      remarks: item.remarks || '',
    });
    setOpenForm(true);
  };

  const handleView = (item: Inquire) => {
    setViewingItem(item);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    const errors: InquireFormErrors = {};

    if (!formData.inquiryDate) {
      errors.inquiryDate = 'Date is required';
    } else {
      const parsedDate = new Date(formData.inquiryDate);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.inquiryDate = 'Date is invalid';
      }
    }

    if (!formData.serviceId) {
      errors.serviceId = 'Service is required';
    }

    if (procedureCartIds.length === 0) {
      errors.procedureIds = 'At least one procedure is required';
    }

    if (formData.countryIds.length === 0) {
      errors.countryIds = 'At least one country is required';
    }

    if (!formData.clientId) {
      errors.clientId = 'Client is required';
    }

    if (formData.remarks.trim().length > 1000) {
      errors.remarks = 'Remarks must be at most 1000 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRemoveProcedureFromCart = (procedureId: string) => {
    setFormData((prev) => ({
      ...prev,
      procedureIds: prev.procedureIds.filter((id) => id !== procedureId),
    }));
    clearFormError('procedureIds');
  };

  const clearFormError = (field: keyof InquireFormData) => {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) {
      setError('Please complete all required fields');
      return;
    }

    const uniqueProcedureIds = procedureCartIds;
    const uniqueCountryIds = Array.from(new Set(formData.countryIds));

    if (uniqueProcedureIds.length === 0) {
      setError('At least one procedure is required');
      return;
    }

    if (uniqueCountryIds.length === 0) {
      setError('At least one country is required');
      return;
    }

    const payload = {
      inquiryDate: formData.inquiryDate,
      serviceId: formData.serviceId,
      procedureIds: uniqueProcedureIds,
      countryIds: uniqueCountryIds,
      clientId: formData.clientId,
      remarks: formData.remarks.trim() || undefined,
    };

    try {
      setLoading(true);
      setError('');
      if (editingId) {
        await inquiresService.update(editingId, payload);
        showSuccessToast('Inquire updated successfully');
      } else {
        await inquiresService.create(payload);
        showSuccessToast('Inquire created successfully');
      }

      handleCloseForm();
      setPage(1);
      await fetchItems({ nextSearch: debouncedSearch });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save inquire');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await inquiresService.delete(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      const nextCount = await fetchItems({ nextSearch: debouncedSearch });
      const totalPages = Math.max(1, Math.ceil(nextCount / limit));
      if (page > totalPages) {
        setPage(totalPages);
      }
      showSuccessToast('Inquire deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete inquire');
    } finally {
      setLoading(false);
    }
  };

  const columns: MuiDataTableColumn<Inquire>[] = [
    {
      id: 'inquiryDate',
      label: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.inquiryDate).getTime(),
      searchValue: (row) => new Date(row.inquiryDate).toISOString().slice(0, 10),
      render: (row) => new Date(row.inquiryDate).toLocaleDateString(),
    },
    {
      id: 'referenceNo',
      label: 'Reference Auto',
      sortable: true,
      minWidth: 160,
      searchValue: (row) => row.referenceNo || '',
      render: (row) => <Typography sx={{ color: '#7E57C2', fontWeight: 700 }}>{row.referenceNo}</Typography>,
    },
    {
      id: 'serviceId',
      label: 'Service',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => getServiceLabel(row),
      render: (row) => {
        const category = getServiceCategory(row);
        const color = getServiceColor(category);
        const label = getServiceLabel(row);
        if (!color) return label;
        return (
          <Box
            component="span"
            sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: 999,
              color,
              bgcolor: `${color}1A`,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {label}
          </Box>
        );
      },
    },
    {
      id: 'procedureIds',
      label: 'Procedure',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => getProcedureLabel(row, procedureById),
      render: (row) => getProcedureLabel(row, procedureById) || '-',
    },
    {
      id: 'countryIds',
      label: 'Country',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => getCountryLabel(row),
      render: (row) => getCountryLabel(row) || '-',
    },
    {
      id: 'clientId',
      label: 'Client',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => getClientLabel(row),
      render: (row) => getClientLabel(row),
    },
    {
      id: 'remarks',
      label: 'Remarks',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => row.remarks || '',
      render: (row) => row.remarks || '-',
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={() => handleView(row)}
              sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleEdit(row)}
              sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}
            >
              <NoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteClick(row._id)}
              sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}
            >
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (!mounted) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Inquires" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button variant="contained" onClick={handleAdd}>
          + Add Inquire
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No inquires found"
          description="Start by creating your first inquire"
          onAction={handleAdd}
          actionLabel="Add Inquire"
        />
      ) : (
        !loading && (
          <MuiDataTable
            rows={items}
            columns={columns}
            rowKey={(row) => row._id}
            page={page}
            rowsPerPage={limit}
            total={total}
            onPageChange={setPage}
            onRowsPerPageChange={(nextRowsPerPage) => {
              setLimit(nextRowsPerPage);
              setPage(1);
            }}
            rowsPerPageOptions={[10, 25, 50, 100, 500]}
            searchTerm={search}
            onSearchTermChange={(nextSearch) => {
              setSearch(nextSearch);
              setPage(1);
            }}
            searchPlaceholder="Search date, reference, service, procedure, country, client, remarks..."
            showToolbar
            loading={false}
          />
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Inquire' : 'Add Inquire'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={formData.inquiryDate}
                  onChange={(event) => {
                    setFormData((prev) => ({ ...prev, inquiryDate: event.target.value }));
                    clearFormError('inquiryDate');
                  }}
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={Boolean(formErrors.inquiryDate)}
                  helperText={formErrors.inquiryDate}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Reference Auto"
                  value={referencePreview}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
            </Grid>

            <Autocomplete
              options={services}
              value={services.find((service) => service._id === formData.serviceId) || null}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionKey={(option) => option._id}
              getOptionLabel={(option) => `${option.name} (${option.category})`}
              onChange={(_, value) => {
                setFormData((prev) => ({
                  ...prev,
                  serviceId: value?._id || '',
                  procedureIds: [],
                }));
                clearFormError('serviceId');
                clearFormError('procedureIds');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Service *"
                  error={Boolean(formErrors.serviceId)}
                  helperText={formErrors.serviceId}
                />
              )}
            />

            <Autocomplete
              multiple
              disableCloseOnSelect
              filterSelectedOptions
              options={filteredProcedures}
              value={selectedProcedures}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionKey={(option) => option._id}
              getOptionLabel={(option) =>
                `${option.name} (${option.countryName || option.serviceCategory})`
              }
              disabled={!selectedService}
              onChange={(_, value) => {
                setFormData((prev) => ({
                  ...prev,
                  procedureIds: value.map((item) => item._id),
                }));
                clearFormError('procedureIds');
              }}
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  {option.name} ({option.countryName || option.serviceCategory})
                </li>
              )}
              noOptionsText={
                selectedService ? 'No procedures found for this service' : 'Select a service first'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Procedure (Multi-select) *"
                  error={Boolean(formErrors.procedureIds)}
                  helperText={formErrors.procedureIds}
                />
              )}
            />

            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                bgcolor: '#FAFAFA',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Procedure Cart ({selectedProcedures.length})
              </Typography>

              {selectedProcedures.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Select two or more procedures to add them to the cart.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedProcedures.map((procedure) => (
                    <Box
                      key={procedure._id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        px: 1.5,
                        py: 1,
                        bgcolor: '#FFFFFF',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {procedure.name} ({procedure.countryName || procedure.serviceCategory})
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveProcedureFromCart(procedure._id)}
                        sx={{
                          bgcolor: 'error.main',
                          color: 'error.contrastText',
                          '&:hover': { bgcolor: 'error.dark' },
                        }}
                      >
                        <TrashIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Autocomplete
              multiple
              disableCloseOnSelect
              filterSelectedOptions
              options={countries}
              value={selectedCountries}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionKey={(option) => option._id}
              getOptionLabel={(option) => `${option.abbreviation} - ${option.name}`}
              onChange={(_, value) => {
                setFormData((prev) => ({
                  ...prev,
                  countryIds: value.map((item) => item._id),
                }));
                clearFormError('countryIds');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Country (Multi-select) *"
                  error={Boolean(formErrors.countryIds)}
                  helperText={formErrors.countryIds}
                />
              )}
            />

            <Autocomplete
              options={clients}
              value={clients.find((client) => client._id === formData.clientId) || null}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionKey={(option) => option._id}
              getOptionLabel={(option) =>
                option.companyName
                  ? `${option.name} (${option.companyName})`
                  : option.name
              }
              onChange={(_, value) => {
                setFormData((prev) => ({
                  ...prev,
                  clientId: value?._id || '',
                }));
                clearFormError('clientId');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Client *"
                  error={Boolean(formErrors.clientId)}
                  helperText={formErrors.clientId}
                />
              )}
            />

            <TextField
              label="Remarks"
              value={formData.remarks}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, remarks: event.target.value }));
                clearFormError('remarks');
              }}
              multiline
              minRows={3}
              fullWidth
              error={Boolean(formErrors.remarks)}
              helperText={formErrors.remarks}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button
            onClick={() => handleSubmitForm().catch(() => setError('Failed to save inquire'))}
            variant="contained"
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Inquire</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography><strong>Date:</strong> {new Date(viewingItem.inquiryDate).toLocaleDateString()}</Typography>
              <Typography><strong>Reference Auto:</strong> <span style={{ color: '#7E57C2', fontWeight: 700 }}>{viewingItem.referenceNo}</span></Typography>
              <Typography><strong>Service:</strong> {getServiceLabel(viewingItem)}</Typography>
              <Typography><strong>Procedure:</strong> {getProcedureLabel(viewingItem, procedureById) || '-'}</Typography>
              <Typography><strong>Country:</strong> {getCountryLabel(viewingItem)}</Typography>
              <Typography><strong>Client:</strong> {getClientLabel(viewingItem)}</Typography>
              <Typography><strong>Remarks:</strong> {viewingItem.remarks || '-'}</Typography>
              <Typography><strong>Created At:</strong> {new Date(viewingItem.createdAt).toLocaleString()}</Typography>
              <Typography><strong>Updated At:</strong> {new Date(viewingItem.updatedAt).toLocaleString()}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Inquire</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this inquire? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
