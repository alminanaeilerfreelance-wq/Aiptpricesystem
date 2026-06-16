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
  IconButton,
  Stack,
  SvgIcon,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import companyDetailsService, { CompanyDetail } from '@/services/company-details.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

interface CompanyForm {
  companyName: string;
  address: string;
  contact: string;
  email: string;
  logoUrl: string;
}

const defaultForm: CompanyForm = {
  companyName: '',
  address: '',
  contact: '',
  email: '',
  logoUrl: '',
};

const COMPANY_LOGO_MAX_SIZE_BYTES = 255 * 1024 * 1024;
const COMPANY_LOGO_MAX_SIZE_LABEL = '255 MB';

const getCompanyLogoImageSrc = (logoUrl?: string | null): string => {
  const value = String(logoUrl || '').trim();
  if (!value) return '';
  if (/^(blob:|data:|https?:\/\/|\/)/i.test(value)) return value;
  return `/${value.replace(/^\/+/, '')}`;
};

const EyeIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 5c-5 0-9.27 3.11-11 7c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7m0 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8m0-2.5A1.5 1.5 0 1 0 12 10a1.5 1.5 0 0 0 0 3.5"
    />
  </SvgIcon>
);

const NoteIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M3 17.25V21h3.75l11-11l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z"
    />
  </SvgIcon>
);

const TrashIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M9 3h6l1 2h4v2H4V5h4zm1 6h2v9h-2zm4 0h2v9h-2zM7 9h2v9H7zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2"
    />
  </SvgIcon>
);

