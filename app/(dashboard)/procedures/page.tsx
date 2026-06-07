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
  Stack,
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
import { servicesService } from '@/services/services.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface Procedure {
  _id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  createdAt: string;
}

interface ServiceOption {
  _id: string;
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
}

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
    serviceId: '',
  });
  const [services, setServices] = useState<ServiceOption[]>([]);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingProcedure, setViewingProcedure] = useState<Procedure | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchProcedures = useCallback(
    async (params?: {
      nextPage?: number;
      nextSearch?: string;
    }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      try {
        setLoading(true);
        setError('');
        const response = await proceduresService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
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
    [debouncedSearch, limit, page]
  );

  useEffect(() => {
    fetchProcedures({
      nextPage: page,
      nextSearch: debouncedSearch,
    });
  }, [debouncedSearch, fetchProcedures, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const servicesRes = await servicesService.list({ page: 1, limit: 1000 });
        setServices((servicesRes.services || []).map((s) => ({ _id: s._id, name: s.name, category: s.category })));
      } catch {
        setServices([]);
      }
    };
    loadLookups().catch(() => undefined);
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      serviceId: '',
    });
    setOpenForm(true);
  };

  const handleEdit = (procedure: Procedure) => {
    setEditingId(procedure._id);
    setFormData({
      name: procedure.name,
      serviceId: procedure.serviceId || '',
    });
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      serviceId: '',
    });
  };

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) {
      setError('Procedure name is required');
      return;
    }

    if (!formData.serviceId) {
      setError('Service is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        name: formData.name.trim(),
        serviceId: formData.serviceId,
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
      const serviceByName = new Map(
        services.map((service) => [service.name.trim().toLowerCase(), service])
      );

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const secondValue = String(row[1] ?? '').trim();
        const thirdValue = String(row[2] ?? '').trim();
        const serviceName = thirdValue || secondValue;

        if (!name || !serviceName) continue;
        const service =
          serviceByName.get(serviceName.toLowerCase()) ||
          services.find((item) => item.category.toLowerCase() === serviceName.toLowerCase());
        if (!service) {
          importErrors.push(`Service "${serviceName}" not found for procedure "${name}"`);
          continue;
        }

        try {
          await proceduresService.create({
            name,
            serviceId: service._id,
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
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) =>
      Array.isArray(r?.procedures) ? r.procedures : []
    );

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

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
        Service: p.serviceName || '',
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
        Service: p.serviceName || '',
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
      head: [['Name', 'Service', 'Created']],
      body: records.map((p) => [
        p.name,
        p.serviceName || '',
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
      id: 'serviceName',
      label: 'Service',
      sortable: true,
      searchValue: (row) => row.serviceName || '',
      render: (row) => row.serviceName || '-',
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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1}>
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
              exportFileName="procedures"
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
              options={services}
              value={services.find((s) => s._id === formData.serviceId) || null}
              getOptionLabel={(option) => option.name}
              onChange={(_, value) =>
                setFormData((prev) => ({
                  ...prev,
                  serviceId: value?._id || '',
                }))
              }
              renderInput={(params) => <TextField {...params} label="Service" required />}
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
                Service
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingProcedure.serviceName || '-'}
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
