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
import { servicesService, Service } from '@/services/services.service';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Trademark', label: 'Trademark' },
  { value: 'Patent', label: 'Patent' },
  { value: 'Copyright', label: 'Copyright' },
  { value: 'Design', label: 'Design' },
  { value: 'Litigation', label: 'Litigation' },
];

const CATEGORY_FORM_OPTIONS = CATEGORY_OPTIONS.slice(1);

const categoryColorMap: Record<string, string> = {
  Trademark: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700',
  Patent: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700',
  Copyright: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700',
  Design: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700',
  Litigation: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700',
};

interface FormState {
  name: string;
  category: string;
  description: string;
  basePrice: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'Trademark',
  description: '',
  basePrice: '',
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = categoryFilter ? { category: categoryFilter } : undefined;
      const data = await servicesService.list(params);
      setServices(data.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditTarget(service);
    setForm({
      name: service.name,
      category: service.category,
      description: service.description ?? '',
      basePrice: service.basePrice !== undefined ? String(service.basePrice) : '',
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
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!form.category) {
      setFormError('Category is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined,
      };
      if (editTarget) {
        await servicesService.update(editTarget._id, payload);
      } else {
        await servicesService.create(payload);
      }
      closeModal();
      await fetchServices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await servicesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: Service) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: Service) => (
        <span className={categoryColorMap[row.category] ?? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700'}>
          {row.category}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: Service) => (
        <span className="text-gray-500 text-sm truncate max-w-xs block">
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'basePrice',
      label: 'Base Price',
      align: 'right' as const,
      render: (row: Service) => (
        <span className="font-medium text-gray-700">
          {row.basePrice !== undefined && row.basePrice !== null
            ? row.basePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: Service) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Service) => (
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
        title="Services"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Services' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card padding="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border">
            <div className="w-48">
              <Select
                options={CATEGORY_OPTIONS}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              />
            </div>
            <Button variant="primary" onClick={openAddModal}>
              + Add Service
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={services}
            loading={loading}
            emptyMessage="No services found"
            emptyDescription="Add a service to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Service' : 'Add Service'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="e.g. Trademark Registration"
          />
          <Select
            label="Category"
            options={CATEGORY_FORM_OPTIONS}
            value={form.category}
            onChange={(e) => handleFormChange('category', e.target.value)}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            placeholder="Optional description"
          />
          <Input
            label="Base Price"
            type="number"
            min="0"
            step="0.01"
            value={form.basePrice}
            onChange={(e) => handleFormChange('basePrice', e.target.value)}
            placeholder="0.00"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Service'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Service"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?
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
