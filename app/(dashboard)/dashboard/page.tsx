'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { StatsCards } from '@/components/dashboard';
import { QuotationsLineChart } from '@/components/dashboard';
import { TopCountriesPieChart } from '@/components/dashboard';
import { RecentQuotationsTable } from '@/components/dashboard';
import { reportsService, QuotationsReport } from '@/services/reports.service';
import { quotationsService, Quotation } from '@/services/quotations.service';
import { usersService, User } from '@/services/users.service';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<QuotationsReport | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [reportData, quotationsData] = await Promise.all([
          reportsService.getQuotationsReport(),
          quotationsService.list(),
        ]);
        setReport(reportData);
        setQuotations(quotationsData.quotations);
        if (user?.role === 'admin') {
          try {
            const usersData = await usersService.list();
            setPendingUsers(usersData.users.filter((item) => item.approvalStatus === 'pending'));
          } catch {
            setPendingUsers([]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.role]);

  // Monthly chart data from report.monthly array
  const lineChartData = (() => {
    if (!report) return [];
    return report.monthly.map((item) => ({ month: item.month, count: item.count }));
  })();

  // Pie chart data from byCountry array
  const pieChartData = (() => {
    if (!report) return [];
    return [...report.byCountry]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  })();

  // Recent 5 quotations for the table
  const recentQuotations = quotations.slice(0, 5).map((q) => ({
    _id: q._id,
    quotationNo: q.quotationNo,
    clientName: q.clientName,
    serviceName: q.service,
    countryName: q.country,
    totalAmount: q.total,
    currency: q.currency,
    status: q.status,
    createdAt: q.createdAt,
  }));

  // Total value from approved quotations
  const approvedTotal = quotations
    .filter((q) => q.status === 'Approved')
    .reduce((sum, q) => sum + q.total, 0);

  const currency = quotations[0]?.currency ?? 'SAR';

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {user?.role === 'admin' && pendingUsers.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  New user approval required
                </p>
                <p className="text-sm text-amber-700">
                  {pendingUsers.length} registered user{pendingUsers.length > 1 ? 's are' : ' is'} waiting for admin approval.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingUsers.slice(0, 3).map((pendingUser) => (
                  <span key={pendingUser._id} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-amber-800">
                    {pendingUser.name}
                  </span>
                ))}
                <Link href="/users" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                  Review users
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : report ? (
          <StatsCards
            totalQuotations={report.total}
            approvedCount={report.approved}
            pendingCount={report.pending}
            totalValue={approvedTotal}
            currency={currency}
          />
        ) : null}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <div className="card p-6 h-80 animate-pulse bg-gray-100" />
              <div className="card p-6 h-80 animate-pulse bg-gray-100" />
            </>
          ) : (
            <>
              <QuotationsLineChart data={lineChartData} />
              <TopCountriesPieChart data={pieChartData} />
            </>
          )}
        </div>

        {/* Recent Quotations */}
        {loading ? (
          <div className="card p-6 h-64 animate-pulse bg-gray-100" />
        ) : (
          <RecentQuotationsTable quotations={recentQuotations} />
        )}
      </div>
    </div>
  );
}
