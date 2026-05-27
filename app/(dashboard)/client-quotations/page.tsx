'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  SvgIcon,
  Stack,
  Tab,
  Tabs,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import clientQuotationsService, { ClientQuotation, ClientQuotationServiceItem } from '@/services/client-quotations.service';
import { clientsService, Client } from '@/services/clients.service';
import inquiresService, { Inquire } from '@/services/inquires.service';
import requirementsService from '@/services/requirements.service';
import { pricingRulesService, PricingRule } from '@/services/pricing-rules.service';

type ClassType = 'single' | 'multi';
type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

interface RequirementOption {
  _id: string;
  countryName: string;
  requirements: string;
}

interface RequirementsState {
  loading: boolean;
  error: string;
  countryNames: string;
  serviceCategory: string;
  items: RequirementOption[];
}

interface ServiceDraft {
  procedureName: string;
  classType: ClassType;
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  attorneyFee: number;
  otherFees: number;
  discount: number;
}

const defaultServiceDraft: ServiceDraft = {
  procedureName: '',
  classType: 'single',
  numberOfClasses: 1,
  additionalFeePerClass: 0,
  officialFee: 0,
  attorneyFee: 0,
  otherFees: 0,
  discount: 0,
};

const toCurrency = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const SERVICE_COLOR_MAP: Record<ServiceCategory, string> = {
  Trademark: '#2563EB',
  Patent: '#16A34A',
  Design: '#9333EA',
  Copyright: '#F59E0B',
  Litigation: '#DC2626',
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

const computeClientRow = (service: ServiceDraft, category: ServiceCategory): ClientQuotationServiceItem => {
  const isTrademark = category === 'Trademark';
  const classType: ClassType = isTrademark && service.classType === 'multi' ? 'multi' : 'single';
  const numberOfClasses = classType === 'multi' ? Math.max(1, Math.floor(service.numberOfClasses || 1)) : 1;
  const additionalFeePerClass = classType === 'multi' ? Math.max(0, Number(service.additionalFeePerClass || 0)) : 0;
  const officialFee = Math.max(0, Number(service.officialFee || 0));
  const attorneyFee = Math.max(0, Number(service.attorneyFee || 0));
  const otherFees = Math.max(0, Number(service.otherFees || 0));
  const discount = Math.max(0, Number(service.discount || 0));
  const additionalClassFees = classType === 'multi' ? additionalFeePerClass * numberOfClasses : 0;
  const totalOfficialFees = officialFee + additionalClassFees;
  const totalAmount = totalOfficialFees + attorneyFee + otherFees;
  const grandTotal = Math.max(0, totalAmount - discount);

  return {
    procedureName: service.procedureName.trim(),
    classType,
    numberOfClasses,
    additionalFeePerClass,
    officialFee,
    additionalClassFees,
    totalOfficialFees,
    attorneyFee,
    officeFee: 0,
    otherFees,
    discount,
    totalAmount,
    grandTotal,
  };
};

export default function ClientQuotationsPage() {
  const [items, setItems] = useState<ClientQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ClientQuotation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [inquiries, setInquiries] = useState<Inquire[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(defaultServiceDraft);
  const [services, setServices] = useState<ClientQuotationServiceItem[]>([]);
  const [activeTab, setActiveTab] = useState<ServiceCategory>('Trademark');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tableSearch, setTableSearch] = useState('');
  const [requirementsState, setRequirementsState] = useState<RequirementsState>({
    loading: false,
    error: '',
    countryNames: '',
    serviceCategory: '',
    items: [],
  });
  const [priceRuleDialogOpen, setPriceRuleDialogOpen] = useState(false);
  const [priceRulesLoading, setPriceRulesLoading] = useState(false);
  const [priceRulesError, setPriceRulesError] = useState('');
  const [priceRules, setPriceRules] = useState<PricingRule[]>([]);
  const [priceRuleCountryFilter, setPriceRuleCountryFilter] = useState('');
  const [selectedPriceRuleId, setSelectedPriceRuleId] = useState('');

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [quotationRes, clientRes, inquireRes] = await Promise.all([
        clientQuotationsService.list({ page: 1, limit: 500 }),
        clientsService.list({ page: 1, limit: 1000 }),
        inquiresService.list({ page: 1, limit: 1000 }),
      ]);
      setItems(quotationRes.clientQuotations || []);
      setClients(clientRes.clients || []);
      setInquiries(inquireRes.inquires || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedClient = useMemo(() => clients.find((c) => c._id === selectedClientId), [clients, selectedClientId]);
  const selectedInquiry = useMemo(
    () => inquiries.find((i) => i._id === selectedInquiryId),
    [inquiries, selectedInquiryId]
  );
  const selectedRequirement = useMemo(
    () => requirementsState.items.find((item) => item._id === selectedRequirementId) || null,
    [requirementsState.items, selectedRequirementId]
  );
  const selectedPriceRule = useMemo(
    () => priceRules.find((rule) => rule._id === selectedPriceRuleId) || null,
    [priceRules, selectedPriceRuleId]
  );
  const inquiryCountries = useMemo(
    () =>
      Array.isArray(selectedInquiry?.countryIds)
        ? selectedInquiry.countryIds.map((country: any) => country?.name || '').filter(Boolean)
        : [],
    [selectedInquiry]
  );
  const availableRuleCountries = useMemo(
    () => Array.from(new Set(inquiryCountries)),
    [inquiryCountries]
  );

  const serviceCategory = ((selectedInquiry?.serviceId as any)?.category || 'Trademark') as ServiceCategory;
  const inquiryProjectRef = (selectedInquiry?.referenceNo || '') as string;
  const inquiryProcedure = ((selectedInquiry?.procedureId as any)?.name || '') as string;
  const inquiryCountry = inquiryCountries.join(', ');

  const filteredItems = useMemo(
    () => items.filter((q) => (q.serviceCategory || q.inquirySnapshot?.serviceCategory) === activeTab),
    [items, activeTab]
  );
  const searchedItems = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return filteredItems;
    return filteredItems.filter((row) => {
      const inquiry = (row.inquirySnapshot?.referenceNo || row.inquiryProjects?.join(', ') || '').toLowerCase();
      const service = (row.serviceCategory || row.inquirySnapshot?.serviceCategory || '').toLowerCase();
      const client = (row.clientSnapshot?.name || '').toLowerCase();
      const procedure = (row.inquirySnapshot?.procedureName || '').toLowerCase();
      return inquiry.includes(query) || service.includes(query) || client.includes(query) || procedure.includes(query);
    });
  }, [filteredItems, tableSearch]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return searchedItems.slice(start, start + rowsPerPage);
  }, [searchedItems, page, rowsPerPage]);

  const columns: MuiDataTableColumn<ClientQuotation>[] = [
    { id: 'inquiry', label: 'Inquiry Project', render: (r) => r.inquirySnapshot?.referenceNo || r.inquiryProjects?.join(', ') || '-' },
    {
      id: 'service',
      label: 'Service',
      render: (r) => {
        const service = (r.serviceCategory || r.inquirySnapshot?.serviceCategory || '-') as ServiceCategory;
        const color = SERVICE_COLOR_MAP[service];
        if (!color) return service;
        return (
          <Box
            component="span"
            sx={{ px: 1.2, py: 0.4, borderRadius: 999, color, bgcolor: `${color}1A`, fontWeight: 700, fontSize: 12 }}
          >
            {service}
          </Box>
        );
      },
    },
    { id: 'procedure', label: 'Procedure', render: (r) => <span style={{ color: '#7E57C2' }}>{r.inquirySnapshot?.procedureName || '-'}</span> },
    { id: 'client', label: 'Client', render: (r) => r.clientSnapshot?.name || (typeof r.clientId === 'object' ? r.clientId?.name : '-') || '-' },
    { id: 'country', label: 'Country', render: (r) => r.inquirySnapshot?.countryNames?.join(', ') || '-' },
    { id: 'official', label: 'Official Fees', align: 'right', render: (r) => toCurrency(r.totalOfficialFees || 0) },
    ...(activeTab === 'Trademark' ? [{ id: 'classType', label: 'Class Type', render: (r: ClientQuotation) => r.services?.[0]?.classType || '-' } as MuiDataTableColumn<ClientQuotation>] : []),
    { id: 'attorney', label: 'Attorney Fees', align: 'right', render: (r) => toCurrency(r.totalAttorneyFees || 0) },
    { id: 'total', label: 'Total', align: 'right', render: (r) => toCurrency(r.grandTotal || 0) },
    { id: 'date', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      id: 'actions',
      label: 'Action',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => { setViewingItem(row); setViewDialogOpen(true); }} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenEdit(row)} sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}>
              <NoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => { setDeletingId(row._id); setDeleteDialogOpen(true); }} sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}>
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const resetForm = () => {
    setEditingId(null);
    setSelectedClientId('');
    setSelectedInquiryId('');
    setSelectedRequirementId('');
    setServiceDraft(defaultServiceDraft);
    setServices([]);
    setRequirementsState({
      loading: false,
      error: '',
      countryNames: '',
      serviceCategory: '',
      items: [],
    });
    setPriceRuleDialogOpen(false);
    setPriceRulesLoading(false);
    setPriceRulesError('');
    setPriceRules([]);
    setPriceRuleCountryFilter('');
    setSelectedPriceRuleId('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const handleOpenEdit = (row: ClientQuotation) => {
    setEditingId(row._id);
    setSelectedClientId(typeof row.clientId === 'object' ? row.clientId?._id || '' : (row.clientId || ''));
    setSelectedInquiryId(
      typeof row.inquiryId === 'object' ? row.inquiryId?._id || '' : (row.inquiryId || '')
    );
    setSelectedRequirementId(
      typeof row.requirementId === 'object' ? row.requirementId?._id || '' : (row.requirementId || '')
    );
    setServices(Array.isArray(row.services) ? row.services : []);
    setServiceDraft(defaultServiceDraft);
    setActiveTab((row.serviceCategory || row.inquirySnapshot?.serviceCategory || 'Trademark') as ServiceCategory);
    setOpenForm(true);
  };

  const handleAddService = () => {
    if (!serviceDraft.procedureName.trim()) return setError('Procedure is required');
    setServices((prev) => [...prev, computeClientRow(serviceDraft, serviceCategory)]);
    setServiceDraft((prev) => ({ ...defaultServiceDraft, procedureName: prev.procedureName }));
  };

  const handleSave = async () => {
    if (!selectedClientId) return setError('Client is required');
    if (!selectedInquiryId) return setError('Inquiry project is required');
    if (requirementsState.items.length > 0 && !selectedRequirementId) {
      return setError('Requirement selection is required');
    }
    if (services.length === 0) return setError('Add at least one service row');

    try {
      const payload = {
        clientId: selectedClientId,
        inquiryId: selectedInquiryId,
        requirementId: selectedRequirementId || undefined,
        services: services.map((s) => ({
          procedureName: s.procedureName,
          classType: s.classType,
          numberOfClasses: s.numberOfClasses,
          additionalFeePerClass: s.additionalFeePerClass,
          officialFee: s.officialFee,
          attorneyFee: s.attorneyFee,
          otherFees: s.otherFees,
          discount: s.discount,
        })),
      };
      let saved: ClientQuotation;
      if (editingId) {
        saved = await clientQuotationsService.update(editingId, payload);
        setSuccess('Client quotation updated successfully');
      } else {
        saved = await clientQuotationsService.create(payload);
        setSuccess('Client quotation created successfully');
      }
      const savedCategory = (saved.serviceCategory || saved.inquirySnapshot?.serviceCategory || serviceCategory) as ServiceCategory;
      setActiveTab(savedCategory);
      setTableSearch('');
      setOpenForm(false);
      resetForm();
      setPage(1);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create quotation');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchRequirements = async () => {
      if (!selectedInquiry) {
        setRequirementsState({
          loading: false,
          error: '',
          countryNames: '',
          serviceCategory: '',
          items: [],
        });
        setSelectedRequirementId('');
        return;
      }

      const countryNames = Array.isArray(selectedInquiry.countryIds)
        ? selectedInquiry.countryIds.map((c: any) => c?.name || '').filter(Boolean).join(', ')
        : '';
      const selectedServiceCategory = ((selectedInquiry.serviceId as any)?.category || '') as string;
      setRequirementsState({
        loading: true,
        error: '',
        countryNames,
        serviceCategory: selectedServiceCategory,
        items: [],
      });

      try {
        const countryIds = Array.isArray(selectedInquiry.countryIds)
          ? selectedInquiry.countryIds.map((c: any) => (typeof c === 'string' ? c : c?._id)).filter(Boolean)
          : [];
        const requirementsAcc: RequirementOption[] = [];
        for (const countryId of countryIds) {
          const response = await requirementsService.list(
            1,
            1000,
            undefined,
            countryId,
            undefined,
            undefined,
            (selectedServiceCategory || undefined) as ServiceCategory | undefined
          );
          const rows = Array.isArray(response.data?.data) ? response.data.data : [];
          rows.forEach((row: any) => {
            requirementsAcc.push({
              _id: row._id,
              countryName: row.country?.name || '',
              requirements: row.requirements || '',
            });
          });
        }

        if (cancelled) return;
        setRequirementsState({
          loading: false,
          error: '',
          countryNames,
          serviceCategory: selectedServiceCategory,
          items: requirementsAcc,
        });
        setSelectedRequirementId((prev) => prev || requirementsAcc[0]?._id || '');
      } catch {
        if (cancelled) return;
        setRequirementsState({
          loading: false,
          error: 'Failed to load requirements',
          countryNames,
          serviceCategory: selectedServiceCategory,
          items: [],
        });
        setSelectedRequirementId('');
      }
    };

    fetchRequirements().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedInquiry]);

  useEffect(() => {
    let cancelled = false;

    const fetchPriceRules = async () => {
      if (!priceRuleDialogOpen || !selectedInquiry) return;

      setPriceRulesLoading(true);
      setPriceRulesError('');
      try {
        const countryFilter = priceRuleCountryFilter || inquiryCountries[0] || undefined;
        const response = await pricingRulesService.list({
          page: 1,
          limit: 1000,
          category: serviceCategory,
          country: countryFilter,
        });
        if (cancelled) return;
        setPriceRules(response.pricingRules || []);
        setSelectedPriceRuleId((prev) => prev || response.pricingRules?.[0]?._id || '');
      } catch (err: any) {
        if (cancelled) return;
        setPriceRules([]);
        setSelectedPriceRuleId('');
        setPriceRulesError(err.response?.data?.error || err.message || 'Failed to load price rules');
      } finally {
        if (!cancelled) setPriceRulesLoading(false);
      }
    };

    fetchPriceRules().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [priceRuleDialogOpen, selectedInquiry, serviceCategory, priceRuleCountryFilter, inquiryCountries]);

  const handleOpenPriceRules = () => {
    if (!selectedInquiry) {
      setError('Select inquiry project first');
      return;
    }
    setPriceRuleCountryFilter(inquiryCountries[0] || '');
    setSelectedPriceRuleId('');
    setPriceRuleDialogOpen(true);
  };

  const handleApplyPriceRule = () => {
    if (!selectedPriceRule) {
      setError('Select a price rule');
      return;
    }

    setServiceDraft((prev) => ({
      ...prev,
      procedureName: selectedPriceRule.procedureName || prev.procedureName,
      officialFee: Math.max(0, Number(selectedPriceRule.officialFee || 0)),
      attorneyFee: Math.max(0, Number(selectedPriceRule.attorneyFee || 0)),
      additionalFeePerClass:
        serviceCategory === 'Trademark' ? Math.max(0, Number(selectedPriceRule.classFee || 0)) : 0,
    }));
    setPriceRuleDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await clientQuotationsService.delete(deletingId);
      setSuccess('Client quotation deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingId(null);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete quotation');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Client Quotations</Typography>
        <Button variant="contained" onClick={handleOpenCreate}>+ Add Client Quotation</Button>
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab value="Trademark" label="Trademark" />
        <Tab value="Patent" label="Patent" />
        <Tab value="Design" label="Design" />
        <Tab value="Litigation" label="Litigation" />
        <Tab value="Copyright" label="Copyright" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search inquiry, service, procedure, client..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(1);
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Rows"
                size="small"
                fullWidth
                value={String(rowsPerPage)}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                <MenuItem value="5">5</MenuItem>
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box> : filteredItems.length === 0 ? (
        <EmptyState title={`No ${activeTab} quotations`} description="Create a quotation to see it here" />
      ) : (
        <MuiDataTable
          rows={pagedRows}
          columns={columns}
          rowKey={(r) => r._id}
          page={page}
          rowsPerPage={rowsPerPage}
          total={searchedItems.length}
          onPageChange={setPage}
          onRowsPerPageChange={(next) => {
            setRowsPerPage(next);
            setPage(1);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
          showToolbar
          loading={false}
        />
      )}

      <Dialog open={openForm} onClose={() => { setOpenForm(false); resetForm(); }} maxWidth="lg" fullWidth>
        <DialogTitle>{editingId ? 'Edit Client Quotation' : 'Create Client Quotation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Client Quotations</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete options={clients} getOptionLabel={(o) => o.name || ''} value={selectedClient || null} onChange={(_, v) => setSelectedClientId(v?._id || '')} renderInput={(p) => <TextField {...p} label="Client *" />} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    options={inquiries}
                    getOptionLabel={(o) => o.referenceNo || ''}
                    value={selectedInquiry || null}
                    onChange={(_, value) => {
                      setSelectedInquiryId(value?._id || '');
                      setSelectedRequirementId('');
                      setServiceDraft((p) => ({
                        ...p,
                        procedureName: ((value?.procedureId as any)?.name || ''),
                      }));
                    }}
                    renderInput={(p) => <TextField {...p} label="Inquiry Project *" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Inquiry Project" value={inquiryProjectRef} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Procedure" value={inquiryProcedure} fullWidth slotProps={{ input: { readOnly: true } }} sx={{ '& .MuiInputBase-input': { color: '#7E57C2' } }} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Country" value={inquiryCountry} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Service" value={serviceCategory} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>Requirements</Typography>
                      {!selectedInquiry ? (
                        <Typography color="text.secondary">Select inquiry project to load requirements.</Typography>
                      ) : requirementsState.loading ? (
                        <Typography variant="body2" color="text.secondary">Loading requirements...</Typography>
                      ) : requirementsState.error ? (
                        <Typography variant="body2" color="error">{requirementsState.error}</Typography>
                      ) : !requirementsState.items.length ? (
                        <Typography variant="body2" color="text.secondary">
                          No requirements available for this country and service.
                        </Typography>
                      ) : (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              Service: {requirementsState.serviceCategory || '-'} | Country: {requirementsState.countryNames || '-'}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <Autocomplete
                              options={requirementsState.items}
                              value={selectedRequirement}
                              onChange={(_, value) => setSelectedRequirementId(value?._id || '')}
                              getOptionLabel={(option) => `${option.countryName} - ${stripHtml(option.requirements).slice(0, 80)}`}
                              renderInput={(params) => <TextField {...params} label="Requirement *" />}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              label="Requirement Country"
                              value={selectedRequirement?.countryName || ''}
                              fullWidth
                              slotProps={{ input: { readOnly: true } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 8 }}>
                            <TextField
                              label="Requirements"
                              value={selectedRequirement ? stripHtml(selectedRequirement.requirements || '') : ''}
                              fullWidth
                              multiline
                              minRows={4}
                              slotProps={{ input: { readOnly: true } }}
                            />
                          </Grid>
                        </Grid>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Service Details</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Procedure"
                    value={serviceDraft.procedureName}
                    onChange={(e) => setServiceDraft((p) => ({ ...p, procedureName: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Button variant="outlined" fullWidth onClick={handleOpenPriceRules}>
                    Select Price Rule
                  </Button>
                </Grid>
                {serviceCategory === 'Trademark' && (
                  <>
                    <Grid size={{ xs: 12, md: 4 }}><FormControl fullWidth><InputLabel>Class Type</InputLabel><Select value={serviceDraft.classType} label="Class Type" onChange={(e) => setServiceDraft((p) => ({ ...p, classType: e.target.value as ClassType }))}><MenuItem value="single">Single</MenuItem><MenuItem value="multi">Multi</MenuItem></Select></FormControl></Grid>
                    {serviceDraft.classType === 'multi' && (
                      <>
                        <Grid size={{ xs: 12, md: 4 }}><TextField type="number" label="Number of Classes" value={serviceDraft.numberOfClasses} onChange={(e) => setServiceDraft((p) => ({ ...p, numberOfClasses: Math.max(1, Number(e.target.value) || 1) }))} fullWidth /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField type="number" label="Additional Fee Per Class" value={serviceDraft.additionalFeePerClass} onChange={(e) => setServiceDraft((p) => ({ ...p, additionalFeePerClass: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                      </>
                    )}
                  </>
                )}
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Official Fees" value={serviceDraft.officialFee} onChange={(e) => setServiceDraft((p) => ({ ...p, officialFee: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Attorney Fees" value={serviceDraft.attorneyFee} onChange={(e) => setServiceDraft((p) => ({ ...p, attorneyFee: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Other Fees" value={serviceDraft.otherFees} onChange={(e) => setServiceDraft((p) => ({ ...p, otherFees: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Discount" value={serviceDraft.discount} onChange={(e) => setServiceDraft((p) => ({ ...p, discount: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Button variant="outlined" fullWidth onClick={handleAddService}>Add Service</Button></Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                {services.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No services in cart yet.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Procedure</TableCell>
                          {serviceCategory === 'Trademark' && <TableCell>Class Type</TableCell>}
                          {serviceCategory === 'Trademark' && <TableCell align="right">No. Classes</TableCell>}
                          <TableCell align="right">Official Fees</TableCell>
                          {serviceCategory === 'Trademark' && <TableCell align="right">Additional Class Fees</TableCell>}
                          <TableCell align="right">Attorney Fees</TableCell>
                          <TableCell align="right">Other Fees</TableCell>
                          <TableCell align="right">Discount</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {services.map((s, i) => (
                          <TableRow key={`${s.procedureName}-${i}`}>
                            <TableCell>{s.procedureName}</TableCell>
                            {serviceCategory === 'Trademark' && <TableCell>{s.classType}</TableCell>}
                            {serviceCategory === 'Trademark' && <TableCell align="right">{s.numberOfClasses}</TableCell>}
                            <TableCell align="right">{toCurrency(s.officialFee)}</TableCell>
                            {serviceCategory === 'Trademark' && <TableCell align="right">{toCurrency(s.additionalClassFees)}</TableCell>}
                            <TableCell align="right">{toCurrency(s.attorneyFee)}</TableCell>
                            <TableCell align="right">{toCurrency(s.otherFees)}</TableCell>
                            <TableCell align="right">{toCurrency(s.discount)}</TableCell>
                            <TableCell align="right">{toCurrency(s.grandTotal)}</TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error" onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}>
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </CardContent></Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenForm(false); resetForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>{editingId ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={priceRuleDialogOpen} onClose={() => setPriceRuleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Select Price Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Service"
                  value={serviceCategory}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Country"
                  value={priceRuleCountryFilter}
                  onChange={(e) => setPriceRuleCountryFilter(e.target.value)}
                  fullWidth
                >
                  {availableRuleCountries.map((country) => (
                    <MenuItem key={country} value={country}>
                      {country}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  options={priceRules}
                  value={selectedPriceRule}
                  onChange={(_, value) => setSelectedPriceRuleId(value?._id || '')}
                  getOptionLabel={(option) =>
                    `${option.procedureName} | ${option.countryName} | Official ${toCurrency(option.officialFee)}`
                  }
                  loading={priceRulesLoading}
                  renderInput={(params) => (
                    <TextField {...params} label="Price Rule *" />
                  )}
                />
              </Grid>
            </Grid>

            {priceRulesLoading ? (
              <Typography color="text.secondary">Loading price rules...</Typography>
            ) : priceRulesError ? (
              <Typography color="error">{priceRulesError}</Typography>
            ) : !priceRules.length ? (
              <Typography color="text.secondary">No price rules found for the selected filters.</Typography>
            ) : null}

            {selectedPriceRule && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Official Fees"
                    value={toCurrency(selectedPriceRule.officialFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Attorney Fees"
                    value={toCurrency(selectedPriceRule.attorneyFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Additional Fee/Class"
                    value={toCurrency(selectedPriceRule.classFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceRuleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApplyPriceRule}>
            Apply Rule
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>View Client Quotation</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={1.25} sx={{ pt: 1 }}>
              <Typography><strong>Inquiry Project:</strong> {viewingItem.inquirySnapshot?.referenceNo || viewingItem.inquiryProjects?.join(', ') || '-'}</Typography>
              <Typography><strong>Service:</strong> {viewingItem.serviceCategory || viewingItem.inquirySnapshot?.serviceCategory || '-'}</Typography>
              <Typography><strong>Procedure:</strong> <span style={{ color: '#7E57C2' }}>{viewingItem.inquirySnapshot?.procedureName || '-'}</span></Typography>
              <Typography><strong>Client:</strong> {viewingItem.clientSnapshot?.name || '-'}</Typography>
              <Typography><strong>Country:</strong> {viewingItem.inquirySnapshot?.countryNames?.join(', ') || '-'}</Typography>
              <Typography><strong>Requirement Country:</strong> {viewingItem.requirementSnapshot?.countryName || '-'}</Typography>
              <TextField
                label="Requirements"
                value={stripHtml(viewingItem.requirementSnapshot?.requirements || '')}
                fullWidth
                multiline
                minRows={4}
                slotProps={{ input: { readOnly: true } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Client Quotation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this quotation?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>{success}</Alert>
      </Snackbar>
    </Box>
  );
}
