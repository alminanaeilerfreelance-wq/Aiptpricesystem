'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Select } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import { pricingRulesService, PricingRule, CreatePricingRuleDto } from '@/services/pricing-rules.service';
import { countriesService, Country } from '@/services/countries.service';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Trademark', label: 'Trademark' },
  { value: 'Patent', label: 'Patent' },
  { value: 'Copyright', label: 'Copyright' },
  { value: 'Design', label: 'Design' },
  { value: 'Litigation', label: 'Litigation' },
];

const CATEGORY_FORM_OPTIONS = CATEGORY_OPTIONS.slice(1);

interface FormState {
  category: string;
  procedure: string;
  countryName: string;
  countryCode: string;
  officialFee: string;
  attorneyFee: string;
  classFee: string;
}

const EMPTY_FORM: FormState = {
  category: 'Trademark',
  procedure: '',
  countryName: '',
  countryCode: '',
  officialFee: '0',
  attorneyFee: '0',
  classFee: '0',
};

function formatFee(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PricingRulesPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PricingRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { category?: string; country?: string } = {};
      if (categoryFilter) params.category = categoryFilter;
      if (countryFilter) params.country = countryFilter;

      const [rulesData, countriesData] = await Promise.all([
        pricingRulesService.list(params),
        countriesService.list(),
      ]);
      setRules(rulesData.pricingRules);
      setCountries(countriesData.countries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, countryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.map((c) => ({ value: c.name, label: c.name })),
  ];

  const openAddModal = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, category: categoryFilter || 'Trademark' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (rule: PricingRule) => {
    setEditTarget(rule);
    setForm({
      category: rule.serviceCategory,
      procedure: rule.procedureName ?? '',
      countryName: rule.countryName ?? '',
      countryCode: rule.countryAbbreviation ?? '',
      officialFee: String(rule.officialFee ?? 0),
      attorneyFee: String(rule.attorneyFee ?? 0),
      classFee: String(rule.classFee ?? 0),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.procedure.trim()) {
      setFormError('Procedure name is required');
      return;
    }
    if (!form.countryName.trim()) {
      setFormError('Country name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        serviceCategory: form.category as CreatePricingRuleDto['serviceCategory'],
        procedureName: form.procedure.trim(),
        countryName: form.countryName.trim(),
        countryAbbreviation: form.countryCode.trim().toUpperCase(),
        officialFee: parseFloat(form.officialFee) || 0,
        attorneyFee: parseFloat(form.attorneyFee) || 0,
        classFee: parseFloat(form.classFee) || 0,
      };
      if (editTarget) {
        await pricingRulesService.update(editTarget._id, payload);
      } else {
        await pricingRulesService.create(payload);
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await pricingRulesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pricing rule');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'serviceCategory',
      label: 'Service',
      render: (row: PricingRule) => (
        <span className="font-medium text-gray-900">{row.serviceCategory ?? '—'}</span>
      ),
    },
    {
      key: 'procedureName',
      label: 'Procedure',
      render: (row: PricingRule) => (
        <span className="text-gray-700">{row.procedureName ?? '—'}</span>
      ),
    },
    {
      key: 'countryName',
      label: 'Country',
      render: (row: PricingRule) => (
        <span className="text-gray-700">{row.countryName ?? '—'}</span>
      ),
    },
    {
      key: 'officialFee',
      label: 'Official Fee',
      align: 'right' as const,
      render: (row: PricingRule) => (
        <span className="font-mono text-sm">{formatFee(row.officialFee)}</span>
      ),
    },
    {
      key: 'attorneyFee',
      label: 'Attorney Fee',
      align: 'right' as const,
      render: (row: PricingRule) => (
        <span className="font-mono text-sm">{formatFee(row.attorneyFee)}</span>
      ),
    },
    {
      key: 'classFee',
      label: 'Class Fee',
      align: 'right' as const,
      render: (row: PricingRule) => (
        <span className="font-mono text-sm">{formatFee(row.classFee)}</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right' as const,
      render: (row: PricingRule) => {
        const total = (row.officialFee ?? 0) + (row.attorneyFee ?? 0);
        return (
          <span className="font-mono text-sm font-bold text-gray-900">{formatFee(total)}</span>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: PricingRule) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: PricingRule) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Pricing Rules"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Pricing Rules' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card padding="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-44">
                <Select
                  options={CATEGORY_OPTIONS}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                />
              </div>
              <div className="w-44">
                <Select
                  options={countryOptions}
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  aria-label="Filter by country"
                />
              </div>
            </div>
            <Button variant="primary" onClick={openAddModal}>
              + Add Pricing Rule
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={rules}
            loading={loading}
            emptyMessage="No pricing rules found"
            emptyDescription="Add a pricing rule to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Select
            label="Service Category"
            options={CATEGORY_FORM_OPTIONS}
            value={form.category}
            onChange={(e) => handleFormChange('category', e.target.value)}
          />
          <Input
            label="Procedure Name"
            value={form.procedure}
            onChange={(e) => handleFormChange('procedure', e.target.value)}
            placeholder="e.g. Initial Filing"
          />
          <Input
            label="Country Name"
            value={form.countryName}
            onChange={(e) => handleFormChange('countryName', e.target.value)}
            placeholder="e.g. Saudi Arabia"
          />
          <Input
            label="Country Abbreviation"
            value={form.countryCode}
            onChange={(e) => handleFormChange('countryCode', e.target.value)}
            placeholder="e.g. SA"
            maxLength={3}
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Official Fee"
              type="number"
              min="0"
              step="0.01"
              value={form.officialFee}
              onChange={(e) => handleFormChange('officialFee', e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Attorney Fee"
              type="number"
              min="0"
              step="0.01"
              value={form.attorneyFee}
              onChange={(e) => handleFormChange('attorneyFee', e.target.value)}
              placeholder="0.00"
            />
            <Input
              label="Class Fee"
              type="number"
              min="0"
              step="0.01"
              value={form.classFee}
              onChange={(e) => handleFormChange('classFee', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Rule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Pricing Rule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this pricing rule for{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.countryName ?? deleteTarget?.procedureName}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
