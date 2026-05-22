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
import { proceduresService, Procedure, CreateProcedureDto } from '@/services/procedures.service';

const CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

const CATEGORY_TABS = [{ value: '', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))];

const CATEGORY_SELECT_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));

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
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'Trademark',
  description: '',
  sortOrder: '0',
};

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Procedure | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Procedure | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = categoryFilter ? { category: categoryFilter } : undefined;
      const data = await proceduresService.list(params);
      setProcedures(data.procedures);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load procedures');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, category: categoryFilter || 'Trademark' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (procedure: Procedure) => {
    setEditTarget(procedure);
    setForm({
      name: procedure.name,
      category: procedure.serviceCategory,
      description: procedure.description ?? '',
      sortOrder: String(procedure.sortOrder ?? 0),
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
        serviceCategory: form.category as CreateProcedureDto['serviceCategory'],
        description: form.description.trim() || undefined,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      };
      if (editTarget) {
        await proceduresService.update(editTarget._id, payload);
      } else {
        await proceduresService.create(payload);
      }
      closeModal();
      await fetchProcedures();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save procedure');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await proceduresService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchProcedures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete procedure');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: Procedure) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'serviceCategory',
      label: 'Service Category',
      render: (row: Procedure) => (
        <span className={categoryColorMap[row.serviceCategory] ?? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700'}>
          {row.serviceCategory}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: Procedure) => (
        <span className="text-gray-500 text-sm">{row.description ?? '—'}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: Procedure) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'sortOrder',
      label: 'Sort Order',
      align: 'right' as const,
      render: (row: Procedure) => (
        <span className="text-gray-600">{row.sortOrder ?? 0}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Procedure) => (
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
        title="Procedures"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Procedures' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card padding="p-0">
          {/* Toolbar with category filter tabs */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setCategoryFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoryFilter === tab.value
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={openAddModal}>
              + Add Procedure
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={procedures}
            loading={loading}
            emptyMessage="No procedures found"
            emptyDescription="Add a procedure to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Procedure' : 'Add Procedure'}
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
            placeholder="e.g. Initial Filing"
          />
          <Select
            label="Service Category"
            options={CATEGORY_SELECT_OPTIONS}
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
            label="Sort Order"
            type="number"
            min="0"
            step="1"
            value={form.sortOrder}
            onChange={(e) => handleFormChange('sortOrder', e.target.value)}
            placeholder="0"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Procedure'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Procedure"
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
