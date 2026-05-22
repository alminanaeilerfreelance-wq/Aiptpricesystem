import React from 'react';
import Link from 'next/link';
import StatusBadge from '../tables/StatusBadge';

export interface RecentQuotation {
  _id: string;
  quotationNo: string;
  clientName: string;
  serviceName: string;
  countryName: string;
  totalAmount: number;
  currency?: string;
  status: string;
  createdAt: string | Date;
}

export interface RecentQuotationsTableProps {
  quotations: RecentQuotation[];
}

const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatAmount = (amount: number, currency = 'SAR'): string => {
  return `${currency} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

const RecentQuotationsTable: React.FC<RecentQuotationsTableProps> = ({ quotations }) => {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-900">Recent Quotations</h3>
        <Link
          href="/quotations"
          className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
        >
          View all →
        </Link>
      </div>

      {quotations.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          No quotations yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="table-header">Quotation No</th>
                <th className="table-header">Client</th>
                <th className="table-header">Service</th>
                <th className="table-header">Country</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {quotations.slice(0, 5).map((q) => (
                <tr
                  key={q._id}
                  className="hover:bg-surface/60 transition-colors"
                >
                  <td className="table-cell">
                    <Link
                      href={`/quotations/${q._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {q.quotationNo}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <span className="truncate max-w-[140px] block" title={q.clientName}>
                      {q.clientName}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="truncate max-w-[120px] block" title={q.serviceName}>
                      {q.serviceName}
                    </span>
                  </td>
                  <td className="table-cell">{q.countryName}</td>
                  <td className="table-cell text-right tabular-nums font-medium">
                    {formatAmount(q.totalAmount, q.currency)}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={q.status as 'Approved' | 'Pending' | 'Draft' | 'Rejected'} />
                  </td>
                  <td className="table-cell text-gray-500">
                    {formatDate(q.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecentQuotationsTable;
