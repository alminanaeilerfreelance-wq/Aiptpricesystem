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
import { usersService, User } from '@/services/users.service';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'user', label: 'User' },
];

const roleColorMap: Record<string, string> = {
  admin: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700',
  manager: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700',
  user: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700',
};

const approvalColorMap: Record<string, string> = {
  pending: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700',
  approved: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700',
  rejected: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700',
};

interface FormState {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'user',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewTarget, setViewTarget] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersService.list();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditTarget(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
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
    if (!form.email.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!editTarget && !form.password) {
      setFormError('Password is required for new users');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.password) {
        payload.password = form.password;
      }
      if (editTarget) {
        await usersService.update(editTarget._id, payload);
      } else {
        await usersService.create(payload);
      }
      closeModal();
      await fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await usersService.update(deactivateTarget._id, { isActive: !deactivateTarget.isActive });
      setDeactivateTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setDeactivating(false);
    }
  };

  const handleApprovalChange = async (target: User, approvalStatus: 'approved' | 'rejected') => {
    try {
      await usersService.update(target._id, { approvalStatus });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${approvalStatus} user`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deactivateTarget) return;
    setDeleting(true);
    try {
      await usersService.delete(deactivateTarget._id);
      setDeactivateTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: User) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (row: User) => (
        <span className="text-gray-600 text-sm">{row.email}</span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row: User) => (
        <span className={roleColorMap[row.role] ?? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700'}>
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (row: User) => <StatusBadge isActive={row.isActive} />,
    },
    {
      key: 'approvalStatus',
      label: 'Approval',
      render: (row: User) => {
        const status = row.approvalStatus || 'approved';
        return (
          <span className={approvalColorMap[status] ?? approvalColorMap.approved}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created At',
      render: (row: User) => (
        <span className="text-gray-500 text-sm">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: User) => (
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setViewTarget(row)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          {(row.approvalStatus || 'approved') === 'pending' && (
            <>
              <Button variant="primary" size="sm" onClick={() => handleApprovalChange(row, 'approved')}>
                Approve
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleApprovalChange(row, 'rejected')}>
                Reject
              </Button>
            </>
          )}
          <Button
            variant={row.isActive ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => setDeactivateTarget(row)}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeactivateTarget({...row, _id: row._id})} title="Delete user">
            Delete
          </Button>
        </div>
      ),
    },
  ];
  const pendingUsers = users.filter((user) => user.approvalStatus === 'pending');

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Users"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
      />

      <div className="flex-1 p-6 space-y-4 overflow-auto">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {pendingUsers.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {pendingUsers.length} user{pendingUsers.length > 1 ? 's' : ''} waiting for approval
                </p>
                <p className="text-xs text-amber-700">
                  Review new registrations and approve or reject access.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingUsers.slice(0, 3).map((pendingUser) => (
                  <span key={pendingUser._id} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-amber-800">
                    {pendingUser.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <Card padding="p-0">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-4 py-3 border-b border-border">
            <Button variant="primary" onClick={openAddModal}>
              + Add User
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={users}
            loading={loading}
            emptyMessage="No users found"
            emptyDescription="Add a user to get started."
            keyExtractor={(row) => row._id}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit User' : 'Add User'}
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
            placeholder="Full name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
            placeholder="email@example.com"
          />
          <Input
            label={editTarget ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => handleFormChange('password', e.target.value)}
            placeholder={editTarget ? 'Leave blank to keep current' : 'Enter password'}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => handleFormChange('role', e.target.value as 'admin' | 'manager' | 'user')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editTarget ? 'Save Changes' : 'Add User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View User Details Modal */}
      <Modal
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title="User Details"
        size="md"
      >
        {viewTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Name</label>
                <p className="mt-1 text-sm text-gray-900">{viewTarget.name}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Email</label>
                <p className="mt-1 text-sm text-gray-900">{viewTarget.email}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Role</label>
                <p className="mt-1">
                  <span className={roleColorMap[viewTarget.role] ?? roleColorMap.user}>
                    {viewTarget.role.charAt(0).toUpperCase() + viewTarget.role.slice(1)}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Status</label>
                <p className="mt-1">
                  <span className={viewTarget.isActive ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700' : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700'}>
                    {viewTarget.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Approval Status</label>
                <p className="mt-1">
                  <span className={approvalColorMap[viewTarget.approvalStatus || 'approved'] ?? approvalColorMap.approved}>
                    {(viewTarget.approvalStatus || 'approved').charAt(0).toUpperCase() + (viewTarget.approvalStatus || 'approved').slice(1)}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Created At</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(viewTarget.createdAt)}</p>
              </div>
            </div>

            {viewTarget.approvedAt && (
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Approval Information</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Approved By</label>
                    <p className="mt-1 text-sm text-gray-900">{viewTarget.approvedBy || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Approved At</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(viewTarget.approvedAt)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setViewTarget(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => {
                setViewTarget(null);
                openEditModal(viewTarget);
              }}>
                Edit User
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title={deactivateTarget?.isActive ? 'Deactivate User' : 'Delete User'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {deactivateTarget?.isActive ? (
              <>
                Are you sure you want to <span className="font-semibold">deactivate</span> <span className="font-semibold text-gray-900">{deactivateTarget?.name}</span>?
              </>
            ) : (
              <>
                Are you sure you want to <span className="font-semibold text-red-600">permanently delete</span> <span className="font-semibold text-gray-900">{deactivateTarget?.name}</span>?
              </>
            )}
          </p>
          {!deactivateTarget?.isActive && (
            <p className="text-xs text-red-600 font-medium">
              ⚠️ This action cannot be undone.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivating || deleting}>
              Cancel
            </Button>
            <Button
              variant={deactivateTarget?.isActive ? 'danger' : 'danger'}
              onClick={() => {
                if (deactivateTarget?.isActive) {
                  handleDeactivateConfirm();
                } else {
                  handleDeleteConfirm();
                }
              }}
              loading={deactivating || deleting}
            >
              {deactivateTarget?.isActive ? 'Deactivate' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
