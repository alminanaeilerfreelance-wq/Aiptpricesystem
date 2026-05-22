import React from 'react';

export interface StatsCardsProps {
  totalQuotations: number;
  approvedCount: number;
  pendingCount: number;
  totalValue: number;
  currency?: string;
  trends?: {
    totalQuotations?: number;
    approvedCount?: number;
    pendingCount?: number;
    totalValue?: number;
  };
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: number;
  accentColor: string;
}

const TrendIndicator: React.FC<{ value: number }> = ({ value }) => {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-success' : 'text-danger'
      }`}
    >
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d={
            isPositive
              ? 'M5 10l7-7m0 0l7 7m-7-7v18'
              : 'M19 14l-7 7m0 0l-7-7m7 7V3'
          }
        />
      </svg>
      {Math.abs(value)}%
    </span>
  );
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBg,
  trend,
  accentColor,
}) => (
  <div className={`card p-5 flex flex-col gap-4 border-t-4 ${accentColor}`}>
    <div className="flex items-start justify-between">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {trend !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          <TrendIndicator value={trend} />
          <span className="text-xs text-gray-400">vs last month</span>
        </div>
      )}
    </div>
  </div>
);

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileIcon = () => (
  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

const StatsCards: React.FC<StatsCardsProps> = ({
  totalQuotations,
  approvedCount,
  pendingCount,
  totalValue,
  currency = 'SAR',
  trends,
}) => {
  const formatValue = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

  const cards: StatCardProps[] = [
    {
      label: 'Total Quotations',
      value: formatValue(totalQuotations),
      icon: <FileIcon />,
      iconBg: 'bg-blue-50',
      accentColor: 'border-primary',
      trend: trends?.totalQuotations,
    },
    {
      label: 'Approved Quotations',
      value: formatValue(approvedCount),
      icon: <CheckCircleIcon />,
      iconBg: 'bg-green-50',
      accentColor: 'border-success',
      trend: trends?.approvedCount,
    },
    {
      label: 'Pending Quotations',
      value: formatValue(pendingCount),
      icon: <ClockIcon />,
      iconBg: 'bg-yellow-50',
      accentColor: 'border-warning',
      trend: trends?.pendingCount,
    },
    {
      label: `Total Value ${currency}`,
      value: `${currency} ${formatValue(totalValue)}`,
      icon: <CurrencyIcon />,
      iconBg: 'bg-purple-50',
      accentColor: 'border-purple-500',
      trend: trends?.totalValue,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
};

export default StatsCards;
