'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { clientsService, type Client } from '@/services/clients.service';
import { countriesService, type Country } from '@/services/countries.service';
import {
  calculateInvoiceTotal,
  invoiceSchema,
  invoiceStatuses,
  invoiceTypes,
  type InvoiceFormInput,
} from '@/schemas/invoice-schema';
import type { InvoiceRecord, InvoiceType } from '@/types/invoice';

const compactTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    backgroundColor: '#fff',
  },
};

function getClientLabel(client: Client) {
  return [client.name, client.companyName].filter(Boolean).join(' • ');
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export interface InvoiceFormProps {
  invoiceType: InvoiceType;
  invoice?: InvoiceRecord | null;
  readOnly?: boolean;
  formId: string;
  allowInvoiceTypeSelection?: boolean;
  isGeneratingInvoiceNumber?: boolean;
  onGenerateInvoiceNumber?: (invoiceType: InvoiceType, clientId: string, countryId: string) => Promise<string>;
  onSubmit: (values: InvoiceFormInput) => Promise<void>;
}

export default function InvoiceForm({
  invoiceType,
  invoice,
  readOnly = false,
  formId,
  allowInvoiceTypeSelection = false,
  isGeneratingInvoiceNumber = false,
  onGenerateInvoiceNumber,
  onSubmit,
}: InvoiceFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const defaultValues = useMemo<InvoiceFormInput>(
    () => ({
      invoiceNumber: invoice?.invoiceNumber ?? '',
      invoiceType,
      referenceNumber: invoice?.referenceNumber ?? '',
      applicationNumber: invoice?.applicationNumber ?? '',
      applicationName: invoice?.applicationName ?? '',
      projectName: invoice?.projectName ?? '',
      method: invoice?.method ?? '',
      clientMaster: invoice?.clientMaster ?? '',
      recipient: invoice?.recipient ?? '',
      subject: invoice?.subject ?? '',
      bankName: invoice?.bankName ?? '',
      clientId: invoice?.clientId ?? '',
      countryId: invoice?.countryId ?? '',
      invoiceDate: toDateInputValue(invoice?.invoiceDate) || new Date().toISOString().slice(0, 10),
      dueDate: toDateInputValue(invoice?.dueDate),
      currency: invoice?.currency ?? 'SAR',
      amount: invoice?.amount ?? 0,
      vat: invoice?.vat ?? 0,
      discount: invoice?.discount ?? 0,
      total: invoice?.total ?? 0,
      status: invoice?.status ?? 'Draft',
      remarks: invoice?.remarks ?? '',
      attachment: invoice?.attachment ?? '',
    }),
    [invoice, invoiceType]
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues,
  });

  const currentInvoiceType = watch('invoiceType') as InvoiceType;
  const currentClientId = watch('clientId') || '';
  const currentCountryId = watch('countryId') || '';

  const amount = Number(watch('amount') || 0);
  const vat = Number(watch('vat') || 0);
  const discount = Number(watch('discount') || 0);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    setValue('invoiceType', invoiceType);
  }, [invoiceType, setValue]);

  useEffect(() => {
    setValue('total', calculateInvoiceTotal(amount, vat, discount), { shouldValidate: true });
  }, [amount, discount, setValue, vat]);

  useEffect(() => {
    let mounted = true;

    async function loadLookups() {
      try {
        setLoadingLookups(true);
        const [clientResponse, countryResponse] = await Promise.all([
          clientsService.list({ page: 1, limit: 1000, all: true }),
          countriesService.listAll(),
        ]);

        if (!mounted) return;
        setClients(clientResponse.clients || []);
        setCountries(
          Array.from(
            new Map((countryResponse || []).map((country) => [country._id, country])).values()
          )
        );
      } finally {
        if (mounted) setLoadingLookups(false);
      }
    }

    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);

  const disabled = readOnly || isSubmitting;

  return (
    <Box
      id={formId}
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
        p: 3,
      }}
    >
      <Controller
        name="invoiceNumber"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Invoice Number"
            size="small"
            disabled={disabled}
            error={Boolean(errors.invoiceNumber)}
            helperText={errors.invoiceNumber?.message}
            sx={compactTextFieldSx}
            slotProps={{
              input: onGenerateInvoiceNumber
                ? {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          size="small"
                          onClick={async () => {
                            if (!onGenerateInvoiceNumber) return;
                            const generated = await onGenerateInvoiceNumber(
                              currentInvoiceType,
                              currentClientId,
                              currentCountryId
                            );
                            if (generated) {
                              setValue('invoiceNumber', generated, { shouldValidate: true });
                            }
                          }}
                          disabled={disabled || !currentClientId || !currentCountryId}
                        >
                          Generate
                        </Button>
                      </InputAdornment>
                    ),
                  }
                : undefined,
            }}
          />
        )}
      />

      <Controller
        name="invoiceType"
        control={control}
        render={({ field }) =>
          allowInvoiceTypeSelection ? (
            <FormControl size="small" fullWidth error={Boolean(errors.invoiceType)} disabled={disabled}>
              <InputLabel>Invoice Type</InputLabel>
              <Select {...field} value={field.value || ''} label="Invoice Type">
                {invoiceTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.invoiceType?.message}</FormHelperText>
            </FormControl>
          ) : (
            <TextField
              {...field}
              label="Invoice Type"
              size="small"
              disabled
              error={Boolean(errors.invoiceType)}
              helperText={errors.invoiceType?.message}
              sx={compactTextFieldSx}
            />
          )
        }
      />

      <Controller
        name="invoiceDate"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Invoice Date"
            type="date"
            size="small"
            disabled={disabled}
            value={typeof field.value === 'string' ? field.value : ''}
            slotProps={{ inputLabel: { shrink: true } }}
            error={Boolean(errors.invoiceDate)}
            helperText={errors.invoiceDate?.message}
            sx={compactTextFieldSx}
          />
        )}
      />

      <Controller
        name="dueDate"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Due Date"
            type="date"
            size="small"
            disabled={disabled}
            value={typeof field.value === 'string' ? field.value : ''}
            slotProps={{ inputLabel: { shrink: true } }}
            error={Boolean(errors.dueDate)}
            helperText={errors.dueDate?.message}
            sx={compactTextFieldSx}
          />
        )}
      />

      <Controller
        name="clientId"
        control={control}
        render={({ field }) => (
          <FormControl size="small" error={Boolean(errors.clientId)} disabled={disabled || loadingLookups}>
            <InputLabel>Client</InputLabel>
            <Select {...field} value={field.value || ''} label="Client">
              {loadingLookups ? (
                <MenuItem disabled value="">
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Loading clients
                </MenuItem>
              ) : (
                clients.map((client) => (
                  <MenuItem key={client._id} value={client._id}>
                    {getClientLabel(client)}
                  </MenuItem>
                ))
              )}
            </Select>
            <FormHelperText>{errors.clientId?.message}</FormHelperText>
          </FormControl>
        )}
      />

      <Controller
        name="countryId"
        control={control}
        render={({ field }) => (
          <FormControl size="small" error={Boolean(errors.countryId)} disabled={disabled || loadingLookups}>
            <InputLabel>Country</InputLabel>
            <Select {...field} value={field.value || ''} label="Country">
              {countries.map((country) => (
                <MenuItem key={country._id} value={country._id}>
                  {country.name} ({country.abbreviation})
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.countryId?.message}</FormHelperText>
          </FormControl>
        )}
      />

      <Controller
        name="referenceNumber"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Reference Number" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="applicationNumber"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Application Number" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="applicationName"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Application Name" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="projectName"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Project Name" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="method"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Method" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="clientMaster"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Client Master" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="recipient"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Invoice To" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="subject"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Subject" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="bankName"
        control={control}
        render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Bank Name" size="small" disabled={disabled} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="currency"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Currency" size="small" disabled={disabled} error={Boolean(errors.currency)} helperText={errors.currency?.message} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="amount"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Amount" type="number" size="small" disabled={disabled} error={Boolean(errors.amount)} helperText={errors.amount?.message} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="vat"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="VAT" type="number" size="small" disabled={disabled} error={Boolean(errors.vat)} helperText={errors.vat?.message} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="discount"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Discount" type="number" size="small" disabled={disabled} error={Boolean(errors.discount)} helperText={errors.discount?.message} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="total"
        control={control}
        render={({ field }) => (
          <TextField {...field} label="Total" type="number" size="small" disabled error={Boolean(errors.total)} helperText={errors.total?.message} sx={compactTextFieldSx} />
        )}
      />

      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <FormControl size="small" error={Boolean(errors.status)} disabled={disabled}>
            <InputLabel>Status</InputLabel>
            <Select {...field} label="Status">
              {invoiceStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.status?.message}</FormHelperText>
          </FormControl>
        )}
      />

      <Controller
        name="attachment"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            label="Attachment"
            size="small"
            disabled={disabled}
            placeholder="File name or URL"
            sx={compactTextFieldSx}
          />
        )}
      />

      <Controller
        name="remarks"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            label="Remarks"
            size="small"
            disabled={disabled}
            multiline
            minRows={3}
            sx={{ ...compactTextFieldSx, gridColumn: { xs: 'auto', md: '1 / -1' } }}
          />
        )}
      />
    </Box>
  );
}
