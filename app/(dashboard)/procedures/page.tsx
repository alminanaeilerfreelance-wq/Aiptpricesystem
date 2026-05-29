'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Paper,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  SvgIcon,
  Autocomplete,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import { proceduresService } from '@/services/procedures.service';
import { countriesService } from '@/services/countries.service';
import { servicesService } from '@/services/services.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface Procedure {
  _id: string;
  name: string;
  countryId: string;
  countryName: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  createdAt: string;
}

interface CountryOption {
  _id: string;
  name: string;
}

interface ServiceOption {
  _id: string;
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
}

const CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

const categoryColors: Record<string, { bg: string; text: string }> = {
  Trademark: { bg: '#2563EB1A', text: '#2563EB' },
  Patent: { bg: '#16A34A1A', text: '#16A34A' },
  Copyright: { bg: '#F59E0B1A', text: '#F59E0B' },
  Design: { bg: '#9333EA1A', text: '#9333EA' },
  Litigation: { bg: '#DC26261A', text: '#DC2626' },
};

const EyeIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7m0 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8m0-2.5A1.5 1.5 0 1 0 12 10a1.5 1.5 0 0 0 0 3.5" />
  </SvgIcon>
);
const NoteIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M3 17.25V21h3.75l11-11l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z" />
  </SvgIcon>
);
const TrashIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4zm1 6h2v9h-2zm4 0h2v9h-2zM7 9h2v9H7zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2" />
  </SvgIcon>
);

