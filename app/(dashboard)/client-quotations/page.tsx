'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
import clientQuotationsService, {
  ClientQuotation,
  ClientQuotationServiceItem,
} from '@/services/client-quotations.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

type ClassType = 'single' | 'multi';

interface AssociateOption {
  _id: string;
  associteName: string;
  email?: string;
  associteType?: string;
  contact?: string;
  address?: string;
  notes?: string;
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
  discount: number;
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
  discount: 0,
};

const toCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalizeAssociate = (associateId: ClientQuotation['associateId']): string | undefined => {
  if (!associateId) return undefined;
  if (typeof associateId === 'string') return associateId;
  return associateId._id;
};

const computeClientRow = (service: ServiceDraft): ClientQuotationServiceItem => {
  const classType: ClassType = service.classType === 'multi' ? 'multi' : 'single';
  const numberOfClasses = classType === 'multi' ? Math.max(1, Math.floor(service.numberOfClasses || 1)) : 1;
  const additionalFeePerClass = classType === 'multi' ? Math.max(0, Number(service.additionalFeePerClass || 0)) : 0;
  const officialFee = Math.max(0, Number(service.officialFee || 0));
  const attorneyFee = Math.max(0, Number(service.attorneyFee || 0));
  const officeFee = Math.max(0, Number(service.officeFee || 0));
  const otherFees = Math.max(0, Number(service.otherFees || 0));
  const discount = Math.max(0, Number(service.discount || 0));

  const additionalClassFees = classType === 'multi' ? additionalFeePerClass * numberOfClasses : 0;
  const totalOfficialFees = officialFee + additionalClassFees;
  const totalAmount = totalOfficialFees + attorneyFee + officeFee + otherFees;
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
    officeFee,
    otherFees,
    discount,
    totalAmount,
    grandTotal,
  };
};

const computeTotals = (services: ClientQuotationServiceItem[]) =>
  services.reduce(
    (acc, item) => {
      acc.totalOfficialFees += item.totalOfficialFees;
      acc.totalAttorneyFees += item.attorneyFee;
      acc.totalOfficeFees += item.officeFee;
      acc.totalOtherFees += item.otherFees;
      acc.totalDiscount += item.discount;
      acc.grandTotal += item.grandTotal;
      return acc;
    },
    {
      totalOfficialFees: 0,
      totalAttorneyFees: 0,
      totalOfficeFees: 0,
      totalOtherFees: 0,
      totalDiscount: 0,
      grandTotal: 0,
    }
  );

