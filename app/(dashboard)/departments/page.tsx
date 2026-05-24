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
import { departmentsService } from '@/services/departments.service';
import { countriesService } from '@/services/countries.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

interface Department {
  _id: string;
  name: string;
  country: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Country {
  _id: string;
  name: string;
}

export default function DepartmentsPage() {
  const [mounted, setMounted] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [countryFilter, setCountryFilter] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDept, setViewingDept] = useState<Department | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDepartments = useCallback(async (params?: { nextPage?: number; nextSearch?: string; nextCountry?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    const nextCountry = params?.nextCountry ?? countryFilter;
    try {
      setLoading(true);
      setError('');
      const response = await departmentsService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
        country: nextCountry || undefined,
      });
      setDepartments(Array.isArray(response?.departments) ? response.departments : []);
      setTotal(response?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch departments');
      setDepartments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [countryFilter, debouncedSearch, limit, page]);

  useEffect(() => {
    fetchDepartments({ nextPage: page, nextSearch: debouncedSearch, nextCountry: countryFilter });
  }, [countryFilter, debouncedSearch, fetchDepartments, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await countriesService.list({ page: 1, limit: 1000 });
        setCountries(response.countries || []);
      } catch {
        setCountries([]);
      }
    };
    loadCountries();
  }, []);

  const handleView = (dept: Department) => {
    setViewingDept(dept);
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
      await departmentsService.delete(deletingId);
      const targetPage = departments.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchDepartments({ nextPage: targetPage });
      }
      setSuccessMessage('Department deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete department');
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
      const countryMap = new Map(countries.map((c) => [c.name.toLowerCase(), c._id]));

      for (const row of dataRows) {
        const deptName = String(row[0] ?? '').trim();
        const countryName = String(row[1] ?? '').trim();

        if (!deptName || !countryName) continue;

        const countryId = countryMap.get(countryName.toLowerCase());
        if (!countryId) {
          importErrors.push(`Country "${countryName}" not found`);
          continue;
        }

        try {
          await departmentsService.create({ name: deptName, country: countryId });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${deptName}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchDepartments({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} departments`);
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

  const getAllFilteredDepartments = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await departmentsService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      country: countryFilter || undefined,
    });

    const firstData = Array.isArray(firstResponse?.departments) ? firstResponse.departments : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        departmentsService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
          country: countryFilter || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.departments) ? r.departments : []));

    return [...firstData, ...remainingData];
  }, [countryFilter, debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredDepartments();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((d) => ({
      Name: d.name,
      Country: d.country?.name || '',
      Created: new Date(d.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Departments');
    XLSX.writeFile(wb, 'departments.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredDepartments();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((d) => ({
      Name: d.name,
      Country: d.country?.name || '',
      Created: new Date(d.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Departments');
    XLSX.writeFile(wb, 'departments.xlsx');
    setSuccessMessage(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFilteredDepartments();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Name', 'Country', 'Created']],
      body: records.map((d) => [
        d.name,
        d.country?.name || '',
        new Date(d.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('departments.pdf');
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const applyCountryFilter = (nextCountry: string) => {
    setCountryFilter(nextCountry);
    setPage(1);
  };

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Departments</Typography>
        <Button variant="contained" disabled>
          + Add Department (Form Coming Soon)
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ flex: 1, minWidth: 200 }}>
              <InputLabel>Filter by Country</InputLabel>
              <Select
                value={countryFilter}
                onChange={(e) => applyCountryFilter(e.target.value)}
                label="Filter by Country"
                size="small"
              >
                <MenuItem value="">All Countries</MenuItem>
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country._id}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

      {!loading && departments.length === 0 ? (
        <EmptyState
          title="No departments found"
          description="Start by adding your first department"
          onAction={() => {}}
          actionLabel="Add Department"
        />
      ) : (
        !loading && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Country</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow
                      key={dept._id}
                      sx={{ '&:hover': { backgroundColor: '#f9f9f9' }, '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{dept.name}</TableCell>
                      <TableCell>{dept.country?.name || 'N/A'}</TableCell>
                      <TableCell>{new Date(dept.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => handleView(dept)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" disabled>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(dept._id)}>
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
        <DialogTitle>View Department</DialogTitle>
        <DialogContent>
          {viewingDept && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Name</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingDept.name}</Typography>

              <Typography variant="subtitle2" gutterBottom>Country</Typography>
              <Typography variant="body2">{viewingDept.country?.name || 'N/A'}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Department</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this department? This action cannot be undone.</Typography>
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