export default function ProceduresPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    countryId: '',
    serviceId: '',
    serviceCategory: 'Trademark',
  });
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingProcedure, setViewingProcedure] = useState<Procedure | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentCategory = activeTab === 0 ? '' : CATEGORIES[activeTab - 1];

  const fetchProcedures = useCallback(
    async (params?: {
      nextPage?: number;
      nextSearch?: string;
      nextCategory?: string;
    }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      const nextCategory = params?.nextCategory ?? currentCategory;
      try {
        setLoading(true);
        setError('');
        const response = await proceduresService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
          category: nextCategory || undefined,
        });
        setProcedures(Array.isArray(response?.procedures) ? response.procedures : []);
        setTotal(response?.total || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch procedures');
        setProcedures([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [currentCategory, debouncedSearch, limit, page]
  );

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    fetchProcedures({
      nextPage: page,
      nextSearch: debouncedSearch,
      nextCategory: currentCategory,
    });
  }, [activeTab, debouncedSearch, fetchProcedures, page, currentCategory]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [countriesRes, servicesRes] = await Promise.all([
          countriesService.list({ page: 1, limit: 1000 }),
          servicesService.list({ page: 1, limit: 1000 }),
        ]);
        setCountries((countriesRes.countries || []).map((c) => ({ _id: c._id, name: c.name })));
        setServices((servicesRes.services || []).map((s) => ({ _id: s._id, name: s.name, category: s.category })));
      } catch {
        setCountries([]);
        setServices([]);
      }
    };
    loadLookups().catch(() => undefined);
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      countryId: '',
      serviceId: '',
      serviceCategory: currentCategory || 'Trademark',
    });
    setOpenForm(true);
  };

  const handleEdit = (procedure: Procedure) => {
    setEditingId(procedure._id);
    setFormData({
      name: procedure.name,
      countryId: procedure.countryId || '',
      serviceId: procedure.serviceId || '',
      serviceCategory: procedure.serviceCategory,
    });
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      countryId: '',
      serviceId: '',
      serviceCategory: 'Trademark',
    });
  };

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) {
      setError('Procedure name is required');
      return;
    }

    if (!CATEGORIES.includes(formData.serviceCategory)) {
      setError('Service category is required');
      return;
    }
    if (!formData.countryId) {
      setError('Country is required');
      return;
    }
    if (!formData.serviceId) {
      setError('Service type is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        name: formData.name.trim(),
        countryId: formData.countryId,
        serviceId: formData.serviceId,
        serviceCategory: formData.serviceCategory,
      };

      if (editingId) {
        await proceduresService.update(editingId, payload);
        showSuccessToast('Procedure updated successfully');
      } else {
        await proceduresService.create(payload);
        showSuccessToast('Procedure created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchProcedures({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save procedure');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (procedure: Procedure) => {
    setViewingProcedure(procedure);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await proceduresService.delete(deletingId);
      const targetPage = procedures.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchProcedures({ nextPage: targetPage });
      }
      showSuccessToast('Procedure deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete procedure');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError('');
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, {
        header: 1,
        raw: false,
      });
      const dataRows = rows
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? '').trim()));

      let importedCount = 0;
      const importErrors: string[] = [];
      const countryByName = new Map(
        countries.map((country) => [country.name.trim().toLowerCase(), country])
      );

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const countryName = String(row[1] ?? '').trim();
        const category = String(row[2] ?? '').trim();

        if (!name || !countryName || !category) continue;
        if (!CATEGORIES.includes(category)) {
          importErrors.push(`Invalid service type "${category}" for procedure "${name}"`);
          continue;
        }
        const country = countryByName.get(countryName.toLowerCase());
        if (!country) {
          importErrors.push(`Country "${countryName}" not found for procedure "${name}"`);
          continue;
        }
        const service = services.find((item) => item.category === category);
        if (!service) {
          importErrors.push(`No service model found for service type "${category}"`);
          continue;
        }

        try {
          await proceduresService.create({
            name,
            countryId: country._id,
            serviceId: service._id,
            serviceCategory: category,
          });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchProcedures({ nextPage: 1 });
        showSuccessToast(`Imported ${importedCount} procedures`);
      }
      if (importErrors.length > 0) {
        setError(
          `Errors: ${importErrors.slice(0, 3).join(' | ')}${
            importErrors.length > 3 ? '...' : ''
          }`
        );
      }
    } catch {
      setError('Failed to import file');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const getAllFilteredProcedures = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await proceduresService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      category: currentCategory || undefined,
    });

    const firstData = Array.isArray(firstResponse?.procedures)
      ? firstResponse.procedures
      : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        proceduresService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
          category: currentCategory || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) =>
      Array.isArray(r?.procedures) ? r.procedures : []
    );

    return [...firstData, ...remainingData];
  }, [currentCategory, debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredProcedures();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((p) => ({
        Name: p.name,
        Country: p.countryName || '',
        'Service Type': p.serviceCategory,
        Created: new Date(p.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procedures');
    XLSX.writeFile(wb, 'procedures.csv');
    showSuccessToast(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredProcedures();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((p) => ({
        Name: p.name,
        Country: p.countryName || '',
        'Service Type': p.serviceCategory,
        Created: new Date(p.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procedures');
    XLSX.writeFile(wb, 'procedures.xlsx');
    showSuccessToast(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFilteredProcedures();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Name', 'Country', 'Service Type', 'Created']],
      body: records.map((p) => [
        p.name,
        p.countryName || '',
        p.serviceCategory,
        new Date(p.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('procedures.pdf');
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  if (!mounted) return null;

  const procedureColumns: MuiDataTableColumn<Procedure>[] = [
    {
      id: 'name',
      label: 'Procedure Name',
      sortable: true,
      searchValue: (row) => row.name,
      render: (row) => row.name,
    },
    {
      id: 'country',
      label: 'Country',
      sortable: true,
      searchValue: (row) => row.countryName || '',
      render: (row) => row.countryName || '-',
    },
    {
      id: 'serviceCategory',
      label: 'Service Type',
      sortable: true,
      searchValue: (row) => row.serviceCategory,
      render: (row) => (
        <Box
          sx={{
            display: 'inline-block',
            backgroundColor: categoryColors[row.serviceCategory]?.bg || '#f0f0f0',
            color: categoryColors[row.serviceCategory]?.text || '#000',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          {row.serviceCategory}
        </Box>
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => handleView(row)} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEdit(row)} sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}>
              <NoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDeleteClick(row._id)} sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}>
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Procedures" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box
          sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Button variant="contained" onClick={handleAdd}>
          + Add Procedure
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="All" />
          {CATEGORIES.map((cat) => (
            <Tab key={cat} label={cat} />
          ))}
        </Tabs>
      </Paper>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Rows</InputLabel>
              <Select
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                label="Rows"
                size="small"
              >
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportCSV().catch(() => setError('Export failed'))}
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportExcel().catch(() => setError('Export failed'))}
            >
              Export Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportPDF().catch(() => setError('Export failed'))}
            >
              Export PDF
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              id="import-procedures-input"
            />
            <label htmlFor="import-procedures-input" style={{ margin: 0 }}>
              <Button size="small" variant="outlined" component="span">
                Import CSV
              </Button>
            </label>
          </Stack>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && procedures.length === 0 ? (
        <EmptyState
          title="No procedures found"
          description="Start by adding your first procedure"
          onAction={handleAdd}
          actionLabel="Add Procedure"
        />
      ) : (
        !loading && (
          <>
            <MuiDataTable
              rows={procedures}
              columns={procedureColumns}
              rowKey={(row) => row._id}
              page={page}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              showToolbar
            searchTerm={search}
            onSearchTermChange={(nextSearch) => {
              setSearch(nextSearch);
              setPage(1);
            }}
              loading={false}
            />
          </>
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Procedure' : 'Add Procedure'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Procedure Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <Autocomplete
              options={countries}
              value={countries.find((c) => c._id === formData.countryId) || null}
              getOptionLabel={(option) => option.name}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  countryId: value?._id || '',
                }))
              }
              renderInput={(params) => <TextField {...params} label="Country" required />}
            />
            <Autocomplete
              options={services}
              value={services.find((s) => s._id === formData.serviceId) || null}
              getOptionLabel={(option) => `${option.name} (${option.category})`}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  serviceId: value?._id || '',
                  serviceCategory: value?.category || prev.serviceCategory,
                }))
              }
              renderInput={(params) => <TextField {...params} label="Service Type" required />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button
            onClick={() =>
              handleSubmitForm().catch(() => setError('Failed to save procedure'))
            }
            variant="contained"
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Procedure</DialogTitle>
        <DialogContent>
          {viewingProcedure && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Name
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingProcedure.name}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Service Type
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingProcedure.serviceCategory}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Country
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingProcedure.countryName || '-'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Procedure</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this procedure? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
