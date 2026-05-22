'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { StatusBadge } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import { countriesService, Country } from '@/services/countries.service';

interface FormState {
  name: string;
  abbreviation: string;
  flagCode: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  abbreviation: '',
  flagCode: '',
};

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Country | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCountries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await countriesService.list();
      setCountries(data.countries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (country: Country) => {
    setEditTarget(country);
    setForm({
      name: country.name,
      abbreviation: country.abbreviation,
      flagCode: country.flagCode,
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
      setFormError('Country name is required');
      return;
    }
    if (!form.abbreviation.trim()) {
      setFormError('Abbreviation is required');
      return;
    }
    if (!form.flagCode.trim()) {
      setFormError('Flag code is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim().toUpperCase(),
        flagCode: form.flagCode.trim().toLowerCase(),
      };
      if (editTarget) {
        await countriesService.update(editTarget._id, payload);
      } else {
        await countriesService.create(payload);
      }
      closeModal();
      await fetchCountries();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save country');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await countriesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchCountries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete country');
    } finally {
      setDeleting(false);
    }
  };

  const getFlagCode = (country: Country): string => {
    return country.flagCode;
  };

  const columns = [
    {
      key: 'flag',
      label: 'Flag',
      render: (row: Country) => {
        const flagCode = getFlagCode(row);
        return (
          <img
            src={`https://flagcdn.com/24x18/${flagCode}.png`}
            alt={row.name}
            className="rounded-sm"
            width={24}
            height={18}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        );
      },
    },
    {
      key: 'name',
      label: 'Country Name',
      render: (row: Country) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'abbreviation',
      label: 'Abbreviation',
      render: (row: Country) => (
        <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {row.abbreviation}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: Country) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Country) => (
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
        title="Countries"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Countries' }]}
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
              + Add Country
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={countries}
            loading={loading}
            emptyMessage="No countries found"
            emptyDescription="Add a country to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Country' : 'Add Country'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Input
            label="Country Name"
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="e.g. Saudi Arabia"
          />
          <Input
            label="Abbreviation (2-3 letter code)"
            value={form.abbreviation}
            onChange={(e) => handleFormChange('abbreviation', e.target.value)}
            placeholder="e.g. SA"
            maxLength={3}
          />
          <Input
            label="Flag Code (ISO 2-letter, lowercase)"
            value={form.flagCode}
            onChange={(e) => handleFormChange('flagCode', e.target.value)}
            placeholder="e.g. sa"
            maxLength={2}
            helperText="Used for flag image (e.g. 'sa' for Saudi Arabia)"
          />
          {form.flagCode && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Preview:</span>
              <img
                src={`https://flagcdn.com/24x18/${form.flagCode.toLowerCase()}.png`}
                alt="Flag preview"
                className="rounded-sm"
                width={24}
                height={18}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Country'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Country"
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
