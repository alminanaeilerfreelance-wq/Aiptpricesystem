'use client';

import React, { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { Card } from '@/components/ui';
import { QuotationsLineChart } from '@/components/dashboard';
import { reportsService, RevenueReport } from '@/services/reports.service';

function formatCurrency(value: number, currency = 'SAR') {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ' + currency;
}

export default function RevenueReportPage() {
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await reportsService.getRevenueReport();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load revenue report');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Monthly revenue chart data — use count as proxy for chart's "count" field
  const monthlyChartData = (report?.byMonth ?? []).map((m) => ({
    month: m.month,
    count: Math.round(m.revenue),
  }));

  const byServiceEntries = report
    ? Object.entries(report.byService).sort((a, b) => b[1] - a[1])
    : [];

  const byCountryEntries = report
    ? Object.entries(report.byCountry).sort((a, b) => b[1] - a[1])
    : [];

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Revenue Report" breadcrumbs={[{ label: 'Reports' }, { label: 'Revenue' }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Revenue Report"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Revenue' }]}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Total Revenue Summary */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                Total Revenue
              </p>
              <p className="text-4xl font-bold text-gray-900">
                {formatCurrency(report?.totalRevenue ?? 0)}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Approved</p>
                <p className="text-xl font-semibold text-green-600">
                  {formatCurrency(report?.approvedRevenue ?? 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Pending</p>
                <p className="text-xl font-semibold text-yellow-600">
                  {formatCurrency(report?.pendingRevenue ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Monthly Revenue Chart */}
        <QuotationsLineChart
          data={monthlyChartData}
          title="Monthly Revenue Trend"
        />

        {/* Top Clients and Top Countries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Clients by Service */}
          <Card padding="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900">Revenue by Service</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="table-header text-left">Service</th>
                    <th className="table-header text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {byServiceEntries.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="table-cell text-center text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    byServiceEntries.map(([service, revenue]) => (
                      <tr key={service} className="hover:bg-surface/60 transition-colors">
                        <td className="table-cell font-medium text-gray-900">{service}</td>
                        <td className="table-cell text-right font-mono text-sm text-gray-700">
                          {formatCurrency(revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Top Countries */}
          <Card padding="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900">Revenue by Country</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="table-header text-left">Country</th>
                    <th className="table-header text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {byCountryEntries.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="table-cell text-center text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    byCountryEntries.map(([country, revenue]) => (
                      <tr key={country} className="hover:bg-surface/60 transition-colors">
                        <td className="table-cell font-medium text-gray-900">{country}</td>
                        <td className="table-cell text-right font-mono text-sm text-gray-700">
                          {formatCurrency(revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