export default function CompanyDetailsPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CompanyDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyForm>(defaultForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<CompanyDetail | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setLogoPreview = useCallback((nextPreviewUrl: string) => {
    setLogoPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(currentPreviewUrl);
      return nextPreviewUrl;
    });
  }, []);

  const resetLogoUpload = useCallback(() => {
    setLogoFile(null);
    setLogoPreview('');
  }, [setLogoPreview]);

  useEffect(() => () => {
    if (logoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl);
  }, [logoPreviewUrl]);

  const fetchItems = useCallback(
    async (params?: { nextPage?: number; nextSearch?: string }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;

      try {
        setLoading(true);
        setError('');
        const response = await companyDetailsService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
        });
        setItems(Array.isArray(response?.companyDetails) ? response.companyDetails : []);
        setTotal(response?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch company details');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, limit, page]
  );

  useEffect(() => {
    fetchItems({ nextPage: page, nextSearch: debouncedSearch });
  }, [debouncedSearch, fetchItems, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultForm);
    resetLogoUpload();
    setOpenForm(true);
  };

  const handleEdit = (item: CompanyDetail) => {
    setEditingId(item._id);
    setFormData({
      companyName: item.companyName || '',
      address: item.address || '',
      contact: item.contact || '',
      email: item.email || '',
      logoUrl: item.logoUrl || '',
    });
    resetLogoUpload();
    setOpenForm(true);
  };

  const handleView = (item: CompanyDetail) => {
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
    resetLogoUpload();
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Company logo must be an image file.');
      return;
    }
    if (file.size > COMPANY_LOGO_MAX_SIZE_BYTES) {
      setError(`Company logo must be ${COMPANY_LOGO_MAX_SIZE_LABEL} or smaller.`);
      return;
    }

    setError('');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmitForm = async () => {
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Invalid email address');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = new FormData();
      payload.append('companyName', formData.companyName.trim());
      payload.append('address', formData.address.trim());
      payload.append('contact', formData.contact.trim());
      payload.append('email', formData.email.trim().toLowerCase());
      payload.append('logoUrl', formData.logoUrl || '');
      if (logoFile) payload.append('logo', logoFile);

      if (editingId) {
        await companyDetailsService.update(editingId, payload);
        showSuccessToast('Company detail updated successfully');
      } else {
        await companyDetailsService.create(payload);
        showSuccessToast('Company detail created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save company detail');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await companyDetailsService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);

      if (targetPage !== page) setPage(targetPage);
      else await fetchItems({ nextPage: targetPage });

      showSuccessToast('Company detail deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete company detail');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        const companyName = String(row[0] ?? '').trim();
        const address = String(row[1] ?? '').trim();
        const contact = String(row[2] ?? '').trim();
        const email = String(row[3] ?? '').trim();

        if (!companyName) continue;

        try {
          await companyDetailsService.create({
            companyName,
            address: address || undefined,
            contact: contact || undefined,
            email: email || undefined,
          });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${companyName}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchItems({ nextPage: 1 });
        showSuccessToast(`Imported ${importedCount} company records`);
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

  const getAllFiltered = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await companyDetailsService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    });

    const firstData = Array.isArray(firstResponse?.companyDetails)
      ? firstResponse.companyDetails
      : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        companyDetailsService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((response) =>
      Array.isArray(response?.companyDetails) ? response.companyDetails : []
    );

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((item) => ({
        'Company Name': item.companyName,
        Address: item.address || '',
        Contact: item.contact || '',
        Email: item.email || '',
        Created: new Date(item.createdAt).toLocaleDateString(),
        Updated: new Date(item.updatedAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company Details');
    XLSX.writeFile(wb, 'company-details.csv');
    showSuccessToast(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((item) => ({
        'Company Name': item.companyName,
        Address: item.address || '',
        Contact: item.contact || '',
        Email: item.email || '',
        Created: new Date(item.createdAt).toLocaleDateString(),
        Updated: new Date(item.updatedAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company Details');
    XLSX.writeFile(wb, 'company-details.xlsx');
    showSuccessToast(`Excel exported (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }

    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF({ orientation: 'landscape' });

    autoTable.default(doc, {
      head: [['Company Name', 'Contact', 'Email']],
      body: records.map((item) => [
        item.companyName,
        item.contact || '-',
        item.email || '-',
      ]),
      startY: 10,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    doc.save('company-details.pdf');
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  const columns: MuiDataTableColumn<CompanyDetail>[] = [
    {
      id: 'logoUrl',
      label: 'Logo',
      sortable: false,
      render: (row) => {
        const logoSrc = getCompanyLogoImageSrc(row.logoUrl);
        return logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
            alt={`${row.companyName || 'Company'} logo`}
            sx={{
              width: 44,
              height: 44,
              objectFit: 'contain',
              border: '1px solid #E2E8F0',
              borderRadius: 1,
              bgcolor: '#FFFFFF',
              p: 0.5,
            }}
          />
        ) : (
          '-'
        );
      },
    },
    {
      id: 'companyName',
      label: 'Company Name',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.companyName || '',
      render: (row) => row.companyName || '-',
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
      id: 'contact',
      label: 'Contact',
      sortable: true,
      searchValue: (row) => row.contact || '',
      render: (row) => row.contact || '-',
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.email || '',
      render: (row) => row.email || '-',
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
      label: 'Action',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={() => handleView(row)}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleEdit(row)}
              sx={{
                bgcolor: 'success.main',
                color: 'success.contrastText',
                '&:hover': { bgcolor: 'success.dark' },
              }}
            >
              <NoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteClick(row._id)}
              sx={{
                bgcolor: 'error.main',
                color: 'error.contrastText',
                '&:hover': { bgcolor: 'error.dark' },
              }}
            >
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (!mounted) return null;

  const formLogoSrc = getCompanyLogoImageSrc(formData.logoUrl);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Company Details" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}
      >
        <Button variant="contained" onClick={handleAdd}>
          + Add Company
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportFile}
              style={{ display: 'none' }}
              id="company-details-import-input"
            />
            <label htmlFor="company-details-import-input" style={{ margin: 0 }}>
              <Button size="small" variant="outlined" component="span">
                Import File
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
          title="No company details found"
          description="Start by adding your first company detail"
          onAction={handleAdd}
          actionLabel="Add Company"
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
        <DialogTitle>{editingId ? 'Edit Company Detail' : 'Add Company Detail'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Company Name"
              value={formData.companyName}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
              required
            />
            <Box
              sx={{
                border: '1px dashed #CBD5E1',
                borderRadius: 2,
                p: 2,
                bgcolor: '#F8FAFC',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                <Box
                  sx={{
                    width: 92,
                    height: 92,
                    border: '1px solid #E2E8F0',
                    borderRadius: 1.5,
                    bgcolor: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {(logoPreviewUrl || formLogoSrc) ? (
                    <Box
                      component="img"
                      src={logoPreviewUrl || formLogoSrc}
                      alt="Company logo preview"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.75 }}
                    />
                  ) : (
                    <Typography sx={{ color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                      Logo
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
                    Company Logo
                  </Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 12, mb: 1 }}>
                    Upload an image logo. Maximum file size: {COMPANY_LOGO_MAX_SIZE_LABEL}.
                  </Typography>
                  <Button variant="outlined" component="label" size="small">
                    Upload Logo
                    <input type="file" hidden accept="image/*" onChange={handleLogoFileChange} />
                  </Button>
                </Box>
              </Stack>
            </Box>
            <TextField
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              label="Contact"
              value={formData.contact}
              onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button
            onClick={() => handleSubmitForm().catch(() => setError('Failed to save company detail'))}
            variant="contained"
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Company Detail</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {getCompanyLogoImageSrc(viewingItem.logoUrl) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                  <Box
                    component="img"
                    src={getCompanyLogoImageSrc(viewingItem.logoUrl)}
                    alt={`${viewingItem.companyName || 'Company'} logo`}
                    sx={{
                      maxWidth: 150,
                      maxHeight: 96,
                      objectFit: 'contain',
                      border: '1px solid #E2E8F0',
                      borderRadius: 1.5,
                      bgcolor: '#FFFFFF',
                      p: 1,
                    }}
                  />
                </Box>
              )}
              <Typography><strong>Company Name:</strong> {viewingItem.companyName || '-'}</Typography>
              <Typography><strong>Address:</strong> {viewingItem.address || '-'}</Typography>
              <Typography><strong>Contact:</strong> {viewingItem.contact || '-'}</Typography>
              <Typography><strong>Email:</strong> {viewingItem.email || '-'}</Typography>
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
        <DialogTitle>Delete Company Detail</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this company detail? This action cannot be undone.
          </Typography>
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
