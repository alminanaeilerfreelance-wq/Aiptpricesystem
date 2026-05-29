'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamicImport from 'next/dynamic';
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
  Select,
  Stack,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  SvgIcon,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import requirementsService from '@/services/requirements.service';
import { countriesService } from '@/services/countries.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

const RequirementForm = dynamicImport(() => import('@/components/requirements/RequirementForm'), {
  ssr: false,
});

export const dynamic = 'force-dynamic';

interface Requirement {
  _id: string;
  country: {
    _id: string;
    name: string;
    code?: string;
    abbreviation?: string;
  };
  serviceCategory?: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  requirements: string;
  createdAt: string;
  updatedAt: string;
}

interface Country {
  _id: string;
  name: string;
  abbreviation: string;
  flagCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();
const normalize = (value: string) => value.trim().toLowerCase();
const sanitizeHtml = (value: string) => value
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/\son\w+='[^']*'/gi, '')
  .replace(/javascript:/gi, '');
const CATEGORY_OPTIONS = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

const SERVICE_COLOR_MAP: Record<string, string> = {
  Trademark: '#2563EB',
  Patent: '#16A34A',
  Design: '#9333EA',
  Copyright: '#F59E0B',
  Litigation: '#DC2626',
};

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

export default function RequirementsPage() {
  const [mounted, setMounted] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'country'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingRequirement, setViewingRequirement] = useState<Requirement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchRequirements = useCallback(async (params?: { nextPage?: number; nextSearch?: string; nextCountry?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    const nextCountry = params?.nextCountry ?? countryFilter;
    try {
      setLoading(true);
      setError('');
      const response = await requirementsService.list(
        nextPage,
        limit,
        nextSearch || undefined,
        nextCountry || undefined,
        sortBy,
        sortOrder
      );
      setRequirements(Array.isArray(response.data.data) ? response.data.data : []);
      setTotal(response.data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch requirements');
      setRequirements([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [countryFilter, debouncedSearch, limit, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchRequirements({ nextPage: page, nextSearch: debouncedSearch, nextCountry: countryFilter });
  }, [countryFilter, debouncedSearch, fetchRequirements, page, sortBy, sortOrder]);

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

  const handleAdd = () => {
    setEditingId(null);
    setError('');
    setOpenForm(true);
  };

  const handleEdit = (requirement: Requirement) => {
    setEditingId(requirement._id);
    setError('');
    setOpenForm(true);
  };

  const handleView = (requirement: Requirement) => {
    setViewingRequirement(requirement);
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
      await requirementsService.delete(deletingId);
      const targetPage = requirements.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchRequirements({ nextPage: targetPage });
      }
      showSuccessToast('Requirement deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = async () => {
    setOpenForm(false);
    setEditingId(null);
    setError('');
    if (page !== 1) {
      setPage(1);
    } else {
      await fetchRequirements({ nextPage: 1 });
    }
    showSuccessToast(editingId ? 'Requirement updated successfully' : 'Requirement created successfully');
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
      let createdCount = 0;
      let updatedCount = 0;
      const importErrors: string[] = [];
      const countryByName = new Map(countries.map((country) => [normalize(country.name), country]));
      const countryByAbbreviation = new Map(
        countries.map((country) => [normalize(country.abbreviation), country])
      );

      for (const row of dataRows) {
        const countryName = String(row[0] ?? '').trim();
        const serviceCategory = String(row[1] ?? '').trim();
        const requirementsText = row
          .slice(2)
          .map((cell) => String(cell ?? '').trim())
          .filter(Boolean)
          .join(', ');
        if (!countryName || !serviceCategory || !requirementsText) continue;

        const normalizedCountry = normalize(countryName);
        const matchingCountry = countryByName.get(normalizedCountry) || countryByAbbreviation.get(normalizedCountry);

        if (!matchingCountry) {
          importErrors.push(`Country "${countryName}" not found by name/abbreviation`);
          continue;
        }
        if (!CATEGORY_OPTIONS.includes(serviceCategory)) {
          importErrors.push(`Invalid service "${serviceCategory}" for country "${countryName}"`);
          continue;
        }

        const result = await requirementsService.create({
          country: matchingCountry._id,
          serviceCategory: serviceCategory as 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation',
          requirements: requirementsText,
          upsertByCountry: true,
        });
        if (result.status === 201) {
          createdCount += 1;
        } else {
          updatedCount += 1;
        }
        importedCount += 1;
      }

      if (importedCount > 0) {
        if (page !== 1) {
          setPage(1);
        } else {
          await fetchRequirements({ nextPage: 1 });
        }
        showSuccessToast(
          `Import completed: ${importedCount} total (${createdCount} created, ${updatedCount} updated)`
        );
      }

      if (importErrors.length > 0) {
        setError(`Imported ${importedCount} rows. Errors: ${importErrors.join(' | ')}`);
      } else if (importedCount === 0) {
        setError('No valid rows were found in the selected file.');
      }
    } catch {
      setError('Failed to import file');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const getAllFilteredRequirements = useCallback(async () => {
    const pageSize = 100;
    const firstResponse = await requirementsService.list(
      1,
      pageSize,
      debouncedSearch || undefined,
      countryFilter || undefined,
      sortBy,
      sortOrder
    );

    const firstData = Array.isArray(firstResponse.data.data) ? firstResponse.data.data : [];
    const totalPagesFromApi = firstResponse.data.pagination?.pages || 1;

    if (totalPagesFromApi <= 1) {
      return firstData;
    }

    const remainingRequests: Array<Promise<any>> = [];
    for (let currentPage = 2; currentPage <= totalPagesFromApi; currentPage += 1) {
      remainingRequests.push(
        requirementsService.list(
          currentPage,
          pageSize,
          debouncedSearch || undefined,
          countryFilter || undefined,
          sortBy,
          sortOrder
        )
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((response) => (
      Array.isArray(response.data.data) ? response.data.data : []
    ));

    return [...firstData, ...remainingData];
  }, [countryFilter, debouncedSearch, sortBy, sortOrder]);

  const handleExportCSV = async () => {
    const records = await getAllFilteredRequirements();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((req) => ({
      Country: req.country.name,
      Service: req.serviceCategory || '',
      Requirements: stripHtml(req.requirements),
      Created: new Date(req.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requirements');
    XLSX.writeFile(wb, 'requirements.csv');
    showSuccessToast(`CSV exported successfully (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFilteredRequirements();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((req) => ({
      Country: req.country.name,
      Service: req.serviceCategory || '',
      Requirements: stripHtml(req.requirements),
      Created: new Date(req.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requirements');
    XLSX.writeFile(wb, 'requirements.xlsx');
    showSuccessToast(`Excel exported successfully (${records.length} rows)`);
  };

  const handleExportPDF = async () => {
    const records = await getAllFilteredRequirements();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF();

    autoTable.default(doc, {
      head: [['Country', 'Service', 'Requirements', 'Created']],
      body: records.map((req) => [
        req.country.name,
        req.serviceCategory || '',
        stripHtml(req.requirements).slice(0, 100),
        new Date(req.createdAt).toLocaleDateString(),
      ]),
      startY: 10,
    });

    doc.save('requirements.pdf');
    showSuccessToast(`PDF exported successfully (${records.length} rows)`);
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Country (Name or Abbreviation)', 'Service', 'Requirements'],
      ['Saudi Arabia', 'Trademark', 'Sample requirement text'],
      ['SA', 'Patent', 'Another sample using abbreviation'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'requirements-import-template.csv');
    showSuccessToast('Import template downloaded');
  };

  const applyCountryFilter = (nextCountry: string) => {
    setCountryFilter(nextCountry);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCountryFilter('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const requirementColumns: MuiDataTableColumn<Requirement>[] = [
    {
      id: 'country',
      label: 'Country',
      sortable: true,
      render: (row) => row.country.name,
      sortValue: (row) => row.country.name,
      searchValue: (row) => row.country.name,
    },
    {
      id: 'serviceCategory',
      label: 'Service',
      sortable: true,
      minWidth: 160,
      render: (row) => {
        const service = row.serviceCategory || '';
        const color = SERVICE_COLOR_MAP[service];
        if (!service || !color) return '-';
        return (
          <Box
            component="span"
            sx={{ px: 1.2, py: 0.4, borderRadius: 999, color, bgcolor: `${color}1A`, fontWeight: 700, fontSize: 12 }}
          >
            {service}
          </Box>
        );
      },
      sortValue: (row) => row.serviceCategory || '',
      searchValue: (row) => row.serviceCategory || '',
    },
    {
      id: 'requirements',
      label: 'Requirements',
      sortable: false,
      minWidth: 320,
      render: (row) => (
        <Typography noWrap sx={{ maxWidth: 320 }}>
          {stripHtml(row.requirements)}
        </Typography>
      ),
      searchValue: (row) => stripHtml(row.requirements),
    },
    {
      id: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
      sortValue: (row) => new Date(row.createdAt).getTime(),
      searchValue: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={() => handleView(row)}
              sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleEdit(row)}
              sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}
            >
              <NoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDeleteClick(row._id)}
              sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}
            >
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (!mounted) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Requirements" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button variant="contained" onClick={handleAdd}>
          + Add Requirement
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'createdAt' | 'country');
                  setPage(1);
                }}
                label="Sort By"
                size="small"
              >
                <MenuItem value="createdAt">Created Date</MenuItem>
                <MenuItem value="country">Country</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Order</InputLabel>
              <Select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as 'asc' | 'desc');
                  setPage(1);
                }}
                label="Order"
                size="small"
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportCSV} style={{ display: 'none' }} id="import-csv-input" />
            <label htmlFor="import-csv-input" style={{ margin: 0 }}>
              <Button size="small" variant="outlined" component="span">
                Import File
              </Button>
            </label>
            <Button size="small" variant="outlined" onClick={handleClearFilters}>
              Clear Filters
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleDownloadTemplate().catch(() => setError('Failed to download template'))}>
              Download Template
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && requirements.length === 0 ? (
        <EmptyState
          title="No requirements found"
          description="Start by adding your first requirement"
          onAction={handleAdd}
          actionLabel="Add Requirement"
        />
      ) : (
        !loading && (
          <>
            <MuiDataTable
              rows={requirements}
              columns={requirementColumns}
              rowKey={(row) => row._id}
              page={page}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              onRowsPerPageChange={(nextRowsPerPage) => {
                setLimit(nextRowsPerPage);
                setPage(1);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(nextSortBy, nextSortOrder) => {
                if (nextSortBy === 'country' || nextSortBy === 'createdAt') {
                  setSortBy(nextSortBy);
                  setSortOrder(nextSortOrder);
                  setPage(1);
                }
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

      <RequirementForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        onSuccess={handleFormSuccess}
        editingId={editingId}
      />

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Requirement</DialogTitle>
        <DialogContent>
          {viewingRequirement && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Country</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingRequirement.country.name}</Typography>
              <Typography variant="subtitle2" gutterBottom>Service</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{viewingRequirement.serviceCategory || '-'}</Typography>
              <Typography variant="subtitle2" gutterBottom>Requirements</Typography>
              <Box
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingRequirement.requirements) }}
                sx={{ p: 1.5, backgroundColor: '#f5f5f5', borderRadius: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Requirement</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this requirement? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>Delete</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
