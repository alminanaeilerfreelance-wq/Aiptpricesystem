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
  Snackbar,
} from '@mui/material';
import { EmptyState } from '@/components/ui';
import { countriesService } from '@/services/countries.service';
import { useDebounce } from '@/hooks/useDebounce';

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
  const [mounted, setMounted] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCountry, setViewingCountry] = useState<Country | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCountries = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, [debouncedSearch, limit, page]);

  useEffect(() => {
    fetchCountries({ nextPage: page, nextSearch: debouncedSearch });
  }, [debouncedSearch, fetchCountries, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
      setSuccessMessage('Country deleted successfully');
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
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, raw: false });
      const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim()));

      let importedCount = 0;
      const importErrors: string[] = [];

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const abbreviation = String(row[1] ?? '').trim();
        const flagCode = String(row[2] ?? '').trim();

        if (!name || !abbreviation) continue;

        try {
          await countriesService.create({ name, abbreviation, flagCode: flagCode || undefined });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchCountries({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} countries`);
      }
      if (importErrors.length > 0) {
        setError(`Errors: ${importErrors.slice(0, 3).join(' | ')}${importErrors.length > 3 ? '...' : ''}`);
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
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.countries) ? r.countries : []));

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredCountries();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((c) => ({
      Name: c.name,
      Abbreviation: c.abbreviation,
      'Flag Code': c.flagCode || '',
      Created: new Date(c.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    XLSX.writeFile(wb, 'countries.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredCountries();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((c) => ({
      Name: c.name,
      Abbreviation: c.abbreviation,
      'Flag Code': c.flagCode || '',
      Created: new Date(c.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    XLSX.writeFile(wb, 'countries.xlsx');
    setSuccessMessage(`Excel exported (${records.length} rows)`);
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
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Countries</Typography>
        <Button variant="contained" disabled>
          + Add Country (Form Coming Soon)
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
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
            <Button size="small" variant="outlined" onClick={() => handleExportCSV().catch(() => setError('Export failed'))}>
              Export CSV
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleExportExcel().catch(() => setError('Export failed'))}>
              Export Excel
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleExportPDF().catch(() => setError('Export failed'))}>
              Export PDF
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportCSV} style={{ display: 'none' }} id="import-csv-input" />
            <label htmlFor="import-csv-input" style={{ margin: 0 }}>
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
          onAction={() => {}}
          actionLabel="Add Country"
        />
      ) : (
        !loading && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Code</strong></TableCell>
                    <TableCell><strong>Flag</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {countries.map((country) => (
                    <TableRow
                      key={country._id}
                      sx={{ '&:hover': { backgroundColor: '#f9f9f9' }, '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{country.name}</TableCell>
                      <TableCell>{country.abbreviation}</TableCell>
                      <TableCell>{country.flagCode || '-'}</TableCell>
                      <TableCell>{new Date(country.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => handleView(country)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" disabled>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(country._id)}>
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, px: 2 }}>
              <Typography variant="body2" color="textSecondary">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, newPage) => setPage(newPage)}
                color="primary"
                size="small"
              />
            </Box>
          </>
        )
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Country</DialogTitle>
        <DialogContent>
          {viewingCountry && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Name</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingCountry.name}</Typography>

              <Typography variant="subtitle2" gutterBottom>Abbreviation</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingCountry.abbreviation}</Typography>

              {viewingCountry.flagCode && (
                <>
                  <Typography variant="subtitle2" gutterBottom>Flag Code</Typography>
                  <Typography variant="body2">{viewingCountry.flagCode}</Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Country</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this country? This action cannot be undone.</Typography>
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

      {/* Success Message */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  );
}
