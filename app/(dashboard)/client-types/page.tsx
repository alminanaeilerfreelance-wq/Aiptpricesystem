'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import { clientTypesService, ClientType } from '@/services/client-types.service';

interface FormState {
  name: string;
  description: string;
  multiplier: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  multiplier: '1.00',
};

export default function ClientTypesPage() {
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClientTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientTypesService.list();
      setClientTypes(data.clientTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientTypes();
  }, [fetchClientTypes]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (clientType: ClientType) => {
    setEditTarget(clientType);
    setForm({
      name: clientType.name,
      description: clientType.description ?? '',
      multiplier: clientType.multiplier !== undefined ? String(clientType.multiplier) : '1.00',
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
    const multiplierVal = parseFloat(form.multiplier);
    if (isNaN(multiplierVal) || multiplierVal <= 0) {
      setFormError('Multiplier must be a positive number');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        multiplier: multiplierVal,
      };
      if (editTarget) {
        await clientTypesService.update(editTarget._id, payload);
      } else {
        await clientTypesService.create(payload);
      }
      closeModal();
      await fetchClientTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save client type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await clientTypesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchClientTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client type');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: ClientType) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: ClientType) => (
        <span className="text-gray-500 text-sm">{row.description ?? '—'}</span>
      ),
    },
    {
      key: 'multiplier',
      label: 'Multiplier',
      align: 'right' as const,
      render: (row: ClientType) => (
        <span className="font-medium text-gray-700 font-mono">
          {row.multiplier !== undefined ? `${row.multiplier.toFixed(2)}x` : '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: ClientType) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: ClientType) => (
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
        title="Client Types"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Client Types' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card padding="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-4 py-3 border-b border-border">
            <Button variant="primary" onClick={openAddModal}>
              + Add Client Type
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={clientTypes}
            loading={loading}
            emptyMessage="No client types found"
            emptyDescription="Add a client type to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Client Type' : 'Add Client Type'}
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
            placeholder="e.g. Corporate Client"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            placeholder="Optional description"
          />
          <Input
            label="Multiplier"
            type="number"
            min="0.01"
            step="0.01"
            value={form.multiplier}
            onChange={(e) => handleFormChange('multiplier', e.target.value)}
            placeholder="1.00"
            helperText="Applied as a fee multiplier (e.g. 1.20 = 20% premium)"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Client Type'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Client Type"
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
