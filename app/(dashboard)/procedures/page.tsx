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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Paper,
  TextField,
  Typography,
  Snackbar,
} from '@mui/material';
import { EmptyState } from '@/components/ui';
import { proceduresService } from '@/services/procedures.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

interface Procedure {
  _id: string;
  name: string;
  serviceCategory: string;
  description?: string;
  sortOrder?: number;
  createdAt: string;
}

const CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

const categoryColors: Record<string, { bg: string; text: string }> = {
  Trademark: { bg: '#E3F2FD', text: '#1976D2' },
  Patent: { bg: '#F3E5F5', text: '#7B1FA2' },
  Copyright: { bg: '#E8F5E9', text: '#388E3C' },
  Design: { bg: '#FFF3E0', text: '#F57C00' },
  Litigation: { bg: '#FFEBEE', text: '#D32F2F' },
};

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
  const [successMessage, setSuccessMessage] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingProcedure, setViewingProcedure] = useState<Procedure | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentCategory = activeTab === 0 ? '' : CATEGORIES[activeTab - 1];

  const fetchProcedures = useCallback(async (params?: { nextPage?: number; nextSearch?: string; nextCategory?: string }) => {
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
  }, [currentCategory, debouncedSearch, limit, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    fetchProcedures({ nextPage: page, nextSearch: debouncedSearch, nextCategory: currentCategory });
  }, [activeTab, debouncedSearch, fetchProcedures, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
      setSuccessMessage('Procedure deleted successfully');
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
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, raw: false });
      const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim()));

      let importedCount = 0;
      const importErrors: string[] = [];

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const category = String(row[1] ?? '').trim();
        const description = String(row[2] ?? '').trim();

        if (!name || !category) continue;
        if (!CATEGORIES.includes(category)) {
          importErrors.push(`Invalid category "${category}" for procedure "${name}"`);
          continue;
        }

        try {
          await proceduresService.create({ name, serviceCategory: category, description: description || undefined });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchProcedures({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} procedures`);
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

  const getAllFilteredProcedures = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await proceduresService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      category: currentCategory || undefined,
    });

    const firstData = Array.isArray(firstResponse?.procedures) ? firstResponse.procedures : [];
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
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.procedures) ? r.procedures : []));

    return [...firstData, ...remainingData];
  }, [currentCategory, debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredProcedures();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((p) => ({
      Name: p.name,
      Category: p.serviceCategory,
      Description: p.description || '',
      Created: new Date(p.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procedures');
    XLSX.writeFile(wb, 'procedures.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredProcedures();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((p) => ({
      Name: p.name,
      Category: p.serviceCategory,
      Description: p.description || '',
      Created: new Date(p.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procedures');
    XLSX.writeFile(wb, 'procedures.xlsx');
    setSuccessMessage(`Excel exported (${records.length} rows)`);
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
      head: [['Name', 'Category', 'Created']],
      body: records.map((p) => [
        p.name,
        p.serviceCategory,
        new Date(p.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('procedures.pdf');
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Procedures</Typography>
        <Button variant="contained" disabled>
          + Add Procedure (Form Coming Soon)
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Category Tabs */}
      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} aria-label="procedures categories">
          <Tab label="All" />
          {CATEGORIES.map((cat, idx) => (
            <Tab key={cat} label={cat} />
          ))}
        </Tabs>
      </Paper>

      {/* Filter and Export */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search procedures..."
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

      {!loading && procedures.length === 0 ? (
        <EmptyState
          title="No procedures found"
          description="Start by adding your first procedure"
          onAction={() => {}}
          actionLabel="Add Procedure"
        />
      ) : (
        !loading && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {procedures.map((procedure) => (
                    <TableRow
                      key={procedure._id}
                      sx={{ '&:hover': { backgroundColor: '#f9f9f9' }, '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{procedure.name}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'inline-block',
                            backgroundColor: categoryColors[procedure.serviceCategory]?.bg || '#f0f0f0',
                            color: categoryColors[procedure.serviceCategory]?.text || '#000',
                            px: 2,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: '0.85rem',
                            fontWeight: 500,
                          }}
                        >
                          {procedure.serviceCategory}
                        </Box>
                      </TableCell>
                      <TableCell>{new Date(procedure.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => handleView(procedure)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" disabled>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(procedure._id)}>
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
        <DialogTitle>View Procedure</DialogTitle>
        <DialogContent>
          {viewingProcedure && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Name</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingProcedure.name}</Typography>

              <Typography variant="subtitle2" gutterBottom>Category</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingProcedure.serviceCategory}</Typography>

              {viewingProcedure.description && (
                <>
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  <Typography variant="body2">{viewingProcedure.description}</Typography>
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
        <DialogTitle>Delete Procedure</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this procedure? This action cannot be undone.</Typography>
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
