'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import { countriesService } from '@/services/countries.service';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface Country {
  _id: string;
  name: string;
  abbreviation: string;
  flagCode?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CountriesPage() {
  const { user } = useAuth();
  const { canAdd, canEdit, canDelete, canView } = usePermission();
  const [mounted, setMounted] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const hasLoadedRef = useRef(false);
  const lastLoadedPageRef = useRef(page);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    flagCode: '',
  });

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCountry, setViewingCountry] = useState<Country | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCountries = useCallback(
    async (params?: { nextPage?: number; nextSearch?: string }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      const shouldShowLoader = !hasLoadedRef.current || nextPage !== lastLoadedPageRef.current;
      try {
        if (shouldShowLoader) setLoading(true);
        setError('');
        const response = await countriesService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
        });
        setCountries(Array.isArray(response?.countries) ? response.countries : []);
        setTotal(response?.total || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch countries');
        setCountries([]);
        setTotal(0);
      } finally {
        if (shouldShowLoader) setLoading(false);
        hasLoadedRef.current = true;
        lastLoadedPageRef.current = nextPage;
      }
    },
    [debouncedSearch, limit, page]
  );

  useEffect(() => {
    fetchCountries({ nextPage: page, nextSearch: debouncedSearch });
  }, [debouncedSearch, fetchCountries, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleAdd = () => {
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', flagCode: '' });
    setOpenForm(true);
  };

  const handleEdit = (country: Country) => {
    setEditingId(country._id);
    setFormData({
      name: country.name,
      abbreviation: country.abbreviation,
      flagCode: country.flagCode || '',
    });
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', flagCode: '' });
  };

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) {
      setError('Country name is required');
      return;
    }

    if (!formData.abbreviation.trim()) {
      setError('Country abbreviation is required');
      return;
    }

    const abbreviation = formData.abbreviation.trim().toUpperCase();
    const flagCode = (formData.flagCode.trim() || abbreviation).toLowerCase();

    try {
      setLoading(true);
      setError('');

      const payload = {
        name: formData.name.trim(),
        abbreviation,
        flagCode,
      };

      if (editingId) {
        await countriesService.update(editingId, payload);
        showSuccessToast('Country updated successfully');
      } else {
        await countriesService.create(payload);
        showSuccessToast('Country created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchCountries({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save country');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (country: Country) => {
    setViewingCountry(country);
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
      await countriesService.delete(deletingId);
      const targetPage = countries.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchCountries({ nextPage: targetPage });
      }
      showSuccessToast('Country deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete country');
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

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const abbreviation = String(row[1] ?? '').trim().toUpperCase();
        const flagCode = String(row[2] ?? '').trim().toLowerCase() || abbreviation.toLowerCase();

        if (!name || !abbreviation) continue;

        try {
          await countriesService.create({ name, abbreviation, flagCode });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchCountries({ nextPage: 1 });
        showSuccessToast(`Imported ${importedCount} countries`);
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

  const getAllFilteredCountries = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await countriesService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    });

    const firstData = Array.isArray(firstResponse?.countries) ? firstResponse.countries : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        countriesService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) =>
      Array.isArray(r?.countries) ? r.countries : []
    );

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredCountries();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((c) => ({
        Name: c.name,
        Abbreviation: c.abbreviation,
        'Flag Code': c.flagCode || '',
        Created: new Date(c.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    XLSX.writeFile(wb, 'countries.csv');
    showSuccessToast(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredCountries();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((c) => ({
        Name: c.name,
        Abbreviation: c.abbreviation,
        'Flag Code': c.flagCode || '',
        Created: new Date(c.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    XLSX.writeFile(wb, 'countries.xlsx');
    showSuccessToast(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFilteredCountries();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Name', 'Code', 'Flag', 'Created']],
      body: records.map((c) => [
        c.name,
        c.abbreviation,
        c.flagCode || '',
        new Date(c.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('countries.pdf');
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  const countryColumns: MuiDataTableColumn<Country>[] = [
    {
      id: 'name',
      label: 'Name',
      sortable: true,
      searchValue: (row) => row.name,
      render: (row) => row.name,
    },
    {
      id: 'abbreviation',
      label: 'Code',
      sortable: true,
      searchValue: (row) => row.abbreviation,
      render: (row) => row.abbreviation,
    },
    {
      id: 'flagCode',
      label: 'Flag',
      sortable: true,
      searchValue: (row) => row.flagCode || '',
      render: (row) => row.flagCode || '-',
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

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Countries" />

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
          + Add Country
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              id="import-countries-input"
            />
            <label htmlFor="import-countries-input" style={{ margin: 0 }}>
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

      {!loading && countries.length === 0 ? (
        <EmptyState
          title="No countries found"
          description="Start by adding your first country"
          onAction={handleAdd}
          actionLabel="Add Country"
        />
      ) : (
        !loading && (
          <>
            <MuiDataTable
              rows={countries}
              columns={countryColumns}
              rowKey={(row) => row._id}
              page={page}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              onRowsPerPageChange={(nextRowsPerPage) => {
                setLimit(nextRowsPerPage);
                setPage(1);
              }}
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
        <DialogTitle>{editingId ? 'Edit Country' : 'Add Country'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Country Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label="Abbreviation"
              value={formData.abbreviation}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))
              }
              helperText="Example: SA"
              required
            />
            <TextField
              label="Flag Code"
              value={formData.flagCode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, flagCode: e.target.value.toLowerCase() }))
              }
              helperText="Example: sa"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button
            onClick={() =>
              handleSubmitForm().catch(() => setError('Failed to save country'))
            }
            variant="contained"
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Country</DialogTitle>
        <DialogContent>
          {viewingCountry && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Name
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingCountry.name}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Abbreviation
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingCountry.abbreviation}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Flag Code
              </Typography>
              <Typography variant="body2">{viewingCountry.flagCode || '-'}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Country</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this country? This action cannot be undone.
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
