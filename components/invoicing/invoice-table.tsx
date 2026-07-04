'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import {
  flexRender,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { listInvoices, updateInvoice } from '@/actions/invoice-actions';
import type { InvoiceRecord, InvoiceStatus, InvoiceType } from '@/types/invoice';
import DeleteInvoiceDialog from './delete-dialog';
import { getInvoiceColumns } from './invoice-columns';
import InvoiceDialog, { type InvoiceDialogMode } from './invoice-dialog';
import InvoiceToolbar from './invoice-toolbar';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';

export interface InvoiceTableProps {
  invoiceType?: InvoiceType;
  showActions?: boolean;
  showToolbar?: boolean;
}

export default function InvoiceTable({ invoiceType, showActions = true, showToolbar = true }: InvoiceTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<InvoiceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'All'>('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'invoiceDate', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [dialogMode, setDialogMode] = useState<InvoiceDialogMode>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const sort = sorting[0];

  const loadInvoices = () => {
    startTransition(async () => {
      const result = await listInvoices({
        invoiceType,
        search,
        status,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        sortBy: sort?.id,
        sortDirection: sort?.desc ? 'desc' : 'asc',
      });
      setRows(result.invoices);
      setTotal(result.total);
    });
  };

  useEffect(() => {
    loadInvoices();
  }, [invoiceType, pagination.pageIndex, pagination.pageSize, search, sort?.desc, sort?.id, status]);

  const columns = useMemo(
    () =>
      getInvoiceColumns({
        showActions,
        onView: (invoice) => {
          router.push(`/admin/invoice/create-new?id=${invoice.id}&mode=view`);
        },
        onEdit: (invoice) => {
          router.push(`/admin/invoice/create-new?id=${invoice.id}&mode=edit`);
        },
        onCancel: async (invoice) => {
          try {
            const updatePayload = {
              invoiceNumber: invoice.invoiceNumber,
              invoiceType: invoice.invoiceType,
              referenceNumber: invoice.referenceNumber || '',
              applicationNumber: invoice.applicationNumber || '',
              applicationName: invoice.applicationName || '',
              projectName: invoice.projectName || '',
              method: invoice.method || '',
              clientMaster: invoice.clientMaster || '',
              recipient: invoice.recipient || '',
              subject: invoice.subject || '',
              bankName: invoice.bankName || '',
              clientId: invoice.clientId,
              countryId: invoice.countryId,
              invoiceDate: invoice.invoiceDate,
              dueDate: invoice.dueDate || undefined,
              currency: invoice.currency,
              amount: invoice.amount,
              vat: invoice.vat,
              discount: invoice.discount,
              total: invoice.total,
              status: 'Cancelled' as const,
              remarks: invoice.remarks || '',
              attachment: invoice.attachment || '',
            };
            await updateInvoice(invoice.id, updatePayload);
            showSuccessToast('Invoice cancelled successfully.');
            loadInvoices();
          } catch (error) {
            showErrorToast(error instanceof Error ? error.message : 'Failed to cancel invoice.');
          }
        },
      }),
    [router, showActions]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    manualSorting: true,
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.pageSize),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleNewInvoice = () => {
    router.push('/admin/invoice/create-new');
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const handleStatusChange = (value: InvoiceStatus | 'All') => {
    setStatus(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  return (
    <Box>
      {showToolbar && (
        <>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              mb: 3,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
        Dashboard / Invoicing / {invoiceType || 'All'}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
                {invoiceType || 'Created'} Invoices
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleNewInvoice} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
              New Invoice
            </Button>
          </Box>

          <InvoiceToolbar
            search={search}
            status={status}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
          />
        </>
      )}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #E5E7EB', boxShadow: 'none' }}>
        <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table stickyHeader aria-label={`${invoiceType} invoices table`} sx={{ minWidth: 1180 }}>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      sx={{
                        bgcolor: '#0B1739',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                      }}
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {isPending ? (
                Array.from({ length: pagination.pageSize }).map((_, index) => (
                  <TableRow key={`loading-${index}`}>
                    {table.getAllLeafColumns().map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton height={24} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={table.getAllLeafColumns().length}>
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        No invoices found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Create a new invoice or adjust the current filters.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} sx={{ whiteSpace: 'nowrap' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={pagination.pageIndex}
          onPageChange={(_, page) => setPagination((current) => ({ ...current, pageIndex: page }))}
          rowsPerPage={pagination.pageSize}
          onRowsPerPageChange={(event) =>
            setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })
          }
          rowsPerPageOptions={[10, 15, 25, 50]}
        />
      </Paper>

      <InvoiceDialog
        open={dialogOpen}
        mode={dialogMode}
        invoiceType={invoiceType || 'Trademark'}
        invoice={selectedInvoice}
        onClose={() => setDialogOpen(false)}
        onSaved={loadInvoices}
      />
      <DeleteInvoiceDialog
        open={deleteOpen}
        invoice={selectedInvoice}
        onClose={() => setDeleteOpen(false)}
        onDeleted={loadInvoices}
      />
    </Box>
  );
}
