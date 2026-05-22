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
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-full border-collapse">
        <thead className="bg-surface border-b border-border">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  'table-header',
                  alignClass[col.align ?? 'left'],
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <Skeleton variant="table" rows={6} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
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
                  className="hover:bg-surface/60 transition-colors"
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
                          'table-cell',
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
