'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import profitLossService, { ProfitLossRecord, ProfitLossSummary } from '@/services/profit-loss.service';
import { useDebounce } from '@/hooks/useDebounce';

export const dynamic = 'force-dynamic';

const toCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ProfitLossAnalysisPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ProfitLossRecord[]>([]);
  const [summary, setSummary] = useState<ProfitLossSummary>({ totalProfit: 0, totalLoss: 0, netTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = useCallback(async (params?: { nextPage?: number; nextSearch?: string }) => {
    const nextPage = params?.nextPage ?? page;
    const nextSearch = params?.nextSearch ?? debouncedSearch;
    try {
      setLoading(true);
      setError('');
      const response = await profitLossService.list({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
      });
      setRows(Array.isArray(response.records) ? response.records : []);
      setSummary(response.summary || { totalProfit: 0, totalLoss: 0, netTotal: 0 });
      setTotal(response.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load profit/loss analysis');
      setRows([]);
      setSummary({ totalProfit: 0, totalLoss: 0, netTotal: 0 });
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, limit, page]);

  useEffect(() => {
    fetchData({ nextPage: page, nextSearch: debouncedSearch });
  }, [page, debouncedSearch, fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleExportCSV = async () => {
    if (rows.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows.map((row) => ({
      'Inquiry Project': row.inquiryProject,
      'Client Quotation No': row.clientQuotationNo,
      'Associate Quotation No': row.associateQuotationNo,
      'Client Quotation Total': row.clientQuotationTotal,
      'Associate Quotation Total': row.associateQuotationTotal,
      'Profit/Loss': row.profitOrLoss,
      Status: row.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProfitLoss');
    XLSX.writeFile(wb, 'profit-loss-analysis.csv');
    setSuccessMessage('CSV exported successfully');
  };

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      setError('No data available to export');
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows.map((row) => ({
      'Inquiry Project': row.inquiryProject,
      'Client Quotation No': row.clientQuotationNo,
      'Associate Quotation No': row.associateQuotationNo,
      'Client Quotation Total': row.clientQuotationTotal,
      'Associate Quotation Total': row.associateQuotationTotal,
      'Profit/Loss': row.profitOrLoss,
      Status: row.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProfitLoss');
    XLSX.writeFile(wb, 'profit-loss-analysis.xlsx');
    setSuccessMessage('Excel exported successfully');
  };

  const handleExportPDF = async () => {
    if (rows.length === 0) {
      setError('No data available to export');
      return;
    }
    const jsPDF = await import('jspdf');
    const autoTable = await import('jspdf-autotable');
    const doc = new jsPDF.jsPDF({ orientation: 'landscape' });

    autoTable.default(doc, {
      head: [[
        'Inquiry Project',
        'Client Quotation No',
        'Associate Quotation No',
        'Client Total',
        'Associate Total',
        'Profit/Loss',
        'Status',
      ]],
      body: rows.map((row) => [
        row.inquiryProject,
        row.clientQuotationNo,
        row.associateQuotationNo,
        toCurrency(row.clientQuotationTotal),
        toCurrency(row.associateQuotationTotal),
        toCurrency(row.profitOrLoss),
        row.status,
      ]),
      startY: 10,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] },
    });

    doc.save('profit-loss-analysis.pdf');
    setSuccessMessage('PDF exported successfully');
  };

  const columns: MuiDataTableColumn<ProfitLossRecord>[] = [
    {
      id: 'inquiryProject',
      label: 'Inquiry Project',
      sortable: true,
      minWidth: 180,
      searchValue: (row) => row.inquiryProject,
      render: (row) => row.inquiryProject,
    },
    {
      id: 'clientQuotationNo',
      label: 'Client Quotation No',
      sortable: true,
      render: (row) => row.clientQuotationNo,
    },
    {
      id: 'associateQuotationNo',
      label: 'Associate Quotation No',
      sortable: true,
      render: (row) => row.associateQuotationNo,
    },
    {
      id: 'clientQuotationTotal',
      label: 'Client Total',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.clientQuotationTotal,
      render: (row) => toCurrency(row.clientQuotationTotal),
    },
    {
      id: 'associateQuotationTotal',
      label: 'Associate Total',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.associateQuotationTotal,
      render: (row) => toCurrency(row.associateQuotationTotal),
    },
    {
      id: 'profitOrLoss',
      label: 'Profit/Loss',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.profitOrLoss,
      render: (row) => (
        <Typography
          component="span"
          sx={{
            color:
              row.profitOrLoss > 0
                ? 'success.main'
                : row.profitOrLoss < 0
                  ? 'error.main'
                  : 'text.primary',
            fontWeight: 700,
          }}
        >
          {toCurrency(row.profitOrLoss)}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => row.status,
    },
  ];

  if (!mounted) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Profit or Loss Analysis
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Total Profit</Typography>
              <Typography variant="h6" color="success.main">{toCurrency(summary.totalProfit)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Total Loss</Typography>
              <Typography variant="h6" color="error.main">{toCurrency(summary.totalLoss)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Net Total</Typography>
              <Typography
                variant="h6"
                color={summary.netTotal >= 0 ? 'success.main' : 'error.main'}
              >
                {toCurrency(summary.netTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                placeholder="Search by inquiry project or quotation number..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
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
            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => handleExportCSV().catch(() => setError('Export failed'))}>
                  CSV
                </Button>
                <Button size="small" variant="outlined" onClick={() => handleExportExcel().catch(() => setError('Export failed'))}>
                  Excel
                </Button>
                <Button size="small" variant="outlined" onClick={() => handleExportPDF().catch(() => setError('Export failed'))}>
                  PDF
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && rows.length === 0 ? (
        <EmptyState
          title="No profit/loss records found"
          description="Create client and associate quotations with matching inquiry projects."
        />
      ) : (
        !loading && (
          <MuiDataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => `${row.clientQuotationId}-${row.associateQuotationId}-${row.inquiryProject}`}
            page={page}
            rowsPerPage={limit}
            total={total}
            onPageChange={setPage}
            showToolbar
            loading={false}
          />
        )
      )}

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  );
}
