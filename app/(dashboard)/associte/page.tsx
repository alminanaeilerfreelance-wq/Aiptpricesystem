'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import associteService, { Associte, AssociteStatus } from '@/services/associte.service';
import { countriesService, Country } from '@/services/countries.service';
import { continentsService, Continent } from '@/services/continents.service';
import { clientsService } from '@/services/clients.service';
import { useDebounce } from '@/hooks/useDebounce';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS: AssociteStatus[] = ['Big', 'Small', 'New', 'Banned'];

const statusColors: Record<AssociteStatus, 'success' | 'info' | 'warning' | 'error'> = {
  Big: 'success',
  Small: 'info',
  New: 'warning',
  Banned: 'error',
};

interface AssociteFormData {
  assignedId: string;
  associteName: string;
  country: string;
  continent: string;
  companyName: string;
  address: string;
  email: string;
  contact: string;
  notes: string;
  associteType: string;
  status: AssociteStatus;
}

const defaultFormData: AssociteFormData = {
  assignedId: '',
  associteName: '',
  country: '',
  continent: '',
  companyName: '',
  address: '',
  email: '',
  contact: '',
  notes: '',
  associteType: 'Company',
  status: 'New',
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();

export default function AssocitePage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Associte[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [associteTypeOptions, setAssociteTypeOptions] = useState<string[]>([
    'Company',
    'Individual',
    'Organization',
  ]);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<AssociteStatus | ''>('');
  const [countryFilter, setCountryFilter] = useState('');
  const [continentFilter, setContinentFilter] = useState('');

  const [error, setError] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AssociteFormData>(defaultFormData);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Associte | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchItems = useCallback(
    async (params?: {
      nextPage?: number;
      nextSearch?: string;
      nextStatus?: AssociteStatus | '';
      nextCountry?: string;
      nextContinent?: string;
    }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      const nextStatus = params?.nextStatus ?? statusFilter;
      const nextCountry = params?.nextCountry ?? countryFilter;
      const nextContinent = params?.nextContinent ?? continentFilter;

      try {
        setLoading(true);
        setError('');
        const response = await associteService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
          status: nextStatus || undefined,
          country: nextCountry || undefined,
          continent: nextContinent || undefined,
        });

        setItems(Array.isArray(response?.assocites) ? response.assocites : []);
        setTotal(response?.total || 0);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch associte list');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, debouncedSearch, statusFilter, countryFilter, continentFilter]
  );

  useEffect(() => {
    fetchItems({
      nextPage: page,
      nextSearch: debouncedSearch,
      nextStatus: statusFilter,
      nextCountry: countryFilter,
      nextContinent: continentFilter,
    });
  }, [page, debouncedSearch, statusFilter, countryFilter, continentFilter, fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, countryFilter, continentFilter]);

  useEffect(() => {
    const loadLookupData = async () => {
      try {
        const [countriesResponse, continentsResponse, clientsResponse] = await Promise.all([
          countriesService.list({ page: 1, limit: 1000 }),
          continentsService.list(),
          clientsService.list({ page: 1, limit: 1000 }),
        ]);

        setCountries(Array.isArray(countriesResponse?.countries) ? countriesResponse.countries : []);
        setContinents(Array.isArray(continentsResponse?.continents) ? continentsResponse.continents : []);

        const typeSet = new Set<string>();
        for (const client of clientsResponse?.clients || []) {
          if (client.type) typeSet.add(client.type);
          if (client.clientType) typeSet.add(client.clientType);
        }
        if (typeSet.size > 0) {
          setAssociteTypeOptions(Array.from(typeSet).sort((a, b) => a.localeCompare(b)));
        }
      } catch {
        setCountries([]);
        setContinents([]);
      }
    };

    loadLookupData();
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setOpenForm(true);
  };

  const handleEdit = (item: Associte) => {
    setEditingId(item._id);
    setFormData({
      assignedId: item.assignedId || '',
      associteName: item.associteName || '',
      country: item.country || '',
      continent: item.continent || '',
      companyName: item.companyName || '',
      address: item.address || '',
      email: item.email || '',
      contact: item.contact || '',
      notes: item.notes || '',
      associteType: item.associteType || 'Company',
      status: item.status || 'New',
    });
    setOpenForm(true);
  };

  const handleView = (item: Associte) => {
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
    setFormData(defaultFormData);
  };

  const handleSubmitForm = async () => {
    if (!formData.assignedId.trim()) {
      setError('Assigned ID is required');
      return;
    }
    if (!formData.associteName.trim()) {
      setError('Associte Name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        assignedId: formData.assignedId.trim(),
        associteName: formData.associteName.trim(),
        country: formData.country || undefined,
        continent: formData.continent || undefined,
        companyName: formData.companyName.trim() || undefined,
        address: formData.address.trim() || undefined,
        email: formData.email.trim() || undefined,
        contact: formData.contact.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        associteType: formData.associteType || undefined,
        status: formData.status || undefined,
      };

      if (editingId) {
        await associteService.update(editingId, payload);
        showSuccessToast('Associte updated successfully');
      } else {
        await associteService.create(payload);
        showSuccessToast('Associte created successfully');
      }

      handleCloseForm();
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchItems({ nextPage: 1 });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save associte');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      setLoading(true);
      await associteService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchItems({ nextPage: targetPage });
      }
      showSuccessToast('Associte deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete associte');
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
        const assignedId = String(row[0] ?? '').trim();
        const associteName = String(row[1] ?? '').trim();
        const country = String(row[2] ?? '').trim();
        const continent = String(row[3] ?? '').trim();
        const companyName = String(row[4] ?? '').trim();
        const address = String(row[5] ?? '').trim();
        const email = String(row[6] ?? '').trim();
        const contact = String(row[7] ?? '').trim();
        const notes = String(row[8] ?? '').trim();
        const associteType = String(row[9] ?? '').trim();
        const status = String(row[10] ?? '').trim();

        if (!assignedId || !associteName) continue;
        const normalizedStatus = status
          ? STATUS_OPTIONS.find((option) => option.toLowerCase() === status.toLowerCase())
          : undefined;
        if (status && !normalizedStatus) {
          importErrors.push(`Invalid status "${status}" for "${associteName}"`);
          continue;
        }

        try {
          await associteService.create({
            assignedId,
            associteName,
            country: country || undefined,
            continent: continent || undefined,
            companyName: companyName || undefined,
            address: address || undefined,
            email: email || undefined,
            contact: contact || undefined,
            notes: notes || undefined,
            associteType: associteType || undefined,
            status: normalizedStatus,
          });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${associteName}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchItems({ nextPage: 1 });
        showSuccessToast(`Imported ${importedCount} associte records`);
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
    const firstResponse = await associteService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      country: countryFilter || undefined,
      continent: continentFilter || undefined,
    });
    const firstData = Array.isArray(firstResponse?.assocites) ? firstResponse.assocites : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const requests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      requests.push(
        associteService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          country: countryFilter || undefined,
          continent: continentFilter || undefined,
        })
      );
    }

    const responses = await Promise.all(requests);
    const remainingData = responses.flatMap((response) =>
      Array.isArray(response?.assocites) ? response.assocites : []
    );

    return [...firstData, ...remainingData];
  }, [debouncedSearch, statusFilter, countryFilter, continentFilter]);

  const handleExportCSV = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((item) => ({
      'Assigned ID': item.assignedId,
      'Associte Name': item.associteName,
      Country: item.country || '',
      Continent: item.continent || '',
      'Company Name': item.companyName || '',
      Address: item.address || '',
      Email: item.email || '',
      Contact: item.contact || '',
      Notes: stripHtml(item.notes || ''),
      'Associte Type': item.associteType || '',
      Status: item.status || '',
      Created: new Date(item.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associte');
    XLSX.writeFile(wb, 'associte.csv');
    showSuccessToast(`CSV exported (${records.length} rows)`);
  };

  const handleExportExcel = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((item) => ({
      'Assigned ID': item.assignedId,
      'Associte Name': item.associteName,
      Country: item.country || '',
      Continent: item.continent || '',
      'Company Name': item.companyName || '',
      Address: item.address || '',
      Email: item.email || '',
      Contact: item.contact || '',
      Notes: stripHtml(item.notes || ''),
      'Associte Type': item.associteType || '',
      Status: item.status || '',
      Created: new Date(item.createdAt).toLocaleDateString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associte');
    XLSX.writeFile(wb, 'associte.xlsx');
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
      head: [['Assigned ID', 'Associte Name', 'Country', 'Type', 'Status', 'Email', 'Contact']],
      body: records.map((item) => [
        item.assignedId,
        item.associteName,
        item.country || '-',
        item.associteType || '-',
        item.status || '-',
        item.email || '-',
        item.contact || '-',
      ]),
      startY: 10,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    doc.save('associte.pdf');
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCountryFilter('');
    setContinentFilter('');
    setPage(1);
  };

  const columns: MuiDataTableColumn<Associte>[] = [
    {
      id: 'assignedId',
      label: 'Assigned ID',
      sortable: true,
      searchValue: (row) => row.assignedId,
      render: (row) => row.assignedId,
    },
    {
      id: 'associteName',
      label: 'Associte Name',
      sortable: true,
      searchValue: (row) => row.associteName,
      render: (row) => row.associteName,
    },
    {
      id: 'country',
      label: 'Country',
      sortable: true,
      searchValue: (row) => row.country || '',
      render: (row) => row.country || '-',
    },
    {
      id: 'continent',
      label: 'Continent',
      sortable: true,
      searchValue: (row) => row.continent || '',
      render: (row) => row.continent || '-',
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
      id: 'email',
      label: 'Email',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.email || '',
      render: (row) => row.email || '-',
    },
    {
      id: 'contact',
      label: 'Contact',
      sortable: true,
      searchValue: (row) => row.contact || '',
      render: (row) => row.contact || '-',
    },
    {
      id: 'associteType',
      label: 'Associte Type',
      sortable: true,
      searchValue: (row) => row.associteType || '',
      render: (row) => row.associteType || '-',
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      searchValue: (row) => row.status || '',
      render: (row) =>
        row.status ? (
          <Chip
            label={row.status}
            color={statusColors[row.status]}
            size="small"
            sx={{ fontWeight: 600 }}
          />
        ) : (
          '-'
        ),
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
      <Topbar title="Associte" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button variant="contained" onClick={handleAdd}>
          + Add Associte
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FormControl sx={{ flex: 1, minWidth: 170 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as AssociteStatus | '')}
                size="small"
              >
                <MenuItem value="">All Status</MenuItem>
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1, minWidth: 170 }}>
              <InputLabel>Country</InputLabel>
              <Select
                value={countryFilter}
                label="Country"
                onChange={(e) => setCountryFilter(e.target.value)}
                size="small"
              >
                <MenuItem value="">All Countries</MenuItem>
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country.name}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1, minWidth: 170 }}>
              <InputLabel>Continent</InputLabel>
              <Select
                value={continentFilter}
                label="Continent"
                onChange={(e) => setContinentFilter(e.target.value)}
                size="small"
              >
                <MenuItem value="">All Continents</MenuItem>
                {continents.map((continent) => (
                  <MenuItem key={continent._id} value={continent.continent}>
                    {continent.continent}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Rows</InputLabel>
              <Select
                value={String(limit)}
                label="Rows"
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                size="small"
              >
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={() => handleExportCSV().catch(() => setError('Export failed'))}>
              Export CSV
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleExportExcel().catch(() => setError('Export failed'))}>
              Export Excel
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleExportPDF().catch(() => setError('Export failed'))}>
              Export PDF
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              id="associte-import-input"
            />
            <label htmlFor="associte-import-input" style={{ margin: 0 }}>
              <Button size="small" variant="outlined" component="span">
                Import File
              </Button>
            </label>
            <Button size="small" variant="outlined" onClick={handleClearFilters}>
              Clear Filters
            </Button>
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
          title="No associte records found"
          description="Start by adding your first associte record"
          onAction={handleAdd}
          actionLabel="Add Associte"
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

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Associte' : 'Add Associte'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Assigned ID"
                value={formData.assignedId}
                onChange={(e) => setFormData((prev) => ({ ...prev, assignedId: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Associte Name"
                value={formData.associteName}
                onChange={(e) => setFormData((prev) => ({ ...prev, associteName: e.target.value }))}
                required
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={formData.country}
                  label="Country"
                  onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  {countries.map((country) => (
                    <MenuItem key={country._id} value={country.name}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Continent</InputLabel>
                <Select
                  value={formData.continent}
                  label="Continent"
                  onChange={(e) => setFormData((prev) => ({ ...prev, continent: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  {continents.map((continent) => (
                    <MenuItem key={continent._id} value={continent.continent}>
                      {continent.continent}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Company Name"
                value={formData.companyName}
                onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Contact"
                value={formData.contact}
                onChange={(e) => setFormData((prev) => ({ ...prev, contact: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Associte Type</InputLabel>
                <Select
                  value={formData.associteType}
                  label="Associte Type"
                  onChange={(e) => setFormData((prev) => ({ ...prev, associteType: e.target.value }))}
                >
                  {associteTypeOptions.map((typeOption) => (
                    <MenuItem key={typeOption} value={typeOption}>
                      {typeOption}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as AssociteStatus }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button variant="contained" onClick={() => handleSubmitForm().catch(() => setError('Failed to save associte'))}>
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Associte</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography><strong>Assigned ID:</strong> {viewingItem.assignedId}</Typography>
              <Typography><strong>Associte Name:</strong> {viewingItem.associteName}</Typography>
              <Typography><strong>Country:</strong> {viewingItem.country || '-'}</Typography>
              <Typography><strong>Continent:</strong> {viewingItem.continent || '-'}</Typography>
              <Typography><strong>Company Name:</strong> {viewingItem.companyName || '-'}</Typography>
              <Typography><strong>Address:</strong> {viewingItem.address || '-'}</Typography>
              <Typography><strong>Email:</strong> {viewingItem.email || '-'}</Typography>
              <Typography><strong>Contact:</strong> {viewingItem.contact || '-'}</Typography>
              <Typography><strong>Associte Type:</strong> {viewingItem.associteType || '-'}</Typography>
              <Typography><strong>Status:</strong> {viewingItem.status || '-'}</Typography>
              <Typography><strong>Notes:</strong> {viewingItem.notes || '-'}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Associte</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this associte record? This action cannot be undone.</Typography>
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
