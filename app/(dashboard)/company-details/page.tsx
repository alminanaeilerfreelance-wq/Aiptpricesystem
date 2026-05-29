'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  MenuItem,
  Stack,
  SvgIcon,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import companyDetailsService, {
  CompanyDetail,
  CompanyServiceCategory,
} from '@/services/company-details.service';
import { continentsService, Continent } from '@/services/continents.service';
import { countriesService, Country } from '@/services/countries.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

const SERVICE_COLOR_MAP: Record<CompanyServiceCategory, string> = {
  Trademark: '#2563EB',
  Patent: '#16A34A',
  Design: '#9333EA',
  Copyright: '#F59E0B',
  Litigation: '#DC2626',
};

const SERVICE_OPTIONS: CompanyServiceCategory[] = [
  'Trademark',
  'Patent',
  'Design',
  'Copyright',
  'Litigation',
];

interface CompanyForm {
  continentId: string;
  countryId: string;
  companyName: string;
  address: string;
  contact: string;
  email: string;
  serviceCategory: CompanyServiceCategory;
}

const defaultForm: CompanyForm = {
  continentId: '',
  countryId: '',
  companyName: '',
  address: '',
  contact: '',
  email: '',
  serviceCategory: 'Trademark',
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

const isServiceCategory = (value: string): value is CompanyServiceCategory =>
  SERVICE_OPTIONS.includes(value as CompanyServiceCategory);

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

  const [continents, setContinents] = useState<Continent[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompanyForm>(defaultForm);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<CompanyDetail | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const continentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const continent of continents) {
      map.set(continent._id, continent.continent);
    }
    return map;
  }, [continents]);

  const countryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) {
      map.set(country._id, country.name);
    }
    return map;
  }, [countries]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [continentsRes, countriesRes] = await Promise.all([
        continentsService.list(),
        countriesService.list({ page: 1, limit: 1000 }),
      ]);
      setContinents(Array.isArray(continentsRes?.continents) ? continentsRes.continents : []);
      setCountries(Array.isArray(countriesRes?.countries) ? countriesRes.countries : []);
    } catch {
      setError('Failed to load continent/country options');
    }
  }, []);

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
    fetchLookups().catch(() => undefined);
  }, [fetchLookups]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setOpenForm(true);
  };

  const handleEdit = (item: CompanyDetail) => {
    setEditingId(item._id);
    setFormData({
      continentId: item.continentId || '',
      countryId: item.countryId || '',
      companyName: item.companyName || '',
      address: item.address || '',
      contact: item.contact || '',
      email: item.email || '',
      serviceCategory: item.serviceCategory || 'Trademark',
    });
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
  };

  const handleSubmitForm = async () => {
    if (!formData.continentId) {
      setError('Continent is required');
      return;
    }
    if (!formData.countryId) {
      setError('Country is required');
      return;
    }
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

      const payload = {
        continentId: formData.continentId,
        countryId: formData.countryId,
        companyName: formData.companyName.trim(),
        address: formData.address.trim() || undefined,
        contact: formData.contact.trim() || undefined,
        email: formData.email.trim().toLowerCase() || undefined,
        serviceCategory: formData.serviceCategory,
      };

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

      const continentByName = new Map(
        continents.map((continent) => [continent.continent.trim().toLowerCase(), continent._id])
      );
      const countryByName = new Map(
        countries.map((country) => [country.name.trim().toLowerCase(), country._id])
      );
      for (const country of countries) {
        countryByName.set(country.abbreviation.trim().toLowerCase(), country._id);
      }

      let importedCount = 0;
      const importErrors: string[] = [];

      for (const row of dataRows) {
        const continentText = String(row[0] ?? '').trim();
        const countryText = String(row[1] ?? '').trim();
        const companyName = String(row[2] ?? '').trim();
        const address = String(row[3] ?? '').trim();
        const contact = String(row[4] ?? '').trim();
        const email = String(row[5] ?? '').trim();
        const serviceText = String(row[6] ?? '').trim();

        if (!companyName) continue;

        const continentId = continentByName.get(continentText.toLowerCase());
        const countryId = countryByName.get(countryText.toLowerCase());
        const serviceCategory = isServiceCategory(serviceText) ? serviceText : 'Trademark';

        if (!continentId || !countryId) {
          importErrors.push(
            `Skipped "${companyName}" (invalid continent or country)`
          );
          continue;
        }

        try {
          await companyDetailsService.create({
            continentId,
            countryId,
            companyName,
            address: address || undefined,
            contact: contact || undefined,
            email: email || undefined,
            serviceCategory,
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
        Service: item.serviceCategory,
        Continent: item.continentName || '',
        Country: item.countryName || '',
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
        Service: item.serviceCategory,
        Continent: item.continentName || '',
        Country: item.countryName || '',
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
      head: [['Service', 'Continent', 'Country', 'Company Name', 'Contact', 'Email']],
      body: records.map((item) => [
        item.serviceCategory,
        item.continentName || '-',
        item.countryName || '-',
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
      id: 'serviceCategory',
      label: 'Service',
      sortable: true,
      searchValue: (row) => row.serviceCategory || '',
      render: (row) => {
        const service = row.serviceCategory || 'Trademark';
        const color = SERVICE_COLOR_MAP[service];
        return (
          <Box
            component="span"
            sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: 999,
              color,
              bgcolor: `${color}1A`,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {service}
          </Box>
        );
      },
    },
    {
      id: 'continentName',
      label: 'Continent',
      sortable: true,
      searchValue: (row) => row.continentName || '',
      render: (row) => row.continentName || continentMap.get(row.continentId || '') || '-',
    },
    {
      id: 'countryName',
      label: 'Country',
      sortable: true,
      searchValue: (row) => row.countryName || '',
      render: (row) => row.countryName || countryMap.get(row.countryId || '') || '-',
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>

            <TextField
              select
              label="Rows"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              size="small"
              sx={{ width: 120 }}
            >
              <MenuItem value="10">10</MenuItem>
              <MenuItem value="25">25</MenuItem>
              <MenuItem value="50">50</MenuItem>
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
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
              select
              label="Continent"
              value={formData.continentId}
              onChange={(e) => setFormData((prev) => ({ ...prev, continentId: e.target.value }))}
              required
            >
              {continents.map((continent) => (
                <MenuItem key={continent._id} value={continent._id}>
                  {continent.continent}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Country"
              value={formData.countryId}
              onChange={(e) => setFormData((prev) => ({ ...prev, countryId: e.target.value }))}
              required
            >
              {countries.map((country) => (
                <MenuItem key={country._id} value={country._id}>
                  {country.name}
                </MenuItem>
              ))}
            </TextField>
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
            <TextField
              select
              label="Service"
              value={formData.serviceCategory}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  serviceCategory: e.target.value as CompanyServiceCategory,
                }))
              }
            >
              {SERVICE_OPTIONS.map((service) => (
                <MenuItem key={service} value={service}>
                  {service}
                </MenuItem>
              ))}
            </TextField>
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
              <Typography>
                <strong>Service:</strong>{' '}
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: 999,
                    color: SERVICE_COLOR_MAP[viewingItem.serviceCategory],
                    bgcolor: `${SERVICE_COLOR_MAP[viewingItem.serviceCategory]}1A`,
                    fontWeight: 700,
                  }}
                >
                  {viewingItem.serviceCategory}
                </Box>
              </Typography>
              <Typography><strong>Continent:</strong> {viewingItem.continentName || '-'}</Typography>
              <Typography><strong>Country:</strong> {viewingItem.countryName || '-'}</Typography>
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
