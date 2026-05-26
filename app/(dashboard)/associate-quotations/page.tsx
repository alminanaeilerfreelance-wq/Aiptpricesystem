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
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import associteService from '@/services/associte.service';
import { pricingRulesService } from '@/services/pricing-rules.service';
import associateQuotationsService, {
  AssociateQuotation,
  AssociateQuotationServiceItem,
} from '@/services/associate-quotations.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

type ClassType = 'single' | 'multi';
type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

const SERVICE_OPTIONS: ServiceCategory[] = [
  'Trademark',
  'Patent',
  'Copyright',
  'Design',
  'Litigation',
];

const SERVICE_CODE_MAP: Record<ServiceCategory, string> = {
  Trademark: 'T',
  Patent: 'P',
  Copyright: 'C',
  Design: 'D',
  Litigation: 'L',
};

interface AssociateOption {
  _id: string;
  associteName: string;
  country?: string;
  email?: string;
  associteType?: string;
  contact?: string;
  address?: string;
  notes?: string;
}

interface PricingProcedureOption {
  serviceCategory: ServiceCategory;
  procedureName: string;
}

interface ServiceDraft {
  procedureName: string;
  classType: ClassType;
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  attorneyFee: number;
  officeFee: number;
  otherFees: number;
}

const defaultServiceDraft: ServiceDraft = {
  procedureName: '',
  classType: 'single',
  numberOfClasses: 1,
  additionalFeePerClass: 0,
  officialFee: 0,
  attorneyFee: 0,
  officeFee: 0,
  otherFees: 0,
};

const toCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalizeAssociate = (associateId: AssociateQuotation['associateId']): string | undefined => {
  if (!associateId) return undefined;
  if (typeof associateId === 'string') return associateId;
  return associateId._id;
};

const computeAssociateRow = (service: ServiceDraft): AssociateQuotationServiceItem => {
  const classType: ClassType = service.classType === 'multi' ? 'multi' : 'single';
  const numberOfClasses = classType === 'multi' ? Math.max(1, Math.floor(service.numberOfClasses || 1)) : 1;
  const additionalFeePerClass = classType === 'multi' ? Math.max(0, Number(service.additionalFeePerClass || 0)) : 0;
  const officialFee = Math.max(0, Number(service.officialFee || 0));
  const attorneyFee = Math.max(0, Number(service.attorneyFee || 0));
  const officeFee = Math.max(0, Number(service.officeFee || 0));
  const otherFees = Math.max(0, Number(service.otherFees || 0));

  const additionalClassFees = classType === 'multi' ? additionalFeePerClass * numberOfClasses : 0;
  const totalOfficialFees = officialFee + additionalClassFees;
  const totalAmount = totalOfficialFees + attorneyFee + officeFee + otherFees;
  const grandTotal = totalAmount;

  return {
    procedureName: service.procedureName.trim(),
    classType,
    numberOfClasses,
    additionalFeePerClass,
    officialFee,
    additionalClassFees,
    totalOfficialFees,
    attorneyFee,
    officeFee,
    otherFees,
    totalAmount,
    grandTotal,
  };
};

const computeTotals = (services: AssociateQuotationServiceItem[]) =>
  services.reduce(
    (acc, item) => {
      acc.totalOfficialFees += item.totalOfficialFees;
      acc.totalAttorneyFees += item.attorneyFee;
      acc.totalOfficeFees += item.officeFee;
      acc.totalOtherFees += item.otherFees;
      acc.grandTotal += item.grandTotal;
      return acc;
    },
    {
      totalOfficialFees: 0,
      totalAttorneyFees: 0,
      totalOfficeFees: 0,
      totalOtherFees: 0,
      grandTotal: 0,
    }
  );

