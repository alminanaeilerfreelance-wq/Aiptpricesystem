'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { Card } from '@/components/ui';
import { rolesService, Role } from '@/services/roles.service';

const AVAILABLE_PERMISSIONS = [
  { value: 'view_dashboard', label: 'View Dashboard' },
  { value: 'manage_users', label: 'Manage Users' },
  { value: 'manage_roles', label: 'Manage Roles' },
  { value: 'create_quotation', label: 'Create Quotation' },
  { value: 'view_quotation', label: 'View Quotation' },
  { value: 'edit_quotation', label: 'Edit Quotation' },
  { value: 'approve_quotation', label: 'Approve Quotation' },
  { value: 'delete_quotation', label: 'Delete Quotation' },
  { value: 'view_reports', label: 'View Reports' },
  { value: 'manage_clients', label: 'Manage Clients' },
  { value: 'manage_services', label: 'Manage Services' },
  { value: 'manage_settings', label: 'Manage Settings' },
  { value: 'manage_departments', label: 'Manage Departments' },
  { value: 'manage_countries', label: 'Manage Countries' },
  { value: 'manage_pricing', label: 'Manage Pricing' },
  { value: 'export_data', label: 'Export Data' },
];

interface FormState {
  name: string;
  description: string;
  permissions: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  permissions: [],
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rolesService.list();
      setRoles(data.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setEditTarget(role);
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
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

  const handleFormChange = (field: keyof FormState, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (permission: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Role name is required');
      return;
    }
    if (form.permissions.length === 0) {
      setFormError('At least one permission is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions,
      };
      if (editTarget) {
        await rolesService.update(editTarget._id, payload);
      } else {
        await rolesService.create(payload);
      }
      closeModal();
      await fetchRoles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rolesService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const getPermissionCount = (role: Role) => {
    return role.permissions.length;
  };

  const columns = [
    {
      key: 'name',
      label: 'Role Name',
      render: (row: Role) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: Role) => (
        <span className="text-gray-600 text-sm">{row.description || '—'}</span>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (row: Role) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          {getPermissionCount(row)} permission{getPermissionCount(row) !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Role) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)} disabled={['admin', 'manager', 'user'].includes(row.name.toLowerCase())}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Roles & Permissions"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]}
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
              + Add Role
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={roles}
            loading={loading}
            emptyMessage="No roles found"
            emptyDescription="Add a role to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit Role' : 'Add Role'}
        size="lg"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Input
            label="Role Name"
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="e.g., Content Manager, Reviewer"
            disabled={editTarget && ['admin', 'manager', 'user'].includes(editTarget.name.toLowerCase())}
          />
          <Input
            label="Description (Optional)"
            value={form.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
            placeholder="Describe what this role does"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions ({form.permissions.length} selected)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <label key={permission.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(permission.value)}
                    onChange={() => togglePermission(permission.value)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add Role'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Role"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the role <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?
          </p>
          <p className="text-xs text-gray-500">
            This action cannot be undone. Any users with this role will need to be reassigned.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleting}
            >
              Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
