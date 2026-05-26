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
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import { pricingRulesService } from '@/services/pricing-rules.service';
import { countriesService } from '@/services/countries.service';
import { proceduresService } from '@/services/procedures.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

interface PricingRule {
  _id: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: number;
  attorneyFee: number;
  classFee: number;
  createdAt: string;
}

interface CountryOption {
  _id: string;
  name: string;
  abbreviation: string;
}

interface ProcedureOption {
  _id: string;
  name: string;
  serviceCategory: string;
}

const CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

export default function PricingRulesPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<PricingRule[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    serviceCategory: PricingRule['serviceCategory'];
    countryName: string;
    countryAbbreviation: string;
    procedureName: string;
    officialFee: string;
    attorneyFee: string;
    classFee: string;
  }>({
    serviceCategory: 'Trademark',
    countryName: '',
    countryAbbreviation: '',
    procedureName: '',
    officialFee: '0',
    attorneyFee: '0',
    classFee: '0',
  });

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<PricingRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [countriesResponse, proceduresResponse] = await Promise.all([
          countriesService.list({ page: 1, limit: 100 }),
          proceduresService.list({ page: 1, limit: 100 }),
        ]);

        setCountries(
          Array.isArray(countriesResponse?.countries)
            ? countriesResponse.countries.map((country) => ({
                _id: country._id,
                name: country.name,
                abbreviation: country.abbreviation,
              }))
            : []
        );

        setProcedures(
          Array.isArray(proceduresResponse?.procedures)
            ? proceduresResponse.procedures.map((procedure) => ({
                _id: procedure._id,
                name: procedure.name,
                serviceCategory: procedure.serviceCategory,
              }))
            : []
        );
      } catch {
        setCountries([]);
        setProcedures([]);
      }
    };

    loadDependencies();
  }, []);

  const fetchItems = useCallback(
    async (params?: {
      nextPage?: number;
      nextSearch?: string;
      nextCategory?: string;
    }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      const nextCategory = params?.nextCategory ?? categoryFilter;

      try {
        setLoading(true);
        setError('');
        const response = await pricingRulesService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
          category: nextCategory || undefined,
        });
        setItems(Array.isArray(response?.pricingRules) ? response.pricingRules : []);
        setTotal(response?.total || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch data');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [categoryFilter, debouncedSearch, limit, page]
  );

  useEffect(() => {
    fetchItems({
      nextPage: page,
      nextSearch: debouncedSearch,
      nextCategory: categoryFilter,
    });
  }, [categoryFilter, debouncedSearch, fetchItems, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const filteredProcedureOptions = useMemo(
    () => procedures.filter((procedure) => procedure.serviceCategory === formData.serviceCategory),
    [formData.serviceCategory, procedures]
  );

  const handleAdd = () => {
    setEditingId(null);
    setFormData({
      serviceCategory: 'Trademark',
      countryName: '',
      countryAbbreviation: '',
      procedureName: '',
      officialFee: '0',
      attorneyFee: '0',
      classFee: '0',
    });
    setOpenForm(true);
  };

  const handleEdit = (item: PricingRule) => {
    setEditingId(item._id);
    setFormData({
      serviceCategory: item.serviceCategory,
      countryName: item.countryName,
      countryAbbreviation: item.countryAbbreviation,
      procedureName: item.procedureName,
      officialFee: String(item.officialFee ?? 0),
      attorneyFee: String(item.attorneyFee ?? 0),
      classFee: String(item.classFee ?? 0),
    });
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setEditingId(null);
  };

  const handlePickCountry = (countryName: string) => {
    const country = countries.find((item) => item.name === countryName);
    setFormData((prev) => ({
      ...prev,
      countryName,
      countryAbbreviation: country?.abbreviation || prev.countryAbbreviation,
    }));
  };

  const handleSubmitForm = async () => {
    if (!CATEGORIES.includes(formData.serviceCategory)) {
      setError('Service category is required');
      return;
    }

    if (!formData.countryName.trim()) {
      setError('Country is required');
      return;
    }

    if (!formData.countryAbbreviation.trim()) {
      setError('Country abbreviation is required');
      return;
    }

    if (!formData.procedureName.trim()) {
      setError('Procedure name is required');
      return;
    }

    const parsedOfficial = Number(formData.officialFee || '0');
    const parsedAttorney = Number(formData.attorneyFee || '0');
    const parsedClass = Number(formData.classFee || '0');

    if (!Number.isFinite(parsedOfficial) || parsedOfficial < 0) {
      setError('Official fee must be a valid non-negative number');
      return;
    }

    if (!Number.isFinite(parsedAttorney) || parsedAttorney < 0) {
      setError('Attorney fee must be a valid non-negative number');
      return;
    }

    if (!Number.isFinite(parsedClass) || parsedClass < 0) {
      setError('Class fee must be a valid non-negative number');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        serviceCategory: formData.serviceCategory,
        countryName: formData.countryName.trim(),
        countryAbbreviation: formData.countryAbbreviation.trim().toUpperCase(),
        procedureName: formData.procedureName.trim(),
        officialFee: parsedOfficial,
        attorneyFee: parsedAttorney,
        classFee: parsedClass,
      };

      if (editingId) {
        await pricingRulesService.update(editingId, payload);
        setSuccessMessage('Pricing rule updated successfully');
      } else {
        await pricingRulesService.create(payload);
        setSuccessMessage('Pricing rule created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save pricing rule');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item: PricingRule) => {
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
      await pricingRulesService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchItems({ nextPage: targetPage });
      }
      setSuccessMessage('Pricing rule deleted successfully');
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
        const serviceCategory = String(row[0] ?? '').trim();
        const countryName = String(row[1] ?? '').trim();
        const countryAbbreviation = String(row[2] ?? '').trim().toUpperCase();
        const procedureName = String(row[3] ?? '').trim();
        const officialFee = row[4] ? Number(row[4]) : 0;
        const attorneyFee = row[5] ? Number(row[5]) : 0;
        const classFee = row[6] ? Number(row[6]) : 0;

        if (!serviceCategory || !countryName || !procedureName) continue;

        if (!CATEGORIES.includes(serviceCategory)) {
          importErrors.push(`Invalid category "${serviceCategory}"`);
          continue;
        }

        try {
          await pricingRulesService.create({
            serviceCategory: serviceCategory as PricingRule['serviceCategory'],
            countryName,
            countryAbbreviation: countryAbbreviation || countryName.slice(0, 2).toUpperCase(),
            procedureName,
            officialFee: Number.isFinite(officialFee) ? officialFee : 0,
            attorneyFee: Number.isFinite(attorneyFee) ? attorneyFee : 0,
            classFee: Number.isFinite(classFee) ? classFee : 0,
          });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${procedureName}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchItems({ nextPage: 1 });
        setSuccessMessage(`Imported ${importedCount} items`);
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
    const firstResponse = await pricingRulesService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
    });

    const firstData = Array.isArray(firstResponse?.pricingRules)
      ? firstResponse.pricingRules
      : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        pricingRulesService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
          category: categoryFilter || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) =>
      Array.isArray(r?.pricingRules) ? r.pricingRules : []
    );

    return [...firstData, ...remainingData];
  }, [categoryFilter, debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
      records.map((item) => ({
        'Service Category': item.serviceCategory,
        Country: item.countryName,
        Abbreviation: item.countryAbbreviation,
        Procedure: item.procedureName,
        'Official Fee': item.officialFee,
        'Attorney Fee': item.attorneyFee,
        'Class Fee': item.classFee,
        Total: item.officialFee + item.attorneyFee + item.classFee,
        Created: new Date(item.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pricing Rules');
    XLSX.writeFile(wb, 'pricing-rules.csv');
    setSuccessMessage(`CSV exported (${records.length} rows)`);
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
        'Service Category': item.serviceCategory,
        Country: item.countryName,
        Abbreviation: item.countryAbbreviation,
        Procedure: item.procedureName,
        'Official Fee': item.officialFee,
        'Attorney Fee': item.attorneyFee,
        'Class Fee': item.classFee,
        Total: item.officialFee + item.attorneyFee + item.classFee,
        Created: new Date(item.createdAt).toLocaleDateString(),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pricing Rules');
    XLSX.writeFile(wb, 'pricing-rules.xlsx');
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
      head: [['Category', 'Country', 'Procedure', 'Official', 'Atty', 'Class', 'Total']],
      body: records.map((item) => {
        const totalFees = item.officialFee + item.attorneyFee + item.classFee;
        return [
          item.serviceCategory,
          item.countryName,
          item.procedureName,
          item.officialFee,
          item.attorneyFee,
          item.classFee,
          totalFees,
        ];
      }),
      startY: 10,
    });

    doc.save('pricing-rules.pdf');
    setSuccessMessage(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  const pricingRuleColumns: MuiDataTableColumn<PricingRule>[] = [
    {
      id: 'serviceCategory',
      label: 'Category',
      sortable: true,
      searchValue: (row) => row.serviceCategory,
      render: (row) => row.serviceCategory,
    },
    {
      id: 'countryName',
      label: 'Country',
      sortable: true,
      searchValue: (row) => `${row.countryName} ${row.countryAbbreviation}`,
      render: (row) => `${row.countryName} (${row.countryAbbreviation})`,
    },
    {
      id: 'procedureName',
      label: 'Procedure',
      sortable: true,
      searchValue: (row) => row.procedureName,
      render: (row) => row.procedureName,
    },
    {
      id: 'officialFee',
      label: 'Official',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.officialFee,
      render: (row) => row.officialFee,
    },
    {
      id: 'attorneyFee',
      label: 'Atty',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.attorneyFee,
      render: (row) => row.attorneyFee,
    },
    {
      id: 'classFee',
      label: 'Class',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.classFee,
      render: (row) => row.classFee,
    },
    {
      id: 'total',
      label: 'Total',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.officialFee + row.attorneyFee + row.classFee,
      render: (row) => row.officialFee + row.attorneyFee + row.classFee,
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
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => handleDeleteClick(row._id)}
          >
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4">Pricing Rules</Typography>
        <Button variant="contained" onClick={handleAdd}>
          + Add Rule
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                size="small"
              >
                <MenuItem value="">All Categories</MenuItem>
                {CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
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
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              id="import-pricing-rules-input"
            />
            <label htmlFor="import-pricing-rules-input" style={{ margin: 0 }}>
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
          title="No pricing rules found"
          description="Start by adding your first pricing rule"
          onAction={handleAdd}
          actionLabel="Add Pricing Rule"
        />
      ) : (
        !loading && (
          <>
            <MuiDataTable
              rows={items}
              columns={pricingRuleColumns}
              rowKey={(row) => row._id}
              page={page}
              rowsPerPage={limit}
              total={total}
              onPageChange={setPage}
              showToolbar={false}
              loading={false}
            />
          </>
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Service Category</InputLabel>
              <Select
                value={formData.serviceCategory}
                label="Service Category"
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    serviceCategory: e.target.value as PricingRule['serviceCategory'],
                    procedureName: '',
                  }))
                }
              >
                {CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={formData.countryName}
                label="Country"
                onChange={(e) => handlePickCountry(e.target.value)}
              >
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country.name}>
                    {country.name} ({country.abbreviation})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Country Abbreviation"
              value={formData.countryAbbreviation}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  countryAbbreviation: e.target.value.toUpperCase(),
                }))
              }
            />

            <FormControl fullWidth>
              <InputLabel>Procedure (From Model)</InputLabel>
              <Select
                value={
                  filteredProcedureOptions.some(
                    (procedure) => procedure.name === formData.procedureName
                  )
                    ? formData.procedureName
                    : ''
                }
                label="Procedure (From Model)"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, procedureName: e.target.value }))
                }
              >
                <MenuItem value="">Select procedure</MenuItem>
                {filteredProcedureOptions.map((procedure) => (
                  <MenuItem key={procedure._id} value={procedure.name}>
                    {procedure.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Procedure Name"
              value={formData.procedureName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, procedureName: e.target.value }))
              }
              helperText="You can type a custom procedure if it is not listed"
            />

            <TextField
              label="Official Fee"
              type="number"
              value={formData.officialFee}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, officialFee: e.target.value }))
              }
            />

            <TextField
              label="Attorney Fee"
              type="number"
              value={formData.attorneyFee}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, attorneyFee: e.target.value }))
              }
            />

            <TextField
              label="Class Fee"
              type="number"
              value={formData.classFee}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, classFee: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button
            onClick={() =>
              handleSubmitForm().catch(() => setError('Failed to save pricing rule'))
            }
            variant="contained"
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>View Pricing Rule</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Service Category
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingItem.serviceCategory}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Country
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingItem.countryName} ({viewingItem.countryAbbreviation})
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Procedure
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingItem.procedureName}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Official Fee
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingItem.officialFee}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Attorney Fee
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {viewingItem.attorneyFee}
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Class Fee
              </Typography>
              <Typography variant="body2">{viewingItem.classFee}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Pricing Rule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this pricing rule? This action cannot be undone.
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

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  );
}
