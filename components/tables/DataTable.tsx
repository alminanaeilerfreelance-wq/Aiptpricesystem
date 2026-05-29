'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  keyExtractor?: (row: T, index: number) => string | number;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  searchPlaceholder?: string;
  exportFileName?: string;
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found',
  emptyDescription,
  keyExtractor,
  searchTerm,
  onSearchTermChange,
  searchPlaceholder = 'Search table...',
  exportFileName = 'table-data',
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState(columns.find((column) => column.key !== 'actions')?.key || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const effectiveSearch = searchTerm ?? internalSearch;
  const exportColumns = useMemo(() => columns.filter((column) => column.key !== 'actions'), [columns]);

  const getCellText = (row: T, column: Column<T>) => {
    const rawValue = (row as Record<string, unknown>)[column.key];
    return rawValue === undefined || rawValue === null ? '' : String(rawValue);
  };

  const searchedRows = useMemo(() => {
    const query = effectiveSearch.trim().toLowerCase();
    if (!query) return data;
    return data.filter((row) =>
      exportColumns.some((column) => getCellText(row, column).toLowerCase().includes(query))
    );
  }, [data, effectiveSearch, exportColumns]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return searchedRows;
    const sorted = [...searchedRows].sort((left, right) => {
      const leftValue = String((left as Record<string, unknown>)[sortKey] ?? '');
      const rightValue = String((right as Record<string, unknown>)[sortKey] ?? '');
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? result : -result;
    });
    return sorted;
  }, [searchedRows, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const pagedRows = sortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const showingFrom = sortedRows.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showingTo = Math.min(page * rowsPerPage, sortedRows.length);

  const handleSearchChange = (value: string) => {
    setPage(1);
    if (onSearchTermChange) {
      onSearchTermChange(value);
      return;
    }
    setInternalSearch(value);
  };

  const handleSort = (columnKey: string) => {
    if (columnKey === 'actions') return;
    setSortOrder((currentOrder) => (sortKey === columnKey && currentOrder === 'asc' ? 'desc' : 'asc'));
    setSortKey(columnKey);
  };

  const handleExportCsv = () => {
    const csv = [
      exportColumns.map((column) => escapeCsvCell(column.label)).join(','),
      ...sortedRows.map((row) =>
        exportColumns.map((column) => escapeCsvCell(getCellText(row, column))).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportFileName}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const records = sortedRows.map((row) =>
      Object.fromEntries(exportColumns.map((column) => [column.label, getCellText(row, column)]))
    );
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    autoTable(doc, {
      head: [exportColumns.map((column) => column.label)],
      body: sortedRows.map((row) => exportColumns.map((column) => getCellText(row, column))),
      styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39] },
      margin: { top: 30, right: 24, bottom: 24, left: 24 },
    });
    doc.save(`${exportFileName}.pdf`);
  };

  const handleExportWord = () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111827; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
            th, td { border: 1px solid #d8dee8; padding: 7px; overflow-wrap: break-word; }
            th { background: #f1f5f9; font-weight: 700; }
            tr:nth-child(even) td { background: #f8fafc; }
          </style>
        </head>
        <body>
          <table>
            <thead><tr>${exportColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
            <tbody>
              ${sortedRows
                .map((row) => `<tr>${exportColumns.map((column) => `<td>${escapeHtml(getCellText(row, column))}</td>`).join('')}</tr>`)
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

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
            /
          </span>
          <input
            type="search"
            value={effectiveSearch}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExportCsv} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            CSV
          </button>
          <button type="button" onClick={handleExportExcel} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Excel
          </button>
          <button type="button" onClick={handleExportPdf} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            PDF
          </button>
          <button type="button" onClick={handleExportWord} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Word
          </button>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-full table-separate border-spacing-y-2.5 px-2">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  onClick={() => handleSort(col.key)}
                  className={clsx(
                    'table-header bg-gray-50 text-gray-500 text-xs font-semibold border-y border-gray-100 first:rounded-l-xl last:rounded-r-xl',
                    col.key !== 'actions' && 'cursor-pointer select-none hover:text-gray-900',
                    alignClass[col.align ?? 'left'],
                  )}
                >
                  {col.label}
                  {sortKey === col.key && col.key !== 'actions' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-3">
                  <Skeleton variant="table" rows={6} />
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <EmptyState title={emptyMessage} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              pagedRows.map((row, rowIndex) => {
                const rowKey = keyExtractor ? keyExtractor(row, rowIndex) : rowIndex;
                return (
                  <tr key={rowKey} className="transition-all duration-150 hover:-translate-y-[1px]">
                    {columns.map((col) => {
                      const rawValue = (row as Record<string, unknown>)[col.key];
                      const cellContent = col.render
                        ? col.render(row)
                        : rawValue !== undefined && rawValue !== null
                          ? String(rawValue)
                          : '-';

                      return (
                        <td
                          key={col.key}
                          className={clsx(
                            'table-cell border-y border-gray-100 bg-white first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r hover:bg-sky-50/40',
                            alignClass[col.align ?? 'left'],
                          )}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
        <span>
          Showing {showingFrom} to {showingTo} of {sortedRows.length} entries
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-2">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
          <select
            value={rowsPerPage}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium"
          >
            {[10, 25, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option} rows
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
