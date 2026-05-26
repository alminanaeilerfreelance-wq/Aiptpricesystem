'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
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

export const dynamic = 'force-dynamic';

interface InquireFormData {
  inquiryDate: string;
  serviceId: string;
  procedureId: string;
  countryIds: string[];
  clientId: string;
  remarks: string;
}

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const defaultReferenceSerial = '00001';

const defaultFormData: InquireFormData = {
  inquiryDate: getTodayIso(),
  serviceId: '',
  procedureId: '',
  countryIds: [],
  clientId: '',
  remarks: '',
};

const toServiceId = (value: Inquire['serviceId']) =>
  typeof value === 'string' ? value : value?._id || '';
const toProcedureId = (value: Inquire['procedureId']) =>
  typeof value === 'string' ? value : value?._id || '';
const toClientId = (value: Inquire['clientId']) =>
  typeof value === 'string' ? value : value?._id || '';
const toCountryIds = (value: Inquire['countryIds']) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : item?._id || '')).filter(Boolean)
    : [];

const getServiceLabel = (item: Inquire) =>
  typeof item.serviceId === 'string'
    ? item.serviceId
    : `${item.serviceId.name} (${item.serviceId.category})`;

const getProcedureLabel = (item: Inquire) =>
  typeof item.procedureId === 'string' ? item.procedureId : item.procedureId.name;

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
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [services, setServices] = useState<Service[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [referenceSerial, setReferenceSerial] = useState(defaultReferenceSerial);
  const [formData, setFormData] = useState<InquireFormData>(defaultFormData);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Inquire | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchItems = useCallback(
    async (params?: { nextPage?: number; nextSearch?: string }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      try {
        setLoading(true);
        setError('');
        const response = await inquiresService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
        });
        setItems(Array.isArray(response.inquires) ? response.inquires : []);
        setTotal(response.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load inquires');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, limit, page]
  );

  const loadLookups = useCallback(async () => {
    const [servicesRes, proceduresRes, countriesRes, clientsRes] = await Promise.all([
      servicesService.list({ page: 1, limit: 1000 }),
      proceduresService.list({ page: 1, limit: 1000 }),
      countriesService.list({ page: 1, limit: 1000 }),
      clientsService.list({ page: 1, limit: 1000 }),
    ]);

    const normalizedServices = Array.isArray(servicesRes.services)
      ? servicesRes.services.filter((item) => item.isActive)
      : [];
    const normalizedProcedures = Array.isArray(proceduresRes.procedures)
      ? proceduresRes.procedures.filter((item) => item.isActive)
      : [];
    const normalizedCountries = Array.isArray(countriesRes.countries)
      ? countriesRes.countries.filter((item) => item.isActive)
      : [];
    const normalizedClients = Array.isArray(clientsRes.clients)
      ? clientsRes.clients.filter((item) => item.isActive)
      : [];

    setServices(normalizedServices.sort((a, b) => a.name.localeCompare(b.name)));
    setProcedures(normalizedProcedures.sort((a, b) => a.name.localeCompare(b.name)));
    setCountries(normalizedCountries.sort((a, b) => a.name.localeCompare(b.name)));
    setClients(normalizedClients.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    fetchItems({ nextPage: page, nextSearch: debouncedSearch });
  }, [page, debouncedSearch, fetchItems]);

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
      (procedure) => procedure.serviceCategory === selectedService.category
    );
  }, [procedures, selectedService]);

  const selectedCountries = useMemo(
    () => countries.filter((country) => formData.countryIds.includes(country._id)),
    [countries, formData.countryIds]
  );

  const referencePreview = useMemo(() => {
    const countryCodes = selectedCountries
      .map((country) => country.abbreviation?.trim().toUpperCase())
      .filter(Boolean)
      .join('/');

    return `${referenceSerial}${countryCodes || 'COUNTRY'}`;
  }, [referenceSerial, selectedCountries]);

  const resetForm = () => {
    setEditingId(null);
    setReferenceSerial(defaultReferenceSerial);
    setFormData({
      ...defaultFormData,
      inquiryDate: getTodayIso(),
    });
  };

  const handleAdd = () => {
    resetForm();
    setOpenForm(true);
  };

  const handleEdit = (item: Inquire) => {
    const serialFromReference =
      typeof item.referenceNo === 'string' && /^\d{5}/.test(item.referenceNo)
        ? item.referenceNo.slice(0, 5)
        : defaultReferenceSerial;

    setEditingId(item._id);
    setReferenceSerial(serialFromReference);
    setFormData({
      inquiryDate: new Date(item.inquiryDate).toISOString().slice(0, 10),
      serviceId: toServiceId(item.serviceId),
      procedureId: toProcedureId(item.procedureId),
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

  const handleSubmitForm = async () => {
    if (!formData.inquiryDate) {
      setError('Date is required');
      return;
    }
    if (!formData.serviceId) {
      setError('Service is required');
      return;
    }
    if (!formData.procedureId) {
      setError('Procedure is required');
      return;
    }
    if (formData.countryIds.length === 0) {
      setError('At least one country is required');
      return;
    }
    if (!formData.clientId) {
      setError('Client is required');
      return;
    }

    const payload = {
      inquiryDate: formData.inquiryDate,
      serviceId: formData.serviceId,
      procedureId: formData.procedureId,
      countryIds: formData.countryIds,
      clientId: formData.clientId,
      remarks: formData.remarks.trim() || undefined,
    };

    try {
      setLoading(true);
      setError('');
      if (editingId) {
        await inquiresService.update(editingId, payload);
        setSuccessMessage('Inquire updated successfully');
      } else {
        await inquiresService.create(payload);
        setSuccessMessage('Inquire created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
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
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) setPage(targetPage);
      else await fetchItems({ nextPage: targetPage });
      setSuccessMessage('Inquire deleted successfully');
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
      label: 'Reference',
      sortable: true,
      minWidth: 160,
      searchValue: (row) => row.referenceNo || '',
      render: (row) => row.referenceNo,
    },
    {
      id: 'serviceId',
      label: 'Service',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => getServiceLabel(row),
      render: (row) => getServiceLabel(row),
    },
    {
      id: 'procedureId',
      label: 'Procedure',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => getProcedureLabel(row),
      render: (row) => getProcedureLabel(row),
    },
    {
      id: 'countryIds',
      label: 'Country',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => getCountryLabel(row),
      render: (row) => getCountryLabel(row),
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
          <Button size="small" variant="outlined" onClick={() => handleView(row)}>
            View
          </Button>
          <Button size="small" variant="outlined" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => handleDeleteClick(row._id)}
          >
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Inquires</Typography>
        <Button variant="contained" onClick={handleAdd}>
          + Add Inquire
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                placeholder="Search all fields..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Rows"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                size="small"
                fullWidth
              >
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, inquiryDate: event.target.value }))
                  }
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Reference (Auto)"
                  value={referencePreview}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
            </Grid>

            <Autocomplete
              options={services}
              value={services.find((service) => service._id === formData.serviceId) || null}
              getOptionLabel={(option) => `${option.name} (${option.category})`}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  serviceId: value?._id || '',
                  procedureId: '',
                }))
              }
              renderInput={(params) => <TextField {...params} label="Service *" />}
            />

            <Autocomplete
              options={filteredProcedures}
              value={filteredProcedures.find((procedure) => procedure._id === formData.procedureId) || null}
              getOptionLabel={(option) => `${option.name} (${option.serviceCategory})`}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  procedureId: value?._id || '',
                }))
              }
              renderInput={(params) => <TextField {...params} label="Procedure *" />}
            />

            <Autocomplete
              multiple
              options={countries}
              value={selectedCountries}
              getOptionLabel={(option) => `${option.abbreviation} - ${option.name}`}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  countryIds: value.map((item) => item._id),
                }))
              }
              renderInput={(params) => <TextField {...params} label="Country (Multi-select) *" />}
            />

            <Autocomplete
              options={clients}
              value={clients.find((client) => client._id === formData.clientId) || null}
              getOptionLabel={(option) =>
                option.companyName
                  ? `${option.name} (${option.companyName})`
                  : option.name
              }
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  clientId: value?._id || '',
                }))
              }
              renderInput={(params) => <TextField {...params} label="Client *" />}
            />

            <TextField
              label="Remarks"
              value={formData.remarks}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, remarks: event.target.value }))
              }
              multiline
              minRows={3}
              fullWidth
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
              <Typography><strong>Reference:</strong> {viewingItem.referenceNo}</Typography>
              <Typography><strong>Service:</strong> {getServiceLabel(viewingItem)}</Typography>
              <Typography><strong>Procedure:</strong> {getProcedureLabel(viewingItem)}</Typography>
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

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  );
}
