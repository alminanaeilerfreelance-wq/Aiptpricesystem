'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import { DataTable } from '@/components/tables';
import { TablePagination } from '@/components/tables';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Modal } from '@/components/ui';
import { departmentsService, Department } from '@/services/departments.service';
import { useDebounce } from '@/hooks/useDebounce';

const PAGE_SIZE = 10;

interface DepartmentForm {
  name: string;
  country: string;
  description: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<DepartmentForm>({
    name: '',
    country: '',
    description: '',
  });

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await departmentsService.list(params);
      setDepartments(data.departments);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetForm = () => {
    setFormData({
      name: '',
      country: '',
      description: '',
    });
  };

  const handleCreateClick = () => {
    resetForm();
    setEditingDepartment(null);
    setShowCreateModal(true);
  };

  const handleEditClick = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      country: department.country || '',
      description: department.description || '',
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Department name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingDepartment) {
        await departmentsService.update(editingDepartment._id, formData);
        setShowEditModal(false);
      } else {
        await departmentsService.create(formData);
        setShowCreateModal(false);
      }
      setError(null);
      resetForm();
      await fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await departmentsService.delete(deleteTarget._id);
      setDeleteTarget(null);
      await fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Department Name', 'Country', 'Description', 'Created'];
    const rows = departments.map(dept => [
      dept._id,
      dept.name,
      dept.country || '',
      dept.description || '',
      new Date(dept.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          const dept = headers.reduce((obj, header, idx) => {
            obj[header] = values[idx] || '';
            return obj;
          }, {} as Record<string, string>);

          if (dept.name) {
            await departmentsService.create({
              name: dept.name,
              country: dept.country,
              description: dept.description,
            });
          }
        }
        await fetchDepartments();
        setError(null);
      } catch (err) {
        setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  const columns = [
    {
      key: '_id',
      label: 'ID',
      render: (row: Department) => <span className="text-xs text-gray-500">{row._id.slice(-8)}</span>,
    },
    { key: 'name', label: 'Department Name' },
    { key: 'country', label: 'Country' },
    { key: 'description', label: 'Description' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row: Department) =>
        new Date(row.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Department) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleEditClick(row)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar title="Departments" />
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Input
            type="text"
            placeholder="Search departments by name or country..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleCreateClick}>
              + New Department
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={departments.length === 0}>
              Export CSV
            </Button>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <span className="inline-block cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Import CSV
              </span>
            </label>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading departments...</div>
          </div>
        )}

        {/* Data Table */}
        {!loading && departments.length > 0 && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <DataTable columns={columns} data={departments} />
            </div>
            <div className="mt-4">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && departments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No departments found</p>
            <Button variant="primary" onClick={handleCreateClick}>
              Create First Department
            </Button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create New Department"
      >
        <div className="space-y-4">
          <Input
            label="Department Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter department name"
          />
          <Input
            label="Country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder="Country"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Department description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Create Department'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Department: ${editingDepartment?.name}`}
      >
        <div className="space-y-4">
          <Input
            label="Department Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter department name"
          />
          <Input
            label="Country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder="Country"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Department description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Update Department'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Department"
      >
        <div>
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Department'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
