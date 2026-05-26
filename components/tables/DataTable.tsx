import React from 'react';
import clsx from 'clsx';
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
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found',
  emptyDescription,
  keyExtractor,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
      <table className="w-full min-w-full table-separate border-spacing-y-2.5 px-2">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  'table-header bg-gray-50 text-gray-500 text-xs font-semibold border-y border-gray-100 first:rounded-l-xl last:rounded-r-xl',
                  alignClass[col.align ?? 'left'],
                )}
              >
                {col.label}
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
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4">
                <EmptyState
                  title={emptyMessage}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const rowKey = keyExtractor
                ? keyExtractor(row, rowIndex)
                : rowIndex;
              return (
                <tr
                  key={rowKey}
                  className="transition-all duration-150 hover:-translate-y-[1px]"
                >
                  {columns.map((col) => {
                    const rawValue = (row as Record<string, unknown>)[col.key];
                    const cellContent = col.render
                      ? col.render(row)
                      : rawValue !== undefined && rawValue !== null
                      ? String(rawValue)
                      : '—';

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
  );
}

export default DataTable;
