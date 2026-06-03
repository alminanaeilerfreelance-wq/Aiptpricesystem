'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import {
  StatsCards,
  QuotationsLineChart,
  TopCountriesPieChart,
  TeamPerformanceChart,
  ServiceDemandChart,
  ConversionFunnelCard,
  RevenueByClientChart,
  QuotationAgeAnalysisCard,
  QuotationAmountDistributionChart,
} from '@/components/dashboard';
import { reportsService, QuotationsReport } from '@/services/reports.service';
import { quotationsService, Quotation } from '@/services/quotations.service';
import { usersService, User } from '@/services/users.service';
import { useAuth } from '@/hooks/useAuth';

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const apiError = err as {
      response?: { data?: { error?: string; details?: string }; status?: number };
      message?: string;
    };

    return (
      apiError.response?.data?.error ||
      apiError.response?.data?.details ||
      apiError.message ||
      fallback
    );
  }

  return fallback;
}

function buildReportFromQuotations(quotations: Quotation[]): QuotationsReport {
  const statusCounts = quotations.reduce(
    (acc, quotation) => {
      acc[quotation.status] = (acc[quotation.status] || 0) + 1;
      return acc;
    },
    {} as Record<Quotation['status'], number>
  );

  const byServiceMap = new Map<string, { service: string; count: number; value: number }>();
  const byCountryMap = new Map<string, { country: string; count: number }>();
  const monthlyMap = new Map<string, { month: string; count: number; value: number }>();

  quotations.forEach((quotation) => {
    const serviceItem =
      byServiceMap.get(quotation.service) ||
      { service: quotation.service, count: 0, value: 0 };
    serviceItem.count += 1;
    serviceItem.value += quotation.total;
    byServiceMap.set(quotation.service, serviceItem);

    const countryItem =
      byCountryMap.get(quotation.country) ||
      { country: quotation.country, count: 0 };
    countryItem.count += 1;
    byCountryMap.set(quotation.country, countryItem);

    const createdAt = new Date(quotation.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      const month = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      const monthlyItem =
        monthlyMap.get(month) ||
        { month, count: 0, value: 0 };
      monthlyItem.count += 1;
      monthlyItem.value += quotation.total;
      monthlyMap.set(month, monthlyItem);
    }
  });

  return {
    total: quotations.length,
    approved: statusCounts.Approved || 0,
    pending: statusCounts.Pending || 0,
    draft: statusCounts.Draft || 0,
    rejected: statusCounts.Rejected || 0,
    totalValue: quotations.reduce((sum, quotation) => sum + quotation.total, 0),
    byService: Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count),
    byCountry: Array.from(byCountryMap.values()).sort((a, b) => b.count - a.count),
    monthly: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<QuotationsReport | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (authLoading) return;

      if (!user) {
        setLoading(false);
        setReport(null);
        setQuotations([]);
        setAllUsers([]);
        setPendingUsers([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [reportResult, quotationsResult] = await Promise.allSettled([
          reportsService.getQuotationsReport(),
          quotationsService.list({ limit: 100 }),
        ]);

        const nextQuotations =
          quotationsResult.status === 'fulfilled' ? quotationsResult.value.quotations : [];
        const nextReport =
          reportResult.status === 'fulfilled'
            ? reportResult.value
            : buildReportFromQuotations(nextQuotations);

        if (reportResult.status === 'rejected' && quotationsResult.status === 'rejected') {
          throw reportResult.reason;
        }

        if (reportResult.status === 'rejected') {
          console.warn(
            'Dashboard report API failed; using quotation data fallback.',
            reportResult.reason
          );
        }

        if (quotationsResult.status === 'rejected') {
          console.warn('Dashboard quotation list failed.', quotationsResult.reason);
        }

        setReport(nextReport);
        setQuotations(nextQuotations);

        if (user.role === 'admin') {
          const usersResult = await Promise.allSettled([usersService.list()]);
          const usersResponse = usersResult[0];
          const users = usersResponse.status === 'fulfilled' ? usersResponse.value.users : [];

          if (usersResponse.status === 'rejected') {
            console.warn('Dashboard users list failed.', usersResponse.reason);
          }

          setAllUsers(users);
          setPendingUsers(users.filter((item) => item.approvalStatus === 'pending'));
        } else {
          setAllUsers([]);
          setPendingUsers([]);
        }
      } catch (err) {
        setReport(null);
        setQuotations([]);
        setError(getApiErrorMessage(err, 'Failed to load dashboard data'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [authLoading, user]);

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

  // Team performance data (admin only)
  const teamPerformanceData = (() => {
    if (!report?.byUser) return [];
    return report.byUser;
  })();

  // Service demand data
  const serviceDemandData = (() => {
    if (!report?.byService) return [];
    return report.byService;
  })();

  // Total value from approved quotations
  const approvedTotal = quotations
    .filter((q) => q.status === 'Approved')
    .reduce((sum, q) => sum + q.total, 0);

  // Quotation age analysis - only for pending quotations
  const ageAnalysis = (() => {
    if (!report?.quotationAgeAnalysis) {
      const pendingQuotations = quotations.filter((q) => q.status === 'Pending');
      const now = new Date();
      const age = { lessThan7Days: 0, days7to14: 0, days14to30: 0, moreThan30Days: 0 };

      pendingQuotations.forEach((q) => {
        const createdDate = new Date(q.createdAt);
        const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld < 7) age.lessThan7Days++;
        else if (daysOld < 14) age.days7to14++;
        else if (daysOld < 30) age.days14to30++;
        else age.moreThan30Days++;
      });

      return age;
    }
    return report.quotationAgeAnalysis;
  })();

  // Top clients by revenue
  const topClientsData = (() => {
    if (report?.topClients) return report.topClients;

    const clientRevenue: Record<string, number> = {};
    quotations
      .filter((q) => q.status === 'Approved')
      .forEach((q) => {
        clientRevenue[q.clientName] = (clientRevenue[q.clientName] || 0) + q.total;
      });

    return Object.entries(clientRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  })();

  // Amount distribution
  const amountDistribution = (() => {
    if (report?.amountDistribution) return report.amountDistribution;

    const ranges = {
      '0-5K': 0,
      '5K-10K': 0,
      '10K-25K': 0,
      '25K-50K': 0,
      '50K+': 0,
    };

    quotations.forEach((q) => {
      if (q.total < 5000) ranges['0-5K']++;
      else if (q.total < 10000) ranges['5K-10K']++;
      else if (q.total < 25000) ranges['10K-25K']++;
      else if (q.total < 50000) ranges['25K-50K']++;
      else ranges['50K+']++;
    });

    return Object.entries(ranges).map(([range, count]) => ({ range, count }));
  })();

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

        {/* Admin Management Section */}
        {user?.role === 'admin' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Administration</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Users Management Card */}
              <Link href="/users">
                <div className="card p-6 hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">Users Management</h3>
                      <p className="text-sm text-blue-700 mt-2">
                        Manage user accounts, roles, and approvals
                      </p>
                    </div>
                    <div className="text-3xl">👥</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-blue-600">Total Users</p>
                        <p className="text-lg font-semibold text-blue-900">{allUsers.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Pending</p>
                        <p className="text-lg font-semibold text-orange-600">{pendingUsers.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* IP Services Fee Builder Card */}
              <Link href="/reports/fee-builder">
                <div className="card p-6 hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-emerald-50 to-cyan-100 border border-emerald-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-950">IP Services Fee Builder</h3>
                      <p className="text-sm text-emerald-800 mt-2">
                        Create IP fee comparison reports with grouped service columns
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-white/80 flex items-center justify-center text-sm font-bold text-emerald-900 border border-emerald-200">
                      IP
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <p className="text-xs text-emerald-700">
                      Export Excel, PDF, CSV, JSON, and print-ready reports
                    </p>
                  </div>
                </div>
              </Link>

              {/* Roles & Permissions Card */}
              <Link href="/roles">
                <div className="card p-6 hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-purple-900">Roles & Permissions</h3>
                      <p className="text-sm text-purple-700 mt-2">
                        Define roles and assign permissions
                      </p>
                    </div>
                    <div className="text-3xl">🔐</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <p className="text-xs text-purple-600">
                      Manage access control and user roles
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </section>
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

        {/* Main Charts Row */}
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

        {/* Service Demand and Conversion Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <div className="card p-6 h-80 animate-pulse bg-gray-100" />
              <div className="card p-6 h-80 animate-pulse bg-gray-100" />
            </>
          ) : (
            <>
              <ServiceDemandChart data={serviceDemandData} />
              <ConversionFunnelCard
                draft={report?.draft || 0}
                pending={report?.pending || 0}
                approved={report?.approved || 0}
                rejected={report?.rejected || 0}
                total={report?.total || 0}
              />
            </>
          )}
        </div>

        {/* Age Analysis and Amount Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <div className="card p-6 h-64 animate-pulse bg-gray-100" />
              <div className="card p-6 h-64 animate-pulse bg-gray-100" />
            </>
          ) : (
            <>
              <QuotationAgeAnalysisCard data={ageAnalysis} />
              <QuotationAmountDistributionChart data={amountDistribution} />
            </>
          )}
        </div>

        {/* Revenue by Client (Top Clients) */}
        {!loading && (
          <RevenueByClientChart data={topClientsData} currency={currency} />
        )}

        {/* Team Performance - Admin Only */}
        {user?.role === 'admin' && !loading && teamPerformanceData.length > 0 && (
          <TeamPerformanceChart data={teamPerformanceData} />
        )}

      </div>
    </div>
  );
}
