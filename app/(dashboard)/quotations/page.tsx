'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { TablePagination } from '@/components/tables';
import { Button } from '@/components/ui';
import { Select } from '@/components/ui';
import { Modal } from '@/components/ui';
import { quotationsService, Quotation } from '@/services/quotations.service';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currency';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

const PAGE_SIZE = 10;

export default function QuotationsPage() {
  const { user } = useAuth();
  const { canAdd, canEdit, canDelete, canView, canApprove, canReject } = usePermission();
  
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const [currentPage, setCurrentPage] = useState(1);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initialize filters from URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || '';
    const service = params.get('service') || '';
    const country = params.get('country') || '';
    setStatusFilter(status);
    setServiceFilter(service);
    setCountryFilter(country);
  }, []);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (statusFilter) params.status = statusFilter;
      if (serviceFilter) params.service = serviceFilter;
      if (countryFilter) params.country = countryFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await quotationsService.list(params);
      setQuotations(data.quotations);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter, countryFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, serviceFilter, countryFilter, debouncedSearch]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await quotationsService.delete(deleteTarget._id);
      setDeleteTarget(null);
      if (quotations.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await fetchQuotations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quotation');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'quotationNo',
      label: 'Quotation No',
      render: (row: Quotation) => (
        <Link
          href={`/quotations/${row._id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.quotationNo}
        </Link>
      ),
    },
    { key: 'clientName', label: 'Client Name' },
    { key: 'service', label: 'Service' },
    { key: 'procedure', label: 'Procedure' },
    { key: 'country', label: 'Country' },
    {
      key: 'total',
      label: 'Total',
      align: 'right' as const,
      render: (row: Quotation) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.total, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Quotation) => (
        <StatusBadge status={row.status} />
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (row: Quotation) =>
        new Date(row.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Quotation) => (
        <div className="flex items-center gap-2">
          {canView('quotations') && (
            <Link href={`/quotations/${row._id}`}>
              <Button variant="secondary" size="sm">
                View
              </Button>
            </Link>
          )}
          {canEdit('quotations') && (
            <Link href={`/quotations/${row._id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
          )}
          {canDelete('quotations') && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(row)}
            >
              Delete
            </Button>
          )}
          {canApprove('quotations') && row.status === 'Pending' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {/* Approve logic */}}
            >
              Approve
            </Button>
          )}
          {canReject('quotations') && row.status === 'Pending' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {/* Reject logic */}}
            >
              Reject
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="All Quotations"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quotations' }]}
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter */}
            <div className="w-44">
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              />
            </div>
            {/* Service filter */}
            {serviceFilter && (
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-2">
                <span>Service: <strong>{serviceFilter}</strong></span>
                <button
                  onClick={() => setServiceFilter('')}
                  className="ml-1 text-blue-600 hover:text-blue-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}
            {/* Country filter */}
            {countryFilter && (
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm flex items-center gap-2">
                <span>Country: <strong>{countryFilter}</strong></span>
                <button
                  onClick={() => setCountryFilter('')}
                  className="ml-1 text-green-600 hover:text-green-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          {canAdd('quotations') && (
            <Link href="/quotations/new">
              <Button variant="primary">+ New Quotation</Button>
            </Link>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="card overflow-hidden">
          <DataTable
            columns={columns}
            data={quotations}
            loading={loading}
            emptyMessage="No quotations found"
            emptyDescription="Try adjusting your filters or create a new quotation."
            keyExtractor={(row: Quotation) => row._id}
            searchTerm={searchInput}
            onSearchTermChange={(value) => {
              setSearchInput(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search quotations..."
          />
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Quotation"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete quotation{' '}
          <span className="font-semibold text-gray-900">
            {deleteTarget?.quotationNo}
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteConfirm}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
