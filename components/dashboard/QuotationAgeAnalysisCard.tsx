import React from 'react';

interface AgeAnalysis {
  lessThan7Days: number;
  days7to14: number;
  days14to30: number;
  moreThan30Days: number;
}

interface QuotationAgeAnalysisCardProps {
  data: AgeAnalysis;
}

export function QuotationAgeAnalysisCard({ data }: QuotationAgeAnalysisCardProps) {
  const total =
    data.lessThan7Days + data.days7to14 + data.days14to30 + data.moreThan30Days;

  const getPercent = (value: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  };

  const ageGroup = (label: string, value: number, color: string) => (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold">{value} ({getPercent(value)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${getPercent(value)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Quotation Age Analysis</h3>
      <p className="text-xs text-gray-500 mb-4">Time quotations remain in pending status</p>
      <div className="space-y-2">
        {ageGroup('< 7 Days', data.lessThan7Days, 'bg-green-500')}
        {ageGroup('7-14 Days', data.days7to14, 'bg-blue-500')}
        {ageGroup('14-30 Days', data.days14to30, 'bg-yellow-500')}
        {ageGroup('> 30 Days', data.moreThan30Days, 'bg-red-500')}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          Total pending quotations: <span className="font-semibold">{total}</span>
        </p>
      </div>
    </div>
  );
}
