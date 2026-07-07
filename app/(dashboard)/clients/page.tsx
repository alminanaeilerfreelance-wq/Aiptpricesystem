'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { clientsService, Client, ClientServiceType, ClientType } from '@/services/clients.service';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';
import ReferenceNumberManager from '@/components/reference-numbers/ReferenceNumberManager';

export const dynamic = 'force-dynamic';

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  type: ClientType;
  assignedId: string;
  assignedServiceType: ClientServiceType | '';
  assignedIdCount: string;
  address: string;
  country: string;
  companyName: string;
  notes: string;
}

const defaultForm: ClientForm = {
  name: '',
  email: '',
  phone: '',
  type: 'Direct',
  assignedId: '',
  assignedServiceType: '',
  assignedIdCount: '',
  address: '',
  country: '',
  companyName: '',
  notes: '',
};

const CLIENT_TYPE_OPTIONS: ClientType[] = ['Direct', 'Agent'];
const SERVICE_TYPE_OPTIONS: ClientServiceType[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];

const normalizeClientType = (value: unknown): ClientType => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'agent' ? 'Agent' : 'Direct';
};

export default function ClientsPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const { canAdd, canEdit, canDelete, canView } = usePermission();
  
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientForm>(defaultForm);

  const hasLoadedRef = useRef(false);
  const lastLoadedPageRef = useRef(page);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchItems = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    const shouldShowLoader = !hasLoadedRef.current || nextPage !== lastLoadedPageRef.current;
    try {
      if (shouldShowLoader) setLoading(true);
      setError('');
      const response = await clientsService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setItems(Array.isArray(response?.clients) ? response.clients : []);
      setTotal(response?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch clients');
      setItems([]);
      setTotal(0);
    } finally {
      if (shouldShowLoader) setLoading(false);
      hasLoadedRef.current = true;
      lastLoadedPageRef.current = nextPage;
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

  const handleEdit = (item: Client) => {
    setEditingId(item._id);
    setFormData({
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      type: normalizeClientType(item.type),
      assignedId: item.assignedId || '',
      assignedServiceType: (item.assignedServiceType as ClientServiceType) || '',
      assignedIdCount: item.assignedIdCount === undefined || item.assignedIdCount === null ? '' : String(item.assignedIdCount),
      address: item.address || '',
      country: item.country || '',
      companyName: item.companyName || '',
      notes: item.notes || '',
    });
    setOpenForm(true);
  };

  const handleView = (item: Client) => {
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
    if (!formData.name.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        type: formData.type,
        assignedId: formData.assignedId.trim() || undefined,
        assignedServiceType: formData.assignedServiceType || undefined,
        assignedIdCount: formData.assignedIdCount.trim() ? Number(formData.assignedIdCount) : undefined,
        address: formData.address.trim() || undefined,
        country: formData.country.trim() || undefined,
        companyName: formData.companyName.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (editingId) {
        await clientsService.update(editingId, payload);
        showSuccessToast('Client updated successfully');
      } else {
        await clientsService.create(payload);
        showSuccessToast('Client created successfully');
      }

      handleCloseForm();
      if (page !== 1) setPage(1);
      else await fetchItems({ nextPage: 1 });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      await clientsService.delete(deletingId);
      const targetPage = items.length === 1 && page > 1 ? page - 1 : page;
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await fetchItems({ nextPage: targetPage });
      }
      showSuccessToast('Client deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete client');
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
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, raw: false });
      const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim()));

      let importedCount = 0;
      const importErrors: string[] = [];

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const email = String(row[1] ?? '').trim();
        const phone = String(row[2] ?? '').trim();
        const fourthColumn = String(row[3] ?? '').trim();
        const hasTypeColumn = ['agent', 'direct'].includes(fourthColumn.toLowerCase());
        const type = hasTypeColumn ? normalizeClientType(fourthColumn) : 'Direct';
        const address = String(row[hasTypeColumn ? 4 : 3] ?? '').trim();
        const country = String(row[hasTypeColumn ? 5 : 4] ?? '').trim();
        const companyName = String(row[hasTypeColumn ? 6 : 5] ?? '').trim();
        const notes = String(row[hasTypeColumn ? 7 : 6] ?? '').trim();

        if (!name) continue;

        try {
          await clientsService.create({
            name,
            email: email || undefined,
            phone: phone || undefined,
            type,
            assignedId: String(row[8] ?? '').trim() || undefined,
            assignedServiceType: SERVICE_TYPE_OPTIONS.includes(String(row[9] ?? '').trim() as ClientServiceType)
              ? (String(row[9] ?? '').trim() as ClientServiceType)
              : undefined,
            assignedIdCount: String(row[10] ?? '').trim() ? Number(row[10]) : undefined,
            address: address || undefined,
            country: country || undefined,
            companyName: companyName || undefined,
            notes: notes || undefined,
          });
          importedCount += 1;
        } catch {
          importErrors.push(`Failed to import "${name}"`);
        }
      }

      if (importedCount > 0) {
        if (page !== 1) setPage(1);
        else await fetchItems({ nextPage: 1 });
        showSuccessToast(`Imported ${importedCount} client records`);
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
    const firstResponse = await clientsService.list({
      page: 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
    });

    const firstData = Array.isArray(firstResponse?.clients) ? firstResponse.clients : [];
    const totalPages = Math.ceil((firstResponse?.total || 0) / pageSize);

    if (totalPages <= 1) return firstData;

    const remainingRequests: Array<Promise<any>> = [];
    for (let p = 2; p <= totalPages; p += 1) {
      remainingRequests.push(
        clientsService.list({
          page: p,
          limit: pageSize,
          search: debouncedSearch || undefined,
        })
      );
    }

    const remainingResponses = await Promise.all(remainingRequests);
    const remainingData = remainingResponses.flatMap((r) => (Array.isArray(r?.clients) ? r.clients : []));

    return [...firstData, ...remainingData];
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    const records = await getAllFiltered();
    if (records.length === 0) {
      setError('No data available to export');
      return;
    }

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(records.map((item) => ({
      'Client Name': item.name,
      Email: item.email || '',
      Phone: item.phone || '',
      Type: normalizeClientType(item.type),
      'Assigned ID': item.assignedId || '',
      'Service Type': item.assignedServiceType || '',
      'Counting Assigned ID': item.assignedIdCount ?? '',
      Address: item.address || '',
      Country: item.country || '',
      'Company Name': item.companyName || '',
      Notes: item.notes || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'clients.csv');
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
      'Client Name': item.name,
      Email: item.email || '',
      Phone: item.phone || '',
      Type: normalizeClientType(item.type),
      'Assigned ID': item.assignedId || '',
      'Service Type': item.assignedServiceType || '',
      'Counting Assigned ID': item.assignedIdCount ?? '',
      Address: item.address || '',
      Country: item.country || '',
      'Company Name': item.companyName || '',
      Notes: item.notes || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'clients.xlsx');
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
      head: [[
        'Client Name',
        'Email',
        'Phone',
        'Type',
        'Assigned ID',
        'Service Type',
        'Counting Assigned ID',
        'Address',
        'Country',
        'Company Name',
        'Notes',
      ]],
      body: records.map((item) => [
        item.name,
        item.email || '-',
        item.phone || '-',
        normalizeClientType(item.type),
        item.assignedId || '-',
        item.assignedServiceType || '-',
        item.assignedIdCount ?? '-',
        item.address || '-',
        item.country || '-',
        item.companyName || '-',
        item.notes || '-',
      ]),
      startY: 10,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    doc.save('clients.pdf');
    showSuccessToast(`PDF exported (${records.length} rows)`);
  };

  const clientColumns: MuiDataTableColumn<Client>[] = [
    {
      id: 'name',
      label: 'Client Name',
      sortable: true,
      searchValue: (row) => row.name,
      render: (row) => row.name,
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
      id: 'phone',
      label: 'Phone',
      sortable: true,
      searchValue: (row) => row.phone || '',
      render: (row) => row.phone || '-',
    },
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      searchValue: (row) => normalizeClientType(row.type),
      render: (row) => normalizeClientType(row.type),
    },
    {
      id: 'assignedId',
      label: 'Assigned ID',
      sortable: true,
      minWidth: 140,
      searchValue: (row) => row.assignedId || '',
      render: (row) => row.assignedId || '-',
    },
    {
      id: 'assignedServiceType',
      label: 'Service Type',
      sortable: true,
      minWidth: 140,
      searchValue: (row) => String(row.assignedServiceType || ''),
      render: (row) => row.assignedServiceType || '-',
    },
    {
      id: 'assignedIdCount',
      label: 'Counting Assigned ID',
      sortable: true,
      minWidth: 160,
      searchValue: (row) => String(row.assignedIdCount ?? ''),
      sortValue: (row) => row.assignedIdCount ?? 0,
      render: (row) => row.assignedIdCount ?? '-',
    },
    {
      id: 'address',
      label: 'Address',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.address || '',
      render: (row) => row.address || '-',
    },
    {
      id: 'country',
      label: 'Country',
      sortable: true,
      searchValue: (row) => row.country || '',
      render: (row) => row.country || '-',
    },
    {
      id: 'companyName',
      label: 'Company Name',
      sortable: true,
      minWidth: 160,
      searchValue: (row) => row.companyName || '',
      render: (row) => row.companyName || '-',
    },
    {
      id: 'notes',
      label: 'Notes',
      sortable: true,
      minWidth: 200,
      searchValue: (row) => row.notes || '',
      render: (row) => row.notes || '-',
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          {canView('clients') && (
            <Button size="small" variant="outlined" onClick={() => handleView(row)}>
              View
            </Button>
          )}
          {canEdit('clients') && (
            <Button size="small" variant="outlined" onClick={() => handleEdit(row)}>
              Edit
            </Button>
          )}
          {canDelete('clients') && (
            <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteClick(row._id)}>
              Delete
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  if (!mounted) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Clients" />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        {canAdd('clients') && (
          <Button variant="contained" onClick={handleAdd}>
            + Add Client
          </Button>
        )}
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
              id="clients-import-input"
            />
            <label htmlFor="clients-import-input" style={{ margin: 0 }}>
              <Button size="small" variant="outlined" component="span">
                Import File
              </Button>
            </label>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportCSV().catch(() => setError('Failed to export CSV'))}
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportExcel().catch(() => setError('Failed to export Excel'))}
            >
              Export Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleExportPDF().catch(() => setError('Failed to export PDF'))}
            >
              Export PDF
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
          title="No clients found"
          description="Start by adding your first client"
          onAction={handleAdd}
          actionLabel="Add Client"
        />
      ) : (
        !loading && (
          <MuiDataTable
            rows={items}
            columns={clientColumns}
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
            exportFileName="clients"
          />
        )
      )}

      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Client' : 'Add Client'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Assigned ID"
              value={formData.assignedId}
              onChange={(e) => setFormData((prev) => ({ ...prev, assignedId: e.target.value }))}
            />
            <TextField
              label="Client Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <TextField
              label="Type"
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, type: normalizeClientType(e.target.value) }))
              }
              select
              required
            >
              {CLIENT_TYPE_OPTIONS.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
       
            <TextField
              label="Service Type"
              value={formData.assignedServiceType}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, assignedServiceType: e.target.value as ClientServiceType }))
              }
              select
            >
              <MenuItem value="">None</MenuItem>
              {SERVICE_TYPE_OPTIONS.map((service) => (
                <MenuItem key={service} value={service}>
                  {service}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Counting Assigned ID"
              type="number"
              value={formData.assignedIdCount}
              onChange={(e) => setFormData((prev) => ({ ...prev, assignedIdCount: e.target.value }))}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
            />
            <TextField
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
            />
            <TextField
              label="Company Name"
              value={formData.companyName}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
            />
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
          <Button onClick={() => handleSubmitForm().catch(() => setError('Failed to save client'))} variant="contained">
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Client Profile</Typography>
              <Typography sx={{ color: '#64748B', fontSize: 13 }}>
                View client details and manage generated reference numbers.
              </Typography>
            </Box>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#F8FAFC', p: 2 }}>
          {viewingItem && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' }, gap: 2 }}>
              <Card variant="outlined" sx={{ borderRadius: 1.5, alignSelf: 'start' }}>
                <CardContent>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1,
                      bgcolor: '#DBEAFE',
                      color: '#1D4ED8',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 900,
                      fontSize: 20,
                      mb: 1.5,
                    }}
                  >
                    {viewingItem.name?.slice(0, 2).toUpperCase() || 'CL'}
                  </Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0F172A' }}>{viewingItem.name}</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 13, mb: 2 }}>{normalizeClientType(viewingItem.type)} Client</Typography>
                  <Stack spacing={1.25}>
                    {[
                      ['Assigned ID', viewingItem.assignedId || '-'],
                      ['Email', viewingItem.email || '-'],
                      ['Phone', viewingItem.phone || '-'],
                      ['Country', viewingItem.country || '-'],
                      ['Service Type', viewingItem.assignedServiceType || '-'],
                      ['Counting Assigned ID', viewingItem.assignedIdCount ?? '-'],
                      ['Company', viewingItem.companyName || '-'],
                      ['Address', viewingItem.address || '-'],
                      ['Notes', viewingItem.notes || '-'],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography sx={{ color: '#64748B', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                          {label}
                        </Typography>
                        <Typography sx={{ color: '#0F172A', fontSize: 14, wordBreak: 'break-word' }}>{value}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <ReferenceNumberManager
                clientId={viewingItem._id}
                clientName={viewingItem.name}
                assignedId={viewingItem.assignedId || ''}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this client? This action cannot be undone.</Typography>
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
