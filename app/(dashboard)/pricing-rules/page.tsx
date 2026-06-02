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
  IconButton,
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
  Tab,
  Tabs,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { EmptyState } from '@/components/ui';
import { pricingRulesService } from '@/services/pricing-rules.service';
import { countriesService } from '@/services/countries.service';
import { proceduresService } from '@/services/procedures.service';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

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
  isActive: boolean;
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
  const { user } = useAuth();
  const { canAdd, canEdit, canDelete, canView } = usePermission();
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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [activeTab, setActiveTab] = useState('all');
  const [flagSize, setFlagSize] = useState(40);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    flag: 70,
    country: 180,
    procedure: 260,
    officialFee: 120,
    attorneyFee: 120,
    total: 120,
    status: 120,
    actions: 170,
  });
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

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
  const headerRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const rowRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const handleColumnResize = (columnId: string) => {
    const ref = headerRefs.current[columnId];
    if (!ref) return;
    const width = Math.max(60, ref.getBoundingClientRect().width);
    setColumnWidths((prev) => ({ ...prev, [columnId]: width }));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem('pricingRules.columnWidths');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setColumnWidths((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore invalid storage values
      }
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem('pricingRules.columnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

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
      nextStatus?: string;
    }) => {
      const nextPage = params?.nextPage ?? page;
      const nextSearch = params?.nextSearch ?? debouncedSearch;
      const nextCategory = params?.nextCategory ?? categoryFilter;
      const nextStatus = params?.nextStatus ?? (statusFilter === 'All' ? 'all' : statusFilter.toLowerCase());

      try {
        setLoading(true);
        setError('');
        const response = await pricingRulesService.list({
          page: nextPage,
          limit,
          search: nextSearch || undefined,
          category: nextCategory || undefined,
          status: nextStatus || undefined,
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
    [categoryFilter, debouncedSearch, limit, page, statusFilter]
  );

  useEffect(() => {
    const statusParam = statusFilter === 'All' ? 'all' : statusFilter.toLowerCase();
    fetchItems({
      nextPage: page,
      nextSearch: debouncedSearch,
      nextCategory: categoryFilter,
      nextStatus: statusParam,
    });
  }, [categoryFilter, debouncedSearch, statusFilter, fetchItems, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, activeTab]);

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
        showSuccessToast('Pricing rule updated successfully');
      } else {
        await pricingRulesService.create(payload);
        showSuccessToast('Pricing rule created successfully');
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
      showSuccessToast('Pricing rule deleted successfully');
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
        showSuccessToast(`Imported ${importedCount} items`);
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
    const statusParam = statusFilter === 'All' ? 'all' : statusFilter.toLowerCase();
    const firstResponse = await pricingRulesService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      status: statusParam,
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
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!mounted) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Pricing Rules" />

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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              label="Search country, service, procedure"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 280 }}
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => {
                  const value = e.target.value as string;
                  setCategoryFilter(value);
                  setActiveTab(value || 'all');
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
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive');
                  setPage(1);
                }}
                size="small"
              >
                <MenuItem value="All">All Status</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Flag width"
              type="number"
              size="small"
              sx={{ width: 140 }}
              value={flagSize}
              slotProps={{ input: { min: 24, max: 120 } }}
              onChange={(e) => setFlagSize(Math.max(24, Math.min(120, Number(e.target.value))))}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
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
          <Card>
            <CardContent sx={{ p: 0, overflowX: 'auto' }}>
              <Tabs
                value={activeTab}
                onChange={(_, value) => {
                  setActiveTab(value);
                  const normalizedCategory = value === 'all' ? '' : value;
                  setCategoryFilter(normalizedCategory);
                  setPage(1);
                }}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
              >
                <Tab label="All Services" value="all" />
                {CATEGORIES.map((category) => (
                  <Tab key={category} label={category} value={category} />
                ))}
              </Tabs>

              <TableContainer component={Paper} sx={{ maxHeight: '65vh', overflow: 'auto' }}>
                <Table sx={{ minWidth: 1000, borderCollapse: 'collapse' }} stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.flag = el;
                        }}
                        onPointerUp={() => handleColumnResize('flag')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          left: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Flag
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.country = el;
                        }}
                        onPointerUp={() => handleColumnResize('country')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          left: columnWidths.flag,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Country
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.procedure = el;
                        }}
                        onPointerUp={() => handleColumnResize('procedure')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          minWidth: columnWidths.procedure,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Procedure
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.officialFee = el;
                        }}
                        onPointerUp={() => handleColumnResize('officialFee')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          textAlign: 'right',
                          minWidth: columnWidths.officialFee,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Official Fee
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.attorneyFee = el;
                        }}
                        onPointerUp={() => handleColumnResize('attorneyFee')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          textAlign: 'right',
                          minWidth: columnWidths.attorneyFee,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Attorney Fee
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.total = el;
                        }}
                        onPointerUp={() => handleColumnResize('total')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          textAlign: 'right',
                          minWidth: columnWidths.total,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Total
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.status = el;
                        }}
                        onPointerUp={() => handleColumnResize('status')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          minWidth: columnWidths.status,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        ref={(el) => {
                          if (el) headerRefs.current.actions = el;
                        }}
                        onPointerUp={() => handleColumnResize('actions')}
                        sx={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          px: 1,
                          textAlign: 'center',
                          minWidth: columnWidths.actions,
                          resize: 'horizontal',
                          overflow: 'auto',
                        }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => {
                      const countryCode = String(item.countryAbbreviation || item.countryName)
                        .slice(0, 2)
                        .toLowerCase();
                      const totalAmount = (item.officialFee || 0) + (item.attorneyFee || 0) + (item.classFee || 0);
                      const rowHeight = rowHeights[item._id] || 'auto';

                      return (
                        <TableRow
                          key={item._id}
                          sx={{
                            backgroundColor: index % 2 === 0 ? 'background.paper' : 'action.hover',
                            '&:hover': { backgroundColor: 'action.selected' },
                          }}
                        >
                          <TableCell
                            sx={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              backgroundColor: 'background.paper',
                              minWidth: columnWidths.flag,
                              width: columnWidths.flag,
                            }}
                          >
                            <Box
                              component="img"
                              src={`https://flagcdn.com/24x18/${countryCode}.png`}
                              alt={`${item.countryName} flag`}
                              sx={{
                                width: flagSize,
                                height: Math.round(flagSize * 0.7),
                                objectFit: 'cover',
                                borderRadius: 1,
                                border: '1px solid rgba(0,0,0,0.08)',
                              }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              position: 'sticky',
                              left: columnWidths.flag,
                              zIndex: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              backgroundColor: 'background.paper',
                              minWidth: columnWidths.country,
                              width: columnWidths.country,
                            }}
                          >
                            <Box
                              ref={(el) => {
                                if (el) rowRefs.current[item._id] = el;
                              }}
                              sx={{
                                minHeight: rowHeight,
                                resize: 'vertical',
                                overflow: 'auto',
                              }}
                              onPointerUp={(event) => {
                                const target = event.currentTarget as HTMLDivElement;
                                const height = target.getBoundingClientRect().height;
                                setRowHeights((prev) => ({ ...prev, [item._id]: height }));
                              }}
                            >
                              <Typography sx={{ fontWeight: 600 }}>{item.countryName}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.countryAbbreviation}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              minWidth: columnWidths.procedure,
                              width: columnWidths.procedure,
                            }}
                          >
                            <Box
                              sx={{
                                minHeight: rowHeight,
                                resize: 'vertical',
                                overflow: 'auto',
                              }}
                            >
                              {item.procedureName}
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              textAlign: 'right',
                            }}
                          >
                            <Box sx={{ minHeight: rowHeight, resize: 'vertical', overflow: 'auto' }}>
                              {item.officialFee.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              textAlign: 'right',
                            }}
                          >
                            <Box sx={{ minHeight: rowHeight, resize: 'vertical', overflow: 'auto' }}>
                              {item.attorneyFee.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              px: 1,
                              textAlign: 'right',
                            }}
                          >
                            <Box sx={{ minHeight: rowHeight, resize: 'vertical', overflow: 'auto' }}>
                              {totalAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ border: '1px solid', borderColor: 'divider', px: 1 }}>
                            <Box sx={{ minHeight: rowHeight, resize: 'vertical', overflow: 'auto' }}>
                              <Chip
                                label={item.isActive ? 'Active' : 'Inactive'}
                                color={item.isActive ? 'success' : 'default'}
                                size="small"
                              />
                            </Box>
                          </TableCell>
                          <TableCell sx={{ border: '1px solid', borderColor: 'divider', px: 1, textAlign: 'center' }}>
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                              <Button size="small" variant="text" onClick={() => handleView(item)}>
                                👁
                              </Button>
                              <Button size="small" variant="text" onClick={() => handleEdit(item)}>
                                ✎
                              </Button>
                              <Button size="small" variant="text" color="error" onClick={() => handleDeleteClick(item._id)}>
                                ✕
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {`Showing ${items.length} of ${total} rules`}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Rows</InputLabel>
                    <Select
                      value={limit}
                      label="Rows"
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[10, 20, 50, 100].map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, nextPage) => setPage(nextPage)}
                    color="primary"
                    siblingCount={1}
                    boundaryCount={1}
                  />
                </Stack>
              </Box>
            </CardContent>
          </Card>
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
      </Box>
    </Box>
  );
}
