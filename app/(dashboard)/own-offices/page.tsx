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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import ownOfficesService, { OwnOffice } from '@/services/own-offices.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface OwnOfficeForm {
  country: string;
  companyName: string;
  address: string;
  tax: string;
}

const defaultForm: OwnOfficeForm = {
  country: '',
  companyName: '',
  address: '',
  tax: '',
};

export default function OwnOfficesPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<OwnOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OwnOfficeForm>(defaultForm);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<OwnOffice | null>(null);
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
      const response = await ownOfficesService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setItems(Array.isArray(response?.ownOffices) ? response.ownOffices : []);
      setTotal(response?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch own offices');
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

  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setOpenForm(true);
  };

  const handleEdit = (item: OwnOffice) => {
    setEditingId(item._id);
    setFormData({
      country: item.country || '',
      companyName: item.companyName || '',
      address: item.address || '',
      tax: item.tax || '',
    });
    setOpenForm(true);
  };

  const handleView = (item: OwnOffice) => {
    setViewingItem(item);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditingId(null);
    setFormData(defaultForm);
  };

  const handleSubmitForm = async () => {
    if (!formData.country.trim()) {
      setError('Country is required');
      return;
    }
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        country: formData.country.trim(),
        companyName: formData.companyName.trim(),
        address: formData.address.trim() || undefined,
        tax: formData.tax.trim() || undefined,
      };

      if (editingId) {
        await ownOfficesService.update(editingId, payload);
        showSuccessToast('Own office updated successfully');
      } else {
        await ownOfficesService.create(payload);
        showSuccessToast('Own office created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save own office');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await ownOfficesService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) setPage(targetPage);
      else await fetchItems({ nextPage: targetPage });
      showSuccessToast('Own office deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete own office');
    } finally {
      setLoading(false);
    }
  };

  const ownOfficeColumns: MuiDataTableColumn<OwnOffice>[] = [
    {
      id: 'country',
      label: 'Country',
      sortable: true,
      searchValue: (row) => row.country,
      render: (row) => row.country,
    },
    {
      id: 'companyName',
      label: 'Company Name',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.companyName,
      render: (row) => row.companyName,
    },
    {
      id: 'address',
      label: 'Address',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => row.address || '',
      render: (row) => row.address || '-',
    },
    {
      id: 'tax',
      label: 'Tax',
      sortable: true,
      searchValue: (row) => row.tax || '',
      render: (row) => row.tax || '-',
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
          <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(row._id)}>
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  if (!mounted) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Own Offices" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button variant="contained" onClick={handleAdd}>
          + Add Own Office
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
          title="No own offices found"
          description="Start by adding your first own office"
          onAction={handleAdd}
          actionLabel="Add Own Office"
        />
      ) : (
        !loading && (
          <MuiDataTable
            rows={items}
            columns={ownOfficeColumns}
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
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Own Office' : 'Add Own Office'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              required
            />
            <TextField
              label="Company Name"
              value={formData.companyName}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
              required
            />
            <TextField
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              label="Tax"
              value={formData.tax}
              onChange={(e) => setFormData((prev) => ({ ...prev, tax: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button onClick={() => handleSubmitForm().catch(() => setError('Failed to save own office'))} variant="contained">
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Own Office</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography><strong>Country:</strong> {viewingItem.country}</Typography>
              <Typography><strong>Company Name:</strong> {viewingItem.companyName}</Typography>
              <Typography><strong>Address:</strong> {viewingItem.address || '-'}</Typography>
              <Typography><strong>Tax:</strong> {viewingItem.tax || '-'}</Typography>
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
        <DialogTitle>Delete Own Office</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this own office? This action cannot be undone.</Typography>
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
