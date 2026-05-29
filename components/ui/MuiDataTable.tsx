'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';

type SortOrder = 'asc' | 'desc';

export interface MuiDataTableColumn<RowType> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  sortable?: boolean;
  render: (row: RowType) => React.ReactNode;
  sortValue?: (row: RowType) => string | number | null | undefined;
  searchValue?: (row: RowType) => string;
  exportValue?: (row: RowType) => string | number | null | undefined;
}

export interface MuiDataTableProps<RowType> {
  rows: RowType[];
  columns: MuiDataTableColumn<RowType>[];
  rowKey: (row: RowType) => string;
  page: number;
  rowsPerPage: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onRowsPerPageChange?: (nextRowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
  loading?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (nextSearch: string) => void;
  searchPlaceholder?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (nextSortBy: string, nextSortOrder: SortOrder) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  showToolbar?: boolean;
  exportFileName?: string;
  onImportData?: (rows: Record<string, unknown>[]) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

const compareValues = (
  left: string | number | null | undefined,
  right: string | number | null | undefined
) => {
  const a = left ?? '';
  const b = right ?? '';

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const normalizeToString = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export default function MuiDataTable<RowType>({
  rows,
  columns,
  rowKey,
  page,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 25, 50],
  loading = false,
  searchTerm = '',
  onSearchTermChange,
  searchPlaceholder = 'Search by name, email, role or status...',
  sortBy,
  sortOrder,
  onSortChange,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or adding a new record.',
  showToolbar = true,
  exportFileName = 'table-data',
  onImportData,
  title,
  subtitle,
  primaryActionLabel,
  onPrimaryAction,
}: MuiDataTableProps<RowType>) {
  const firstSortableColumn = useMemo(
    () => columns.find((column) => column.sortable !== false)?.id ?? columns[0]?.id ?? '',
    [columns]
  );

  const [internalSortBy, setInternalSortBy] = useState(firstSortableColumn);
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder>('asc');
  const [internalSearch, setInternalSearch] = useState('');
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() =>
    columns.map((column) => column.id)
  );
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVisibleColumnIds((prev) => {
      const nextIds = columns.map((column) => column.id);
      const previousVisible = new Set(prev);
      const intersection = nextIds.filter((id) => previousVisible.has(id));
      return intersection.length > 0 ? intersection : nextIds;
    });
  }, [columns]);

  useEffect(() => {
    if (!columns.some((column) => column.id === internalSortBy)) {
      setInternalSortBy(firstSortableColumn);
      setInternalSortOrder('asc');
    }
  }, [columns, firstSortableColumn, internalSortBy]);

  const applyClientSearch = !onSearchTermChange;
  const effectiveSearch = onSearchTermChange ? searchTerm : internalSearch;
  const effectiveSortBy = sortBy ?? internalSortBy;
  const effectiveSortOrder = sortOrder ?? internalSortOrder;

  const visibleColumns = useMemo(() => {
    const visible = new Set(visibleColumnIds);
    const filtered = columns.filter((column) => visible.has(column.id));
    return filtered.length === 0 ? columns : filtered;
  }, [columns, visibleColumnIds]);

  const handleSort = (columnId: string) => {
    const nextOrder: SortOrder =
      effectiveSortBy === columnId && effectiveSortOrder === 'asc' ? 'desc' : 'asc';

    if (onSortChange) {
      onSortChange(columnId, nextOrder);
      return;
    }

    setInternalSortBy(columnId);
    setInternalSortOrder(nextOrder);
  };

  const filteredRows = useMemo(() => {
    if (!applyClientSearch) return rows;

    const normalizedSearch = effectiveSearch.trim().toLowerCase();
    if (!normalizedSearch) return rows;

    return rows.filter((row) =>
      columns.some((column) => {
        const rawValue = column.searchValue
          ? column.searchValue(row)
          : column.sortValue
            ? String(column.sortValue(row) ?? '')
            : column.exportValue
              ? String(column.exportValue(row) ?? '')
              : '';

        return rawValue.toLowerCase().includes(normalizedSearch);
      })
    );
  }, [applyClientSearch, columns, effectiveSearch, rows]);

  const sortedRows = useMemo(() => {
    if (!effectiveSortBy) return filteredRows;
    const column = columns.find((item) => item.id === effectiveSortBy);
    if (!column) return filteredRows;

    const sorted = [...filteredRows].sort((leftRow, rightRow) => {
      const leftValue = column.sortValue
        ? column.sortValue(leftRow)
        : column.searchValue
          ? column.searchValue(leftRow)
          : column.exportValue
            ? column.exportValue(leftRow)
            : '';
      const rightValue = column.sortValue
        ? column.sortValue(rightRow)
        : column.searchValue
          ? column.searchValue(rightRow)
          : column.exportValue
            ? column.exportValue(rightRow)
            : '';

      const baseCompare = compareValues(leftValue, rightValue);
      return effectiveSortOrder === 'asc' ? baseCompare : -baseCompare;
    });

    return sorted;
  }, [columns, effectiveSortBy, effectiveSortOrder, filteredRows]);

  const getExportText = (row: RowType, column: MuiDataTableColumn<RowType>) => {
    const value = column.exportValue
      ? column.exportValue(row)
      : column.searchValue
        ? column.searchValue(row)
        : column.sortValue
          ? column.sortValue(row)
          : null;

    if (value !== null && value !== undefined) return normalizeToString(value);

    const rendered = column.render(row);
    if (typeof rendered === 'string' || typeof rendered === 'number') {
      return String(rendered);
    }

    return '';
  };

  const handleExportCsv = () => {
    const exportColumns = visibleColumns.filter((column) => column.id !== 'actions');
    if (exportColumns.length === 0) return;

    const headerRow = exportColumns.map((column) => escapeCsvCell(column.label)).join(',');
    const bodyRows = sortedRows.map((row) =>
      exportColumns
        .map((column) => escapeCsvCell(getExportText(row, column)))
        .join(',')
    );

    const csvContent = [headerRow, ...bodyRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportFileName}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const exportColumns = visibleColumns.filter((column) => column.id !== 'actions');
    if (exportColumns.length === 0) return;

    const records = sortedRows.map((row) =>
      Object.fromEntries(
        exportColumns.map((column) => [column.label, getExportText(row, column)])
      )
    );
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
  };

  const handleExportWord = () => {
    const exportColumns = visibleColumns.filter((column) => column.id !== 'actions');
    if (exportColumns.length === 0) return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 20px; margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
            th { background: #f1f5f9; color: #111827; font-weight: 700; }
            th, td { border: 1px solid #d8dee8; padding: 7px; vertical-align: top; overflow-wrap: break-word; }
            tr:nth-child(even) td { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title || exportFileName)}</h1>
          <table>
            <thead>
              <tr>${exportColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${sortedRows
                .map(
                  (row) =>
                    `<tr>${exportColumns
                      .map((column) => `<td>${escapeHtml(getExportText(row, column))}</td>`)
                      .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportFileName}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const exportColumns = visibleColumns.filter((column) => column.id !== 'actions');
    if (exportColumns.length === 0) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    autoTable(doc, {
      head: [exportColumns.map((column) => column.label)],
      body: sortedRows.map((row) =>
        exportColumns.map((column) => getExportText(row, column))
      ),
      styles: {
        fontSize: 9,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [245, 247, 250],
        textColor: [31, 41, 55],
        lineWidth: 0.3,
        lineColor: [225, 229, 235],
      },
      bodyStyles: {
        lineWidth: 0.2,
        lineColor: [236, 240, 244],
      },
      margin: { top: 36, right: 24, bottom: 24, left: 24 },
      tableWidth: 'auto',
    });
    doc.save(`${exportFileName}.pdf`);
  };

  const handleToggleColumn = (columnId: string) => {
    setVisibleColumnIds((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile || !onImportData) return;

    try {
      setImporting(true);
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return;
      const worksheet = workbook.Sheets[firstSheetName];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      await onImportData(records);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showingTo = Math.min(page * rowsPerPage, total);
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const visibleColumnCount = visibleColumns.filter((column) => column.id !== 'actions').length;

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        borderRadius: { xs: 3, md: 4 },
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 12px 28px rgba(15,23,42,0.07)',
        backgroundColor: '#fff',
      }}
    >
      {(title || subtitle || (primaryActionLabel && onPrimaryAction)) && (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              p: { xs: 2.5, md: 3 },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: 'rgba(25,118,210,0.08)',
                  color: '#1976d2',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid',
                  borderColor: 'rgba(25,118,210,0.24)',
                }}
              >
                U
              </Box>
              <Box>
                {title && (
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography variant="body2" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Stack>

            {primaryActionLabel && onPrimaryAction && (
              <Button
                variant="contained"
                onClick={onPrimaryAction}
                sx={{ borderRadius: 2.5, px: 2.25, py: 1 }}
                startIcon={<Box component="span">+</Box>}
              >
                {primaryActionLabel}
              </Button>
            )}
          </Stack>
          <Divider />
        </>
      )}

      {showToolbar && (
        <>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            sx={{
              p: { xs: 2, md: 2.5 },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', lg: 'center' },
            }}
          >
            <TextField
              placeholder={searchPlaceholder}
              value={effectiveSearch}
              onChange={(event) =>
                onSearchTermChange
                  ? onSearchTermChange(event.target.value)
                  : setInternalSearch(event.target.value)
              }
              size="small"
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 280 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        /
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
              <Button
                variant="outlined"
                onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
                sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
              >
                Columns
              </Button>
              <Button
                variant="outlined"
                disabled={visibleColumnCount === 0}
                onClick={(event) => setExportMenuAnchor(event.currentTarget)}
                sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
              >
                Export
              </Button>
              {onImportData && (
                <Button
                  variant="outlined"
                  onClick={handleImportClick}
                  disabled={importing}
                  sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
                >
                  {importing ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CircularProgress size={14} />
                      <span>Importing</span>
                    </Stack>
                  ) : (
                    'Import Excel'
                  )}
                </Button>
              )}
            </Stack>
          </Stack>

          <Menu
            anchorEl={columnMenuAnchor}
            open={Boolean(columnMenuAnchor)}
            onClose={() => setColumnMenuAnchor(null)}
          >
            {columns.map((column) => {
              const checked = visibleColumnIds.includes(column.id);
              return (
                <MenuItem key={column.id} onClick={() => handleToggleColumn(column.id)}>
                  <Checkbox checked={checked} size="small" />
                  <ListItemText>{column.label}</ListItemText>
                </MenuItem>
              );
            })}
          </Menu>

          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                handleExportCsv();
                setExportMenuAnchor(null);
              }}
            >
              Export CSV
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleExportExcel();
                setExportMenuAnchor(null);
              }}
            >
              Export Excel
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleExportPdf();
                setExportMenuAnchor(null);
              }}
            >
              Export PDF
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleExportWord();
                setExportMenuAnchor(null);
              }}
            >
              Export Word
            </MenuItem>
          </Menu>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(event) => {
              handleImportFile(event).catch(() => undefined);
            }}
          />

          <Divider />
        </>
      )}

      <TableContainer sx={{ maxHeight: { xs: 520, xl: 640 } }}>
        <Table
          stickyHeader
          sx={{
            minWidth: 780,
            borderCollapse: 'separate',
            borderSpacing: '0 10px',
            px: 1.5,
          }}
        >
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => {
                const isSorted = effectiveSortBy === column.id;
                return (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    sx={{
                      minWidth: column.minWidth,
                      backgroundColor: '#f4f6f9',
                      color: 'text.secondary',
                      fontWeight: 700,
                      fontSize: 12,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      py: 1.5,
                    }}
                  >
                    {column.sortable === false ? (
                      column.label
                    ) : (
                      <TableSortLabel
                        active={isSorted}
                        direction={isSorted ? effectiveSortOrder : 'asc'}
                        onClick={() => handleSort(column.id)}
                      >
                        {column.label}
                      </TableSortLabel>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(rowsPerPage, 8) }).map((_, index) => (
                <TableRow key={`skeleton-row-${index}`}>
                  {visibleColumns.map((column) => (
                    <TableCell key={`${column.id}-${index}`} sx={{ py: 2.2, borderBottom: 'none' }}>
                      <Skeleton variant="text" height={28} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} sx={{ borderBottom: 0 }}>
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                      {emptyTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emptyDescription}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  sx={{
                    transition: 'all 0.18s ease',
                    '& td': {
                      backgroundColor: '#ffffff',
                      borderTop: '1px solid',
                      borderBottom: '1px solid',
                      borderColor: '#edf2f7',
                    },
                    '& td:first-of-type': {
                      borderLeft: '1px solid',
                      borderColor: '#edf2f7',
                      borderTopLeftRadius: 3,
                      borderBottomLeftRadius: 3,
                    },
                    '& td:last-of-type': {
                      borderRight: '1px solid',
                      borderColor: '#edf2f7',
                      borderTopRightRadius: 3,
                      borderBottomRightRadius: 3,
                    },
                    '&:hover td': {
                      backgroundColor: '#f9fcff',
                    },
                  }}
                >
                  {visibleColumns.map((column) => (
                    <TableCell key={`${rowKey(row)}-${column.id}`} align={column.align}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
          gap: 2,
          alignItems: 'center',
          px: { xs: 2, md: 2.5 },
          py: 1.5,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'center', md: 'left' } }}>
          Showing {showingFrom} to {showingTo} of {total} entries
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, nextPage) => onPageChange(nextPage)}
            color="primary"
            shape="rounded"
            size="small"
          />
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: { xs: 'center', md: 'flex-end' },
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Rows per page
          </Typography>
          <FormControl size="small" sx={{ minWidth: 88 }}>
            <InputLabel id="rows-per-page-label">Rows</InputLabel>
            <Select
              labelId="rows-per-page-label"
              value={String(rowsPerPage)}
              label="Rows"
              onChange={(event) => onRowsPerPageChange?.(Number(event.target.value))}
              disabled={!onRowsPerPageChange}
            >
              {rowsPerPageOptions.map((option) => (
                <MenuItem key={option} value={String(option)}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>
    </Paper>
  );
}
