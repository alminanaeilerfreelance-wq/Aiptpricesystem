import React from 'react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeeItem {
  label: string;
  amount: number;
  note?: string;
}

export interface FeeBreakdown {
  [key: string]: number | FeeItem;
}

export interface QuotationFeeSummaryProps {
  fees: FeeBreakdown;
  numberOfClasses?: number;
  multiplier?: number;
  subtotal: number;
  total: number;
  currency?: string;
  title?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency: string): string =>
  `${currency} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;

const toFeeItem = (key: string, value: number | FeeItem): FeeItem => {
  if (typeof value === 'number') {
    // Convert camelCase / snake_case key to a readable label
    const label = key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
    return { label, amount: value };
  }
  return value;
};

// ─── Row components ───────────────────────────────────────────────────────────

const FeeRow: React.FC<{
  label: string;
  amount: number;
  note?: string;
  currency: string;
  muted?: boolean;
}> = ({ label, amount, note, currency, muted = false }) => (
  <div
    className={clsx(
      'flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0',
      muted && 'opacity-60',
    )}
  >
    <div>
      <span className="text-sm text-gray-700">{label}</span>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
    <span className="text-sm font-medium text-gray-900 tabular-nums ml-4 shrink-0">
      {formatCurrency(amount, currency)}
    </span>
  </div>
);

const DividerRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 text-xs text-gray-400">
    <span>{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const QuotationFeeSummary: React.FC<QuotationFeeSummaryProps> = ({
  fees,
  numberOfClasses,
  multiplier,
  subtotal,
  total,
  currency = 'SAR',
  title = 'Fee Summary',
}) => {
  const feeItems = Object.entries(fees).map(([key, value]) =>
    toFeeItem(key, value),
  );

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400 font-medium">{currency}</span>
      </div>

      {/* Multiplier meta info */}
      {(numberOfClasses !== undefined || multiplier !== undefined) && (
        <div className="mb-3 space-y-0.5">
          {numberOfClasses !== undefined && (
            <DividerRow
              label="Number of Classes"
              value={String(numberOfClasses)}
            />
          )}
          {multiplier !== undefined && (
            <DividerRow
              label="Multiplier"
              value={`×${multiplier}`}
            />
          )}
        </div>
      )}

      {/* Fee line items */}
      <div className="mb-4">
        {feeItems.map((item) => (
          <FeeRow
            key={item.label}
            label={item.label}
            amount={item.amount}
            note={item.note}
            currency={currency}
          />
        ))}
      </div>

      {/* Subtotal */}
      <div className="flex items-center justify-between py-2.5 border-t border-border">
        <span className="text-sm text-gray-600">Subtotal</span>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {formatCurrency(subtotal, currency)}
        </span>
      </div>

      {/* Total – highlighted */}
      <div className="flex items-center justify-between mt-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
        <span className="text-sm font-bold text-gray-900">Total Amount</span>
        <span className="text-lg font-bold text-success tabular-nums">
          {formatCurrency(total, currency)}
        </span>
      </div>
    </div>
  );
};

export default QuotationFeeSummary;
