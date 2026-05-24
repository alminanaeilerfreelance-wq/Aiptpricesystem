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
import { clientTypesService } from '@/services/client-types.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

interface ClientType {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export default function ClientTypesPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<ClientType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchItems = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    try {
      setLoading(true);
      setError('');
      const response = await clientTypesService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setItems(Array.isArray(response?.clientTypes) ? response.clientTypes : []);
      setTotal(response?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, limit, page]);

  useEffect(() => {
    fetchItems({ nextPage: page, nextSearch: debouncedSearch });
  }, [debouncedSearch, fetchItems, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleView = (item: ClientType) => {
    setViewingItem(item);
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
      await clientTypesService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchItems({ nextPage: targetPage });
      }
      setSuccessMessage('Client type deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
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
        const description = String(row[1] ?? '').trim();

        if (!name) continue;

        try {
          await clientTypesService.create({ name, description: description || undefined });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchItems({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} items`);
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

  const getAllFiltered = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await clientTypesService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    });

    const firstData = Array.isArray(firstResponse?.clientTypes) ? firstResponse.clientTypes : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        clientTypesService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.clientTypes) ? r.clientTypes : []));

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((i) => ({
      Name: i.name,
      Description: i.description || '',
      Created: new Date(i.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Client Types');
    XLSX.writeFile(wb, 'client-types.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((i) => ({
      Name: i.name,
      Description: i.description || '',
      Created: new Date(i.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Client Types');
    XLSX.writeFile(wb, 'client-types.xlsx');
    setSuccessMessage(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Name', 'Description', 'Created']],
      body: records.map((i) => [
        i.name,
        i.description || '',
        new Date(i.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('client-types.pdf');
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Client Types</Typography>
        <Button variant="contained" disabled>
          + Add Type (Form Coming Soon)
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search client types..."
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

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No client types found"
          description="Start by adding your first client type"
          onAction={() => {}}
          actionLabel="Add Client Type"
        />
      ) : (
        !loading && (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item._id}
                      sx={{ '&:hover': { backgroundColor: '#f9f9f9' }, '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                      <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => handleView(item)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" disabled>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(item._id)}>
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
        <DialogTitle>View Client Type</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Name</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingItem.name}</Typography>

              {viewingItem.description && (
                <>
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  <Typography variant="body2">{viewingItem.description}</Typography>
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
        <DialogTitle>Delete Client Type</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this client type? This action cannot be undone.</Typography>
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
