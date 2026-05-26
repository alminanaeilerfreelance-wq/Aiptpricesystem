'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
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

export default function MuiDataTable<RowType>({
  rows,
  columns,
  rowKey,
  page,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50],
  loading = false,
  searchTerm = '',
  onSearchTermChange,
  searchPlaceholder = 'Search...',
  sortBy,
  sortOrder,
  onSortChange,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or adding a new record.',
  showToolbar = true,
}: MuiDataTableProps<RowType>) {
  const firstSortableColumn = useMemo(
    () => columns.find((column) => column.sortable !== false)?.id ?? columns[0]?.id ?? '',
    [columns]
  );

  const [internalSortBy, setInternalSortBy] = useState(firstSortableColumn);
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder>('asc');

  const effectiveSortBy = sortBy ?? internalSortBy;
  const effectiveSortOrder = sortOrder ?? internalSortOrder;

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

  const applyClientSearch = !onSearchTermChange;

  const filteredRows = useMemo(() => {
    if (!applyClientSearch) return rows;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return rows;

    return rows.filter((row) =>
      columns.some((column) => {
        const rawValue = column.searchValue
          ? column.searchValue(row)
          : column.sortValue
            ? String(column.sortValue(row) ?? '')
            : '';

        return rawValue.toLowerCase().includes(normalizedSearch);
      })
    );
  }, [applyClientSearch, rows, columns, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!effectiveSortBy) return filteredRows;
    const column = columns.find((item) => item.id === effectiveSortBy);
    if (!column) return filteredRows;

    const sorted = [...filteredRows].sort((leftRow, rightRow) => {
      const leftValue = column.sortValue
        ? column.sortValue(leftRow)
        : column.searchValue
          ? column.searchValue(leftRow)
          : '';
      const rightValue = column.sortValue
        ? column.sortValue(rightRow)
        : column.searchValue
          ? column.searchValue(rightRow)
          : '';

      const baseCompare = compareValues(leftValue, rightValue);
      return effectiveSortOrder === 'asc' ? baseCompare : -baseCompare;
    });

    return sorted;
  }, [columns, effectiveSortBy, effectiveSortOrder, filteredRows]);

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {showToolbar && (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}
        >
          <TextField
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => onSearchTermChange?.(event.target.value)}
            size="small"
            sx={{ flex: 1 }}
            disabled={!onSearchTermChange}
            helperText={
              onSearchTermChange
                ? undefined
                : 'Search input is handled by external filters on this page'
            }
          />
          {onRowsPerPageChange && (
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Rows</InputLabel>
              <Select
                value={String(rowsPerPage)}
                label="Rows"
                size="small"
                onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
              >
                {rowsPerPageOptions.map((option) => (
                  <MenuItem key={option} value={String(option)}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : sortedRows.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {emptyTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {emptyDescription}
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  {columns.map((column) => {
                    const isSorted = effectiveSortBy === column.id;
                    return (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        sx={{ minWidth: column.minWidth }}
                      >
                        {column.sortable === false ? (
                          <strong>{column.label}</strong>
                        ) : (
                          <TableSortLabel
                            active={isSorted}
                            direction={isSorted ? effectiveSortOrder : 'asc'}
                            onClick={() => handleSort(column.id)}
                          >
                            <strong>{column.label}</strong>
                          </TableSortLabel>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    sx={{
                      '&:hover': { backgroundColor: '#f9f9f9' },
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    {columns.map((column) => (
                      <TableCell key={`${rowKey(row)}-${column.id}`} align={column.align}>
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 2,
              px: 2,
              pb: 2,
            }}
          >
            <Typography variant="body2" color="textSecondary">
              Showing {total === 0 ? 0 : (page - 1) * rowsPerPage + 1} to{' '}
              {Math.min(page * rowsPerPage, total)} of {total} results
            </Typography>
            <Pagination
              count={Math.max(1, Math.ceil(total / rowsPerPage))}
              page={page}
              onChange={(_, nextPage) => onPageChange(nextPage)}
              color="primary"
              size="small"
            />
          </Box>
        </>
      )}
    </Paper>
  );
}

