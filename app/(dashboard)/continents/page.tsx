
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import { continentsService, Continent } from '@/services/continents.service';

interface FormState {
  continent: string;
}

const EMPTY_FORM: FormState = {
  continent: '',
};

export default function ContinentsPage() {
  const [continents, setContinents] = useState<Continent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Continent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Continent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchContinents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await continentsService.list();
      setContinents(data.continents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load continents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContinents();
  }, [fetchContinents]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (continent: Continent) => {
    setEditTarget(continent);
    setForm({
      continent: continent.continent,
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
    if (!form.continent.trim()) {
      setFormError('Continent is required');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        continent: form.continent.trim(),
      };
      if (editTarget) {
        await continentsService.update(editTarget._id, payload);
      } else {
        await continentsService.create(payload);
      }
      closeModal();
      await fetchContinents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save continent');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await continentsService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchContinents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete continent');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'continent',
      label: 'Continent',
      render: (row: Continent) => (
        <span className="font-medium text-gray-900">{row.continent}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: Continent) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Continent) => (
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
        title="Continents"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Continents' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card padding="p-0">
          <div className="flex items-center justify-end px-4 py-3 border-b border-border">
            <Button variant="primary" onClick={openAddModal}>
              + Add Continent
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={continents}
            loading={loading}
            emptyMessage="No continents found"
            emptyDescription="Add a continent to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Continent' : 'Add Continent'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Input
            label="Continent"
            value={form.continent}
            onChange={(e) => handleFormChange('continent', e.target.value)}
            placeholder="e.g. Asia"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Continent'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Continent"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.continent}</span>?
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
