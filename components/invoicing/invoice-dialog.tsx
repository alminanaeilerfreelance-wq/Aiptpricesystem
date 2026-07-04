'use client';

import React, { useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { createInvoice, updateInvoice } from '@/actions/invoice-actions';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';
import type { InvoiceFormInput } from '@/schemas/invoice-schema';
import type { InvoiceRecord, InvoiceType } from '@/types/invoice';
import InvoiceForm from './invoice-form';

const SIDEBAR_COLOR = '#0B1739';

export type InvoiceDialogMode = 'create' | 'view' | 'edit';

export interface InvoiceDialogProps {
  open: boolean;
  mode: InvoiceDialogMode;
  invoiceType: InvoiceType;
  invoice?: InvoiceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function InvoiceDialog({ open, mode, invoiceType, invoice, onClose, onSaved }: InvoiceDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const formId = useMemo(() => `invoice-form-${mode}-${invoice?.id ?? 'new'}`, [invoice?.id, mode]);
  const readOnly = mode === 'view';

  const title = mode === 'create' ? `New ${invoiceType} Invoice` : mode === 'edit' ? `Edit ${invoiceType} Invoice` : `${invoiceType} Invoice`;

  const handleSubmit = async (values: InvoiceFormInput) => {
    if (readOnly) return;

    try {
      setSubmitting(true);
      if (mode === 'edit' && invoice?.id) {
        await updateInvoice(invoice.id, values);
        showSuccessToast('Invoice updated successfully.');
      } else {
        await createInvoice(values);
        showSuccessToast('Invoice created successfully.');
      }
      onSaved();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save invoice.';
      showErrorToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="invoice-dialog-title">
      <DialogTitle
        id="invoice-dialog-title"
        sx={{
          m: 0,
          px: 3,
          py: 2,
          bgcolor: SIDEBAR_COLOR,
          color: '#fff',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <IconButton aria-label="Close invoice dialog" onClick={onClose} sx={{ color: '#fff' }}>
          <Box component="span" aria-hidden="true" sx={{ fontSize: 22, lineHeight: 1 }}>
            x
          </Box>
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: '#fff' }}>
        <InvoiceForm
          key={`${mode}-${invoice?.id ?? 'new'}`}
          invoiceType={invoiceType}
          invoice={invoice}
          readOnly={readOnly}
          formId={formId}
          onSubmit={handleSubmit}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fff', borderTop: '1px solid #E5E7EB' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        {!readOnly && (
          <Button type="submit" form={formId} variant="contained" disabled={submitting}>
            {mode === 'edit' ? 'Update' : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