export default function AssociateQuotationsPage() {
  const [mounted, setMounted] = useState(false);

  const [items, setItems] = useState<AssociateQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [associates, setAssociates] = useState<AssociateOption[]>([]);
  const [allProcedureOptions, setAllProcedureOptions] = useState<PricingProcedureOption[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<ServiceCategory>('Trademark');
  const [inquiryProject, setInquiryProject] = useState('');
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(defaultServiceDraft);
  const [services, setServices] = useState<AssociateQuotationServiceItem[]>([]);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<AssociateQuotation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedAssociate = useMemo(
    () => associates.find((associate) => associate._id === selectedAssociateId) || null,
    [associates, selectedAssociateId]
  );

  const procedureOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allProcedureOptions
            .filter((item) => item.serviceCategory === selectedServiceCategory)
            .map((item) => item.procedureName.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [allProcedureOptions, selectedServiceCategory]
  );

  const referencePreview = useMemo(() => {
    const year = new Date().getFullYear();
    const serviceCode = SERVICE_CODE_MAP[selectedServiceCategory];
    const rawCountry = (selectedAssociate?.country || '').trim();
    const country = rawCountry
      ? rawCountry
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((item) => item[0]?.toUpperCase() || '')
          .join('')
          .slice(0, 3) || rawCountry.slice(0, 2).toUpperCase()
      : 'XX';
    return `${serviceCode} ${year}-0001 ${country}`;
  }, [selectedAssociate?.country, selectedServiceCategory]);

  const totals = useMemo(() => computeTotals(services), [services]);

  const loadLookups = useCallback(async () => {
    const [associateRes, pricingRes] = await Promise.all([
      associteService.list({ page: 1, limit: 1000 }),
      pricingRulesService.list({ page: 1, limit: 1000 }),
    ]);

    const normalizedAssociates = Array.isArray(associateRes.assocites)
      ? associateRes.assocites.map((item) => ({
          _id: item._id,
          associteName: item.associteName,
          country: item.country,
          email: item.email,
          associteType: item.associteType,
          contact: item.contact,
          address: item.address,
          notes: item.notes,
        }))
      : [];

    setAssociates(normalizedAssociates);

    const procedurePairs = Array.isArray(pricingRes.pricingRules)
      ? pricingRes.pricingRules
          .filter(
            (item) =>
              SERVICE_OPTIONS.includes(item.serviceCategory as ServiceCategory) &&
              String(item.procedureName || '').trim()
          )
          .map((item) => ({
            serviceCategory: item.serviceCategory as ServiceCategory,
            procedureName: item.procedureName,
          }))
      : [];

    setAllProcedureOptions(procedurePairs);
  }, []);

  const fetchItems = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    try {
      setLoading(true);
      setError('');
      const response = await associateQuotationsService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setItems(Array.isArray(response.associateQuotations) ? response.associateQuotations : []);
      setTotal(response.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load associate quotations');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, limit, page]);

  useEffect(() => {
    fetchItems({ nextPage: page, nextSearch: debouncedSearch });
  }, [page, debouncedSearch, fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    loadLookups().catch(() => {
      setAssociates([]);
      setAllProcedureOptions([]);
    });
  }, [loadLookups]);

  const resetFormState = () => {
    setEditingId(null);
    setSelectedAssociateId('');
    setSelectedServiceCategory('Trademark');
    setInquiryProject('');
    setServiceDraft(defaultServiceDraft);
    setServices([]);
  };

  const handleAdd = () => {
    resetFormState();
    setOpenForm(true);
  };

  const handleEdit = (item: AssociateQuotation) => {
    setEditingId(item._id);
    setSelectedAssociateId(normalizeAssociate(item.associateId) || '');
    setSelectedServiceCategory(item.serviceCategory || 'Trademark');
    setInquiryProject(item.inquiryProject || '');
    setServices(Array.isArray(item.services) ? item.services : []);
    setServiceDraft(defaultServiceDraft);
    setOpenForm(true);
  };

  const handleView = (item: AssociateQuotation) => {
    setViewingItem(item);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    resetFormState();
  };

  const handleAddService = () => {
    if (!serviceDraft.procedureName.trim()) {
      setError('Procedure is required before adding service row');
      return;
    }

    const row = computeAssociateRow(serviceDraft);
    setServices((prev) => [...prev, row]);
    setServiceDraft(defaultServiceDraft);
  };

  const handleRemoveService = (index: number) => {
    setServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitForm = async () => {
    if (!selectedAssociateId) {
      setError('Associate is required');
      return;
    }
    if (!selectedServiceCategory) {
      setError('Service category is required');
      return;
    }
    if (!inquiryProject.trim()) {
      setError('Inquiry project is required');
      return;
    }
    if (services.length === 0) {
      setError('At least one service row is required');
      return;
    }

    const payload = {
      associateId: selectedAssociateId,
      serviceCategory: selectedServiceCategory,
      inquiryProject: inquiryProject.trim(),
      services: services.map((service) => ({
        procedureName: service.procedureName,
        classType: service.classType,
        numberOfClasses: service.numberOfClasses,
        additionalFeePerClass: service.additionalFeePerClass,
        officialFee: service.officialFee,
        attorneyFee: service.attorneyFee,
        officeFee: service.officeFee,
        otherFees: service.otherFees,
      })),
      status: 'Draft' as const,
    };

    try {
      setLoading(true);
      setError('');
      if (editingId) {
        await associateQuotationsService.update(editingId, payload);
        setSuccessMessage('Associate quotation updated successfully');
      } else {
        await associateQuotationsService.create(payload);
        setSuccessMessage('Associate quotation created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save associate quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await associateQuotationsService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) setPage(targetPage);
      else await fetchItems({ nextPage: targetPage });
      setSuccessMessage('Associate quotation deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete associate quotation');
    } finally {
      setLoading(false);
    }
  };

  const columns: MuiDataTableColumn<AssociateQuotation>[] = [
    {
      id: 'quotationNo',
      label: 'Quotation No',
      sortable: true,
      searchValue: (row) => row.quotationNo,
      render: (row) => row.quotationNo,
    },
    {
      id: 'serviceCategory',
      label: 'Service',
      sortable: true,
      minWidth: 130,
      searchValue: (row) => row.serviceCategory || '',
      render: (row) => row.serviceCategory || '-',
    },
    {
      id: 'associate',
      label: 'Associate',
      sortable: true,
      minWidth: 180,
      searchValue: (row) =>
        row.associateSnapshot?.associteName ||
        (typeof row.associateId === 'object' ? row.associateId?.associteName || '' : ''),
      render: (row) =>
        row.associateSnapshot?.associteName ||
        (typeof row.associateId === 'object' ? row.associateId?.associteName || '-' : '-'),
    },
    {
      id: 'inquiryProject',
      label: 'Inquiry Project',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => row.inquiryProject || '',
      render: (row) => row.inquiryProject,
    },
    {
      id: 'grandTotal',
      label: 'Grand Total',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.grandTotal,
      render: (row) => toCurrency(row.grandTotal || 0),
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Associate Quotations</Typography>
        <Button variant="contained" onClick={handleAdd}>
          + Add Associate Quotation
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                placeholder="Search by quotation no, inquiry project, associate..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Rows"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                size="small"
                fullWidth
              >
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No associate quotations found"
          description="Start by creating your first associate quotation"
          onAction={handleAdd}
          actionLabel="Add Associate Quotation"
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
            loading={false}
          />
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="lg" fullWidth>
        <DialogTitle>{editingId ? 'Edit Associate Quotation' : 'Create Associate Quotation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Associate Information</Typography>
                <Stack spacing={2}>
                  <Autocomplete
                    options={associates}
                    value={selectedAssociate || null}
                    onChange={(_, value) => setSelectedAssociateId(value?._id || '')}
                    getOptionLabel={(option) => option.associteName}
                    renderInput={(params) => <TextField {...params} label="Associate *" />}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth required>
                        <InputLabel>Service Category</InputLabel>
                        <Select
                          value={selectedServiceCategory}
                          label="Service Category"
                          onChange={(event) => {
                            setSelectedServiceCategory(event.target.value as ServiceCategory);
                            setServiceDraft((prev) => ({ ...prev, procedureName: '' }));
                          }}
                        >
                          {SERVICE_OPTIONS.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Reference Preview"
                        value={referencePreview}
                        fullWidth
                        slotProps={{ input: { readOnly: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Associate Email" value={selectedAssociate?.email || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Associate Type" value={selectedAssociate?.associteType || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Country" value={selectedAssociate?.country || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField label="Notes" value={selectedAssociate?.notes || ''} fullWidth multiline minRows={2} slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                  </Grid>

                  <TextField
                    label="Inquiry Project *"
                    value={inquiryProject}
                    onChange={(event) => setInquiryProject(event.target.value)}
                    required
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Service Details</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      options={procedureOptions}
                      value={serviceDraft.procedureName}
                      onChange={(_, value) =>
                        setServiceDraft((prev) => ({ ...prev, procedureName: value || '' }))
                      }
                      renderInput={(params) => <TextField {...params} label="Procedure *" />}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Class Type</InputLabel>
                      <Select
                        value={serviceDraft.classType}
                        label="Class Type"
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            classType: event.target.value as ClassType,
                            numberOfClasses:
                              event.target.value === 'multi' ? prev.numberOfClasses || 1 : 1,
                            additionalFeePerClass:
                              event.target.value === 'multi' ? prev.additionalFeePerClass : 0,
                          }))
                        }
                      >
                        <MenuItem value="single">Single</MenuItem>
                        <MenuItem value="multi">Multi</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {serviceDraft.classType === 'multi' && (
                    <>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          type="number"
                          label="Number of Classes"
                          value={serviceDraft.numberOfClasses}
                          onChange={(event) =>
                            setServiceDraft((prev) => ({
                              ...prev,
                              numberOfClasses: Math.max(1, Number(event.target.value) || 1),
                            }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          type="number"
                          label="Additional Fee Per Class"
                          value={serviceDraft.additionalFeePerClass}
                          onChange={(event) =>
                            setServiceDraft((prev) => ({
                              ...prev,
                              additionalFeePerClass: Math.max(0, Number(event.target.value) || 0),
                            }))
                          }
                          fullWidth
                        />
                      </Grid>
                    </>
                  )}

                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      type="number"
                      label="Official Fee"
                      value={serviceDraft.officialFee}
                      onChange={(event) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          officialFee: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      type="number"
                      label="Attorney Fee"
                      value={serviceDraft.attorneyFee}
                      onChange={(event) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          attorneyFee: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      type="number"
                      label="Office Fee"
                      value={serviceDraft.officeFee}
                      onChange={(event) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          officeFee: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      type="number"
                      label="Other Fees"
                      value={serviceDraft.otherFees}
                      onChange={(event) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          otherFees: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      fullWidth
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Button variant="outlined" onClick={handleAddService}>
                      Add to Cart
                    </Button>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle1" sx={{ mb: 1 }}>Service Rows</Typography>
                {services.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No services added yet.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Procedure</TableCell>
                          <TableCell>Class Type</TableCell>
                          <TableCell align="right">No. Classes</TableCell>
                          <TableCell align="right">Official Fees</TableCell>
                          <TableCell align="right">Additional Class Fees</TableCell>
                          <TableCell align="right">Attorney Fee</TableCell>
                          <TableCell align="right">Office Fee</TableCell>
                          <TableCell align="right">Other Fees</TableCell>
                          <TableCell align="right">Grand Total</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {services.map((service, index) => (
                          <TableRow key={`${service.procedureName}-${index}`}>
                            <TableCell>{service.procedureName}</TableCell>
                            <TableCell>{service.classType}</TableCell>
                            <TableCell align="right">{service.numberOfClasses}</TableCell>
                            <TableCell align="right">{toCurrency(service.officialFee)}</TableCell>
                            <TableCell align="right">{toCurrency(service.additionalClassFees)}</TableCell>
                            <TableCell align="right">{toCurrency(service.attorneyFee)}</TableCell>
                            <TableCell align="right">{toCurrency(service.officeFee)}</TableCell>
                            <TableCell align="right">{toCurrency(service.otherFees)}</TableCell>
                            <TableCell align="right">{toCurrency(service.grandTotal)}</TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error" onClick={() => handleRemoveService(index)}>
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Stack sx={{ mt: 2 }} spacing={0.5}>
                  <Typography variant="body2">Total Official Fees: {toCurrency(totals.totalOfficialFees)}</Typography>
                  <Typography variant="body2">Total Attorney Fees: {toCurrency(totals.totalAttorneyFees)}</Typography>
                  <Typography variant="body2">Total Office Fees: {toCurrency(totals.totalOfficeFees)}</Typography>
                  <Typography variant="body2">Total Other Fees: {toCurrency(totals.totalOtherFees)}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Grand Total: {toCurrency(totals.grandTotal)}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button onClick={() => handleSubmitForm().catch(() => setError('Failed to save associate quotation'))} variant="contained">
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>View Associate Quotation</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography><strong>Quotation No:</strong> {viewingItem.quotationNo}</Typography>
              <Typography><strong>Service Category:</strong> {viewingItem.serviceCategory || '-'}</Typography>
              <Typography><strong>Country Abbreviation:</strong> {viewingItem.countryAbbreviation || '-'}</Typography>
              <Typography><strong>Associate:</strong> {viewingItem.associateSnapshot?.associteName || '-'}</Typography>
              <Typography><strong>Inquiry Project:</strong> {viewingItem.inquiryProject}</Typography>
              <Typography><strong>Grand Total:</strong> {toCurrency(viewingItem.grandTotal || 0)}</Typography>

              <Divider />
              <Typography variant="subtitle1">Service Rows</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Procedure</TableCell>
                      <TableCell>Class Type</TableCell>
                      <TableCell align="right">No. Classes</TableCell>
                      <TableCell align="right">Official Fees</TableCell>
                      <TableCell align="right">Additional Class Fees</TableCell>
                      <TableCell align="right">Attorney Fee</TableCell>
                      <TableCell align="right">Office Fee</TableCell>
                      <TableCell align="right">Other Fees</TableCell>
                      <TableCell align="right">Grand Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewingItem.services || []).map((service, index) => (
                      <TableRow key={`${service.procedureName}-${index}`}>
                        <TableCell>{service.procedureName}</TableCell>
                        <TableCell>{service.classType}</TableCell>
                        <TableCell align="right">{service.numberOfClasses}</TableCell>
                        <TableCell align="right">{toCurrency(service.officialFee)}</TableCell>
                        <TableCell align="right">{toCurrency(service.additionalClassFees)}</TableCell>
                        <TableCell align="right">{toCurrency(service.attorneyFee)}</TableCell>
                        <TableCell align="right">{toCurrency(service.officeFee)}</TableCell>
                        <TableCell align="right">{toCurrency(service.otherFees)}</TableCell>
                        <TableCell align="right">{toCurrency(service.grandTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Associate Quotation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this associate quotation? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  );
}
