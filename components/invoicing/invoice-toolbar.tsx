'use client';

import React from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { invoiceStatuses } from '@/schemas/invoice-schema';
import type { InvoiceStatus } from '@/types/invoice';

export interface InvoiceToolbarProps {
  search: string;
  status: InvoiceStatus | 'All';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: InvoiceStatus | 'All') => void;
}

export default function InvoiceToolbar({ search, status, onSearchChange, onStatusChange }: InvoiceToolbarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
        alignItems: { xs: 'stretch', sm: 'center' },
        mb: 2,
      }}
    >
      <TextField
        size="small"
        label="Search invoices"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ minWidth: { xs: '100%', sm: 320 } }}
        slotProps={{ htmlInput: { 'aria-label': 'Search invoices' } }}
      />
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as InvoiceStatus | 'All')}
          inputProps={{ 'aria-label': 'Filter by invoice status' }}
        >
          <MenuItem value="All">All Status</MenuItem>
          {invoiceStatuses.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
