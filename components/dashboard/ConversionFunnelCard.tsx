import React from 'react';

interface ConversionFunnelProps {
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export function ConversionFunnelCard({
  draft,
  pending,
  approved,
  rejected,
  total,
}: ConversionFunnelProps) {
  const draftPercent = total > 0 ? ((draft / total) * 100).toFixed(1) : 0;
  const pendingPercent = total > 0 ? ((pending / total) * 100).toFixed(1) : 0;
  const approvedPercent = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;
  const rejectedPercent = total > 0 ? ((rejected / total) * 100).toFixed(1) : 0;

  const conversionRate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
      <div className="space-y-4">
        {/* Draft */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Draft</span>
            <span className="text-sm font-semibold">{draft} ({draftPercent}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gray-400 h-3 rounded-full"
              style={{ width: `${draftPercent}%` }}
            />
          </div>
        </div>

        {/* Pending */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Pending</span>
            <span className="text-sm font-semibold">{pending} ({pendingPercent}%)</span>
          </div>
          <div className="w-full bg-yellow-200 rounded-full h-3">
            <div
              className="bg-yellow-500 h-3 rounded-full"
              style={{ width: `${pendingPercent}%` }}
            />
          </div>
        </div>

        {/* Approved */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Approved</span>
            <span className="text-sm font-semibold">{approved} ({approvedPercent}%)</span>
          </div>
          <div className="w-full bg-green-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full"
              style={{ width: `${approvedPercent}%` }}
            />
          </div>
        </div>

        {/* Rejected */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Rejected</span>
            <span className="text-sm font-semibold">{rejected} ({rejectedPercent}%)</span>
          </div>
          <div className="w-full bg-red-200 rounded-full h-3">
            <div
              className="bg-red-500 h-3 rounded-full"
              style={{ width: `${rejectedPercent}%` }}
            />
          </div>
        </div>

        {/* Overall Conversion Rate */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">Overall Conversion Rate</span>
            <span className="text-2xl font-bold text-green-600">{conversionRate}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {approved} of {total} quotations approved
          </p>
        </div>
      </div>
    </div>
  );
}
