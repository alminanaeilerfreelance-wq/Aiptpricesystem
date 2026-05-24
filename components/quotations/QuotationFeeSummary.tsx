import React from 'react';
import clsx from 'clsx';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ProcedureFeeItem {
  procedureName: string;
  governmentFees: number;
  attorneyFees: number;
  total?: number;
  note?: string;
}

export interface QuotationFeeTableProps {
  title?: string;
  currency?: string;
  data: ProcedureFeeItem[];
}

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency: string) => {
  return `${currency} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const QuotationFeeTable: React.FC<QuotationFeeTableProps> = ({
  title = 'Fee Breakdown',
  currency = 'SAR',
  data = [],
}) => {
  // Auto-calculate total if missing
  const safeData = data.map((item) => ({
    ...item,
    total: item.total ?? item.governmentFees + item.attorneyFees,
  }));

  // Totals
  const subtotalGov = safeData.reduce(
    (sum, item) => sum + item.governmentFees,
    0
  );

  const subtotalAttorney = safeData.reduce(
    (sum, item) => sum + item.attorneyFees,
    0
  );

  const grandTotal = safeData.reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>

        <div className="text-sm text-gray-500">
          Currency: <span className="font-semibold">{currency}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse bg-white">
          {/* Header */}
          <thead>
            <tr className="bg-slate-900">
              <th className="border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-white">
                Procedure
              </th>

              <th className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-white">
                Official Fees
              </th>

              <th className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-white">
                Atty Fees
              </th>

              <th className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-white">
                Total Fees
              </th>
            </tr>

            <tr className="bg-slate-100">
              <th className="border border-slate-200 px-4 py-2"></th>

              <th className="border border-slate-200 px-4 py-2 text-xs text-slate-600 text-center">
                Per Mark / Class
              </th>

              <th className="border border-slate-200 px-4 py-2 text-xs text-slate-600 text-center">
                Per Mark / Class
              </th>

              <th className="border border-slate-200 px-4 py-2 text-xs text-slate-600 text-center">
                Per Mark / Class
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {safeData.length > 0 ? (
              safeData.map((item, index) => (
                <tr
                  key={index}
                  className={clsx(
                    'transition-colors hover:bg-gray-50',
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                  )}
                >
                  {/* Procedure */}
                  <td className="border border-slate-200 px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-800">
                        {item.procedureName}
                      </span>

                      {item.note && (
                        <span className="text-xs text-gray-400 mt-1">
                          {item.note}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Government */}
                  <td className="border border-slate-200 bg-amber-50 px-4 py-4 text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(item.governmentFees, currency)}
                    </span>
                  </td>

                  {/* Attorney */}
                  <td className="border border-slate-200 bg-emerald-50 px-4 py-4 text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(item.attorneyFees, currency)}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="border border-slate-200 bg-blue-50 px-4 py-4 text-center">
                    <span className="text-sm font-bold text-blue-700">
                      {formatCurrency(item.total || 0, currency)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="border border-slate-200 px-4 py-8 text-center text-gray-500"
                >
                  No fee data available
                </td>
              </tr>
            )}
          </tbody>

          {/* Footer */}
          <tfoot>
            <tr className="bg-slate-900">
              <td className="border border-slate-200 px-4 py-4 text-sm font-bold text-white">
                Grand Total
              </td>

              <td className="border border-slate-200 bg-amber-100 px-4 py-4 text-center text-sm font-bold text-slate-900">
                {formatCurrency(subtotalGov, currency)}
              </td>

              <td className="border border-slate-200 bg-emerald-100 px-4 py-4 text-center text-sm font-bold text-slate-900">
                {formatCurrency(subtotalAttorney, currency)}
              </td>

              <td className="border border-slate-200 bg-blue-200 px-4 py-4 text-center text-base font-bold text-blue-900">
                {formatCurrency(grandTotal, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default QuotationFeeTable;
