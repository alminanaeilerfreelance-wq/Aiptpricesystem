'use client';

import React from 'react';
import { Box, Button, Stack } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import type { InvoiceRecord } from '@/types/invoice';

function formatAmount(invoice: InvoiceRecord) {
  return `${invoice.currency} ${invoice.total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface InvoiceColumnsOptions {
  onView: (invoice: InvoiceRecord) => void;
  onEdit: (invoice: InvoiceRecord) => void;
  onCancel: (invoice: InvoiceRecord) => void;
  showActions?: boolean;
}

export function getInvoiceColumns({ onView, onEdit, onCancel, showActions = true }: InvoiceColumnsOptions): ColumnDef<InvoiceRecord>[] {
  const columns: ColumnDef<InvoiceRecord>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice No',
      cell: ({ row }) => <Box sx={{ fontWeight: 700 }}>{row.original.invoiceNumber}</Box>,
    },
    {
      accessorKey: 'clientName',
      header: 'Client',
      cell: ({ row }) => row.original.clientName,
      enableSorting: false,
    },
    {
      accessorKey: 'method',
      header: 'Procedure',
      cell: ({ row }) => row.original.method || '-',
      enableSorting: false,
    },
    {
      accessorKey: 'countryName',
      header: 'Country',
      cell: ({ row }) => row.original.countryName,
      enableSorting: false,
    },
    {
      accessorKey: 'total',
      header: 'Grand Total',
      cell: ({ row }) => formatAmount(row.original),
    },
  ];

  if (showActions) {
    columns.push({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <Stack direction="row" spacing={0.75} sx={{ minWidth: 210 }}>
          <Button size="small" variant="outlined" onClick={() => onView(row.original)}>
            View
          </Button>
          <Button size="small" variant="outlined" onClick={() => onEdit(row.original)}>
            Edit
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => onCancel(row.original)}
            disabled={row.original.status === 'Cancelled'}
          >
            {row.original.status === 'Cancelled' ? 'Cancelled' : 'Cancel'}
          </Button>
        </Stack>
      ),
    });
  }

  return columns;
}
