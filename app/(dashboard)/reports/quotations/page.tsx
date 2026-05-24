'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { Card } from '@/components/ui';
import { QuotationsLineChart } from '@/components/dashboard';
import { reportsService, QuotationsReport } from '@/services/reports.service';

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
  href?: string;
}

function StatCard({ label, value, colorClass, href }: StatCardProps) {
  const content = (
    <div className="card p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${colorClass}`}>{value.toLocaleString()}</span>
    </div>
  );
  
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function QuotationsReportPage() {
  const [report, setReport] = useState<QuotationsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await reportsService.getQuotationsReport();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Monthly chart data from report.monthly array
  const lineChartData = report
    ? report.monthly.map((item) => ({ month: item.month, count: item.count }))
    : [];

  const byServiceEntries = report
    ? [...report.byService].sort((a, b) => b.count - a.count)
    : [];

  const byCountryEntries = report
    ? [...report.byCountry].sort((a, b) => b.count - a.count)
    : [];

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Quotations Report" breadcrumbs={[{ label: 'Reports' }, { label: 'Quotations' }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Quotations Report"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Quotations' }]}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="Total" value={report?.total ?? 0} colorClass="text-gray-900" href="/quotations" />
          <StatCard label="Approved" value={report?.approved ?? 0} colorClass="text-green-600" href="/quotations?status=Approved" />
          <StatCard label="Pending" value={report?.pending ?? 0} colorClass="text-yellow-600" href="/quotations?status=Pending" />
          <StatCard label="Draft" value={report?.draft ?? 0} colorClass="text-gray-500" href="/quotations?status=Draft" />
          <StatCard label="Rejected" value={report?.rejected ?? 0} colorClass="text-red-600" href="/quotations?status=Rejected" />
        </div>

        {/* Monthly Line Chart */}
        <QuotationsLineChart
          data={lineChartData}
          title="Monthly Quotations Trend"
        />

        {/* By Service and By Country Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Service */}
          <Card padding="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900">By Service</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="table-header text-left">Service</th>
                    <th className="table-header text-right">Count</th>
                    <th className="table-header text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {byServiceEntries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="table-cell text-center text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    byServiceEntries.map((item) => (
                      <tr key={item.service} className="hover:bg-surface/60 transition-colors">
                        <td className="table-cell font-medium text-gray-900">
                          <Link
                            href={`/quotations?service=${encodeURIComponent(item.service)}`}
                            className="text-primary hover:underline"
                          >
                            {item.service}
                          </Link>
                        </td>
                        <td className="table-cell text-right text-gray-700">{item.count}</td>
                        <td className="table-cell text-right text-gray-500">{item.value?.toLocaleString() ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* By Country */}
          <Card padding="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900">By Country</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="table-header text-left">Country</th>
                    <th className="table-header text-right">Count</th>
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
                    byCountryEntries.map((item) => (
                      <tr key={item.country} className="hover:bg-surface/60 transition-colors">
                        <td className="table-cell font-medium text-gray-900">
                          <Link
                            href={`/quotations?country=${encodeURIComponent(item.country)}`}
                            className="text-primary hover:underline"
                          >
                            {item.country}
                          </Link>
                        </td>
                        <td className="table-cell text-right text-gray-700">{item.count}</td>
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
