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
import { servicesService } from '@/services/services.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

interface Service {
  _id: string;
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  description?: string;
  basePrice?: number;
  createdAt: string;
  updatedAt: string;
}

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();
const CATEGORY_OPTIONS = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];
const categoryColors: Record<string, { bg: string; text: string }> = {
  Trademark: { bg: '#E3F2FD', text: '#1976D2' },
  Patent: { bg: '#F3E5F5', text: '#7B1FA2' },
  Copyright: { bg: '#E8F5E9', text: '#388E3C' },
  Design: { bg: '#FFF3E0', text: '#F57C00' },
  Litigation: { bg: '#FFEBEE', text: '#D32F2F' },
};

export default function ServicesPage() {
  const [mounted, setMounted] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'category'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchServices = useCallback(async (params?: { nextPage?: number; nextSearch?: string; nextCategory?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    const nextCategory = params?.nextCategory ?? categoryFilter;
    try {
      setLoading(true);
      setError('');
      const response = await servicesService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
        category: nextCategory || undefined,
      });
      setServices(Array.isArray(response?.services) ? response.services : []);
      setTotal(response?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch services');
      setServices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, debouncedSearch, limit, page]);

  useEffect(() => {
    fetchServices({ nextPage: page, nextSearch: debouncedSearch, nextCategory: categoryFilter });
  }, [categoryFilter, debouncedSearch, fetchServices, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleAdd = () => {
    setEditingId(null);
    setOpenForm(true);
  };

  const handleEdit = (service: Service) => {
    setEditingId(service._id);
    setOpenForm(true);
  };

  const handleView = (service: Service) => {
    setViewingService(service);
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
      await servicesService.delete(deletingId);
      const targetPage = services.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchServices({ nextPage: targetPage });
      }
      setSuccessMessage('Service deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete service');
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
        const basePrice = row[3] ? Number(row[3]) : 0;

        if (!name || !category) continue;
        if (!CATEGORY_OPTIONS.includes(category)) {
          importErrors.push(`Invalid category "${category}" for service "${name}"`);
          continue;
        }

        try {
          await servicesService.create({ name, category, description, basePrice });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchServices({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} services successfully`);
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

  const getAllFilteredServices = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await servicesService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
    });

    const firstData = Array.isArray(firstResponse?.services) ? firstResponse.services : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        servicesService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
          category: categoryFilter || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.services) ? r.services : []));

    return [...firstData, ...remainingData];
  }, [categoryFilter, debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredServices();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((s) => ({
      Name: s.name,
      Category: s.category,
      Description: stripHtml(s.description || ''),
      'Base Price': s.basePrice,
      Created: new Date(s.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, 'services.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredServices();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((s) => ({
      Name: s.name,
      Category: s.category,
      Description: stripHtml(s.description || ''),
      'Base Price': s.basePrice,
      Created: new Date(s.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, 'services.xlsx');
    setSuccessMessage(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFilteredServices();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Name', 'Category', 'Price', 'Created']],
      body: records.map((s) => [
        s.name.slice(0, 30),
        s.category,
        `$${s.basePrice || 0}`,
        new Date(s.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('services.pdf');
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const applyCategoryFilter = (nextCategory: string) => {
    setCategoryFilter(nextCategory);
    setPage(1);
  };

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Services</Typography>
        <Button variant="contained" onClick={handleAdd}>
          + Add Service
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search all fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ flex: 1, minWidth: 200 }}>
              <InputLabel>Filter by Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => applyCategoryFilter(e.target.value)}
                label="Filter by Category"
                size="small"
              >
                <MenuItem value="">All Categories</MenuItem>
                {CATEGORY_OPTIONS.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
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

      {!loading && services.length === 0 ? (
        <EmptyState
          title="No services found"
          description="Start by adding your first service"
          onAction={handleAdd}
          actionLabel="Add Service"
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
                    <TableCell align="right"><strong>Price</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((service) => (
                    <TableRow
                      key={service._id}
                      sx={{ '&:hover': { backgroundColor: '#f9f9f9' }, '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{service.name}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'inline-block',
                            backgroundColor: categoryColors[service.category]?.bg || '#f0f0f0',
                            color: categoryColors[service.category]?.text || '#000',
                            px: 2,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: '0.85rem',
                            fontWeight: 500,
                          }}
                        >
                          {service.category}
                        </Box>
                      </TableCell>
                      <TableCell align="right">${service.basePrice || 0}</TableCell>
                      <TableCell>{new Date(service.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" variant="outlined" onClick={() => handleView(service)}>
                            View
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => handleEdit(service)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(service._id)}>
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
        <DialogTitle>View Service</DialogTitle>
        <DialogContent>
          {viewingService && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Name</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingService.name}</Typography>

              <Typography variant="subtitle2" gutterBottom>Category</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingService.category}</Typography>

              <Typography variant="subtitle2" gutterBottom>Base Price</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>${viewingService.basePrice || 0}</Typography>

              {viewingService.description && (
                <>
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  <Typography variant="body2">{viewingService.description}</Typography>
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
        <DialogTitle>Delete Service</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this service? This action cannot be undone.</Typography>
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
