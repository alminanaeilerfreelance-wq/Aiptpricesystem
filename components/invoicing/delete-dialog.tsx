'use client';

import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { deleteInvoice } from '@/actions/invoice-actions';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';
import type { InvoiceRecord } from '@/types/invoice';

export interface DeleteInvoiceDialogProps {
  open: boolean;
  invoice?: InvoiceRecord | null;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteInvoiceDialog({ open, invoice, onClose, onDeleted }: DeleteInvoiceDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!invoice) return;

    try {
      setDeleting(true);
      await deleteInvoice(invoice.id);
      showSuccessToast('Invoice deleted successfully.');
      onDeleted();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete invoice.';
      showErrorToast(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="delete-invoice-title">
      <DialogTitle id="delete-invoice-title" sx={{ bgcolor: '#0B1739', color: '#fff', fontWeight: 700 }}>
        Delete Invoice
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#fff', pt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Are you sure you want to delete invoice <strong>{invoice?.invoiceNumber}</strong>? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#fff', px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" variant="outlined" disabled={deleting}>
          Cancel
        </Button>
        <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