export default function ClientQuotationsPage() {
  const [mounted, setMounted] = useState(false);

  const [items, setItems] = useState<ClientQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [associates, setAssociates] = useState<AssociateOption[]>([]);
  const [procedureOptions, setProcedureOptions] = useState<string[]>([]);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>('');
  const [inquiryProjects, setInquiryProjects] = useState<string[]>([]);
  const [inquiryInput, setInquiryInput] = useState('');
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(defaultServiceDraft);
  const [services, setServices] = useState<ClientQuotationServiceItem[]>([]);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<ClientQuotation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedAssociate = useMemo(
    () => associates.find((associate) => associate._id === selectedAssociateId) || null,
    [associates, selectedAssociateId]
  );

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
          email: item.email,
          associteType: item.associteType,
          contact: item.contact,
          address: item.address,
          notes: item.notes,
        }))
      : [];

    setAssociates(normalizedAssociates);

    const procedures = Array.isArray(pricingRes.pricingRules)
      ? Array.from(
          new Set(
            pricingRes.pricingRules
              .map((item) => item.procedureName.trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b))
      : [];

    setProcedureOptions(procedures);
  }, []);

  const fetchItems = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    try {
      setLoading(true);
      setError('');
      const response = await clientQuotationsService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setItems(Array.isArray(response.clientQuotations) ? response.clientQuotations : []);
      setTotal(response.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load client quotations');
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
      setProcedureOptions([]);
    });
  }, [loadLookups]);

  const resetFormState = () => {
    setEditingId(null);
    setSelectedAssociateId('');
    setInquiryProjects([]);
    setInquiryInput('');
    setServiceDraft(defaultServiceDraft);
    setServices([]);
  };

  const handleAdd = () => {
    resetFormState();
    setOpenForm(true);
  };

  const handleEdit = (item: ClientQuotation) => {
    setEditingId(item._id);
    setSelectedAssociateId(normalizeAssociate(item.associateId) || '');
    setInquiryProjects(Array.isArray(item.inquiryProjects) ? item.inquiryProjects : []);
    setServices(Array.isArray(item.services) ? item.services : []);
    setServiceDraft(defaultServiceDraft);
    setInquiryInput('');
    setOpenForm(true);
  };

  const handleView = (item: ClientQuotation) => {
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

  const handleAddInquiryProject = () => {
    const value = inquiryInput.trim();
    if (!value) return;
    if (inquiryProjects.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setInquiryInput('');
      return;
    }
    setInquiryProjects((prev) => [...prev, value]);
    setInquiryInput('');
  };

  const handleRemoveInquiryProject = (target: string) => {
    setInquiryProjects((prev) => prev.filter((item) => item !== target));
  };

  const handleAddService = () => {
    if (!serviceDraft.procedureName.trim()) {
      setError('Procedure is required before adding service row');
      return;
    }

    const row = computeClientRow(serviceDraft);
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
    if (inquiryProjects.length === 0) {
      setError('At least one inquiry project is required');
      return;
    }
    if (services.length === 0) {
      setError('At least one service row is required');
      return;
    }

    const payload = {
      associateId: selectedAssociateId,
      inquiryProjects,
      services: services.map((service) => ({
        procedureName: service.procedureName,
        classType: service.classType,
        numberOfClasses: service.numberOfClasses,
        additionalFeePerClass: service.additionalFeePerClass,
        officialFee: service.officialFee,
        attorneyFee: service.attorneyFee,
        officeFee: service.officeFee,
        otherFees: service.otherFees,
        discount: service.discount,
      })),
      status: 'Draft' as const,
    };

    try {
      setLoading(true);
      setError('');
      if (editingId) {
        await clientQuotationsService.update(editingId, payload);
        setSuccessMessage('Client quotation updated successfully');
      } else {
        await clientQuotationsService.create(payload);
        setSuccessMessage('Client quotation created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save client quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await clientQuotationsService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) setPage(targetPage);
      else await fetchItems({ nextPage: targetPage });
      setSuccessMessage('Client quotation deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete client quotation');
    } finally {
      setLoading(false);
    }
  };

  const columns: MuiDataTableColumn<ClientQuotation>[] = [
    {
      id: 'quotationNo',
      label: 'Quotation No',
      sortable: true,
      searchValue: (row) => row.quotationNo,
      render: (row) => row.quotationNo,
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
      id: 'inquiryProjects',
      label: 'Inquiry Projects',
      sortable: true,
      minWidth: 220,
      searchValue: (row) => (row.inquiryProjects || []).join(', '),
      render: (row) => (row.inquiryProjects || []).join(', '),
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
        <Typography variant="h4">Client Quotations</Typography>
        <Button variant="contained" onClick={handleAdd}>
          + Add Client Quotation
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
          title="No client quotations found"
          description="Start by creating your first client quotation"
          onAction={handleAdd}
          actionLabel="Add Client Quotation"
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
        <DialogTitle>{editingId ? 'Edit Client Quotation' : 'Create Client Quotation'}</DialogTitle>
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
                      <TextField label="Associate Email" value={selectedAssociate?.email || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Associate Type" value={selectedAssociate?.associteType || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Contact" value={selectedAssociate?.contact || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label="Address" value={selectedAssociate?.address || ''} fullWidth slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField label="Notes" value={selectedAssociate?.notes || ''} fullWidth multiline minRows={2} slotProps={{ input: { readOnly: true } }} />
                    </Grid>
                  </Grid>

                  <Divider />
                  <Typography variant="subtitle1">Inquiry Projects *</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      label="Add Inquiry Project"
                      value={inquiryInput}
                      onChange={(event) => setInquiryInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddInquiryProject();
                        }
                      }}
                      fullWidth
                    />
                    <Button variant="outlined" onClick={handleAddInquiryProject}>Add</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {inquiryProjects.map((project) => (
                      <Chip
                        key={project}
                        label={project}
                        onDelete={() => handleRemoveInquiryProject(project)}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
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

                  <Grid size={{ xs: 12, md: 4 }}>
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
                  <Grid size={{ xs: 12, md: 4 }}>
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
                  <Grid size={{ xs: 12, md: 4 }}>
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
                  <Grid size={{ xs: 12, md: 4 }}>
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
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      type="number"
                      label="Discount"
                      value={serviceDraft.discount}
                      onChange={(event) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          discount: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      fullWidth
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Button variant="outlined" fullWidth sx={{ height: '100%' }} onClick={handleAddService}>
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
                          <TableCell align="right">Discount</TableCell>
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
                            <TableCell align="right">{toCurrency(service.discount)}</TableCell>
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
                  <Typography variant="body2">Total Discount: {toCurrency(totals.totalDiscount)}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Grand Total: {toCurrency(totals.grandTotal)}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button onClick={() => handleSubmitForm().catch(() => setError('Failed to save client quotation'))} variant="contained">
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>View Client Quotation</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography><strong>Quotation No:</strong> {viewingItem.quotationNo}</Typography>
              <Typography><strong>Associate:</strong> {viewingItem.associateSnapshot?.associteName || '-'}</Typography>
              <Typography><strong>Inquiry Projects:</strong> {(viewingItem.inquiryProjects || []).join(', ')}</Typography>
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
                      <TableCell align="right">Discount</TableCell>
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
                        <TableCell align="right">{toCurrency(service.discount)}</TableCell>
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
        <DialogTitle>Delete Client Quotation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this client quotation? This action cannot be undone.</Typography>
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
