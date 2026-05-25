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

export interface FeeTableColorConfig {
  headerBg: string;
  subHeaderBg: string;
  procedureColBg: string;
  officialColBg: string;
  attorneyColBg: string;
  totalColBg: string;
  footerLabelBg: string;
}

export interface QuotationFeeTableProps {
  title?: string;
  currency?: string;
  data: ProcedureFeeItem[];
  colorConfig?: Partial<FeeTableColorConfig>;
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

const getContrastText = (hex: string) => {
  const safeHex = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(safeHex)) return '#ffffff';

  const r = parseInt(safeHex.slice(0, 2), 16);
  const g = parseInt(safeHex.slice(2, 4), 16);
  const b = parseInt(safeHex.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const QuotationFeeTable: React.FC<QuotationFeeTableProps> = ({
  title = 'Fee Breakdown',
  currency = 'SAR',
  data = [],
  colorConfig,
}) => {
  const colors: FeeTableColorConfig = {
    headerBg: '#0f172a',
    subHeaderBg: '#f1f5f9',
    procedureColBg: '#ffffff',
    officialColBg: '#fffbeb',
    attorneyColBg: '#ecfdf5',
    totalColBg: '#eff6ff',
    footerLabelBg: '#0f172a',
    ...colorConfig,
  };

  const headerTextColor = getContrastText(colors.headerBg);
  const subHeaderTextColor = getContrastText(colors.subHeaderBg);
  const footerLabelTextColor = getContrastText(colors.footerLabelBg);

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
            <tr style={{ backgroundColor: colors.headerBg }}>
              <th
                className="border border-slate-200 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: headerTextColor }}
              >
                Procedure
              </th>

              <th
                className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold"
                style={{ color: headerTextColor }}
              >
                Official Fees
              </th>

              <th
                className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold"
                style={{ color: headerTextColor }}
              >
                Atty Fees
              </th>

              <th
                className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold"
                style={{ color: headerTextColor }}
              >
                Total Fees
              </th>
            </tr>

            <tr style={{ backgroundColor: colors.subHeaderBg }}>
              <th className="border border-slate-200 px-4 py-2"></th>

              <th
                className="border border-slate-200 px-4 py-2 text-xs text-center"
                style={{ color: subHeaderTextColor }}
              >
                Per Mark / Class
              </th>

              <th
                className="border border-slate-200 px-4 py-2 text-xs text-center"
                style={{ color: subHeaderTextColor }}
              >
                Per Mark / Class
              </th>

              <th
                className="border border-slate-200 px-4 py-2 text-xs text-center"
                style={{ color: subHeaderTextColor }}
              >
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
                  className={clsx('transition-colors')}
                >
                  {/* Procedure */}
                  <td
                    className="border border-slate-200 px-4 py-4"
                    style={{ backgroundColor: colors.procedureColBg }}
                  >
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
                  <td
                    className="border border-slate-200 px-4 py-4 text-center"
                    style={{ backgroundColor: colors.officialColBg }}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(item.governmentFees, currency)}
                    </span>
                  </td>

                  {/* Attorney */}
                  <td
                    className="border border-slate-200 px-4 py-4 text-center"
                    style={{ backgroundColor: colors.attorneyColBg }}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(item.attorneyFees, currency)}
                    </span>
                  </td>

                  {/* Total */}
                  <td
                    className="border border-slate-200 px-4 py-4 text-center"
                    style={{ backgroundColor: colors.totalColBg }}
                  >
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
            <tr>
              <td
                className="border border-slate-200 px-4 py-4 text-sm font-bold"
                style={{
                  backgroundColor: colors.footerLabelBg,
                  color: footerLabelTextColor,
                }}
              >
                Grand Total
              </td>

              <td
                className="border border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-900"
                style={{ backgroundColor: colors.officialColBg }}
              >
                {formatCurrency(subtotalGov, currency)}
              </td>

              <td
                className="border border-slate-200 px-4 py-4 text-center text-sm font-bold text-slate-900"
                style={{ backgroundColor: colors.attorneyColBg }}
              >
                {formatCurrency(subtotalAttorney, currency)}
              </td>

              <td
                className="border border-slate-200 px-4 py-4 text-center text-base font-bold text-blue-900"
                style={{ backgroundColor: colors.totalColBg }}
              >
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
