'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import {
  classificationOfFeesService,
  ClassificationOfFee,
} from '@/services/classification-of-fees.service';

interface FormState {
  description: string;
  remarks: string;
}

const EMPTY_FORM: FormState = {
  description: '',
  remarks: '',
};

export default function ClassificationOfFeesPage() {
  const [items, setItems] = useState<ClassificationOfFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassificationOfFee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClassificationOfFee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await classificationOfFeesService.list();
      setItems(data.classificationOfFees);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classification of fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: ClassificationOfFee) => {
    setEditTarget(item);
    setForm({
      description: item.description,
      remarks: item.remarks,
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
    if (!form.description.trim()) {
      setFormError('Description is required');
      return;
    }
    if (!form.remarks.trim()) {
      setFormError('Remarks is required');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        description: form.description.trim(),
        remarks: form.remarks.trim(),
      };
      if (editTarget) {
        await classificationOfFeesService.update(editTarget._id, payload);
      } else {
        await classificationOfFeesService.create(payload);
      }
      closeModal();
      await fetchItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save classification of fee');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await classificationOfFeesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete classification of fee');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'description',
      label: 'Description',
      render: (row: ClassificationOfFee) => (
        <span className="font-medium text-gray-900">{row.description}</span>
      ),
    },
    {
      key: 'remarks',
      label: 'Remarks',
      render: (row: ClassificationOfFee) => (
        <span className="text-sm text-gray-700">{row.remarks}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: ClassificationOfFee) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: ClassificationOfFee) => (
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
        title="Classification of Fees"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Classification of Fees' }]}
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
              + Add Classification
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            emptyMessage="No classifications found"
            emptyDescription="Add a classification of fee to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Classification of Fee' : 'Add Classification of Fee'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            placeholder="e.g. Professional Fee"
          />
          <Input
            label="Remarks"
            value={form.remarks}
            onChange={(e) => handleFormChange('remarks', e.target.value)}
            placeholder="e.g. Government filing support"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Classification'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Classification of Fee"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.description}</span>?
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
