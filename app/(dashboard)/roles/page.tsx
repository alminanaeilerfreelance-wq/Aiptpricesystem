'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Pagination,
  Stack,
  SvgIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import { showErrorToast, showSuccessToast } from '@/components/feedback/heroToast';
import { useDebounce } from '@/hooks/useDebounce';
import { rolesService, Role } from '@/services/roles.service';
import {
  CRUD_ACTIONS,
  MODULES,
  flattenModulePermissions,
  normalizeModulePermissions,
  type ModulePermission,
  type Resource,
  type ResourceAction,
} from '@/lib/permissions';

interface FormState {
  name: string;
  description: string;
  modulePermissions: ModulePermission[];
}

const PAGE_SIZE = 10;

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  modulePermissions: [],
};

const ACTION_LABELS: Record<ResourceAction, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  update: 'Update',
  delete: 'Delete',
  assign: 'Assign',
  approve: 'Approve',
  reject: 'Reject',
  export: 'Export',
};

const AddIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
  </SvgIcon>
);

const EditIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M3 17.25V21h3.75l11-11l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z" />
  </SvgIcon>
);

const DeleteIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4zm-1 6h2v9H8zm4 0h2v9h-2zm4 0h2v9h-2zM6 8h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
  </SvgIcon>
);

function getActions(modulePermissions: ModulePermission[], module: Resource): ResourceAction[] {
  return modulePermissions.find((item) => item.module === module)?.actions || [];
}

function setModuleActions(
  modulePermissions: ModulePermission[],
  module: Resource,
  actions: ResourceAction[]
): ModulePermission[] {
  const cleanActions = Array.from(new Set(actions));
  const withoutModule = modulePermissions.filter((item) => item.module !== module);
  if (cleanActions.length === 0) return withoutModule;
  return [...withoutModule, { module, actions: cleanActions }];
}

function getApiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const apiError = err as { response?: { data?: { error?: string } }; message?: string };
    return apiError.response?.data?.error || apiError.message || fallback;
  }
  return fallback;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedPermissionCount = useMemo(
    () => flattenModulePermissions(form.modulePermissions).length,
    [form.modulePermissions]
  );

  const allPermissionsSelected = useMemo(
    () =>
      MODULES.every(({ key }) =>
        CRUD_ACTIONS.every((action) => getActions(form.modulePermissions, key).includes(action))
      ),
    [form.modulePermissions]
  );

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rolesService.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setRoles(data.roles);
      setTotal(data.total);
    } catch (err) {
      const message = getApiError(err, 'Failed to load roles');
      setError(message);
      showErrorToast(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
      modulePermissions: normalizeModulePermissions(
        role.modulePermissions,
        role.permissions,
        role.name
      ),
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

  const toggleAction = (module: Resource, action: ResourceAction) => {
    setForm((prev) => {
      const actions = getActions(prev.modulePermissions, module);
      const nextActions = actions.includes(action)
        ? actions.filter((item) => item !== action)
        : [...actions, action];
      return {
        ...prev,
        modulePermissions: setModuleActions(prev.modulePermissions, module, nextActions),
      };
    });
  };

  const toggleModule = (module: Resource, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      modulePermissions: setModuleActions(
        prev.modulePermissions,
        module,
        checked ? CRUD_ACTIONS : []
      ),
    }));
  };

  const toggleAll = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      modulePermissions: checked
        ? MODULES.map(({ key }) => ({ module: key, actions: CRUD_ACTIONS }))
        : [],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Role name is required');
      return;
    }
    if (selectedPermissionCount === 0) {
      setFormError('Select at least one permission');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        modulePermissions: form.modulePermissions,
      };

      if (editTarget) {
        await rolesService.update(editTarget._id, payload);
        showSuccessToast('Role permissions updated');
      } else {
        await rolesService.create(payload);
        showSuccessToast('Role created');
      }

      closeModal();
      await fetchRoles();
    } catch (err) {
      const message = getApiError(err, 'Failed to save role');
      setFormError(message);
      showErrorToast(message);
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
      showSuccessToast('Role deleted');
      await fetchRoles();
    } catch (err) {
      const message = getApiError(err, 'Failed to delete role');
      setError(message);
      showErrorToast(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar
        title="Roles & Permissions"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]}
      />

      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        <Card sx={{ borderRadius: 2, boxShadow: 'none', border: '1px solid #E5E7EB' }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                mb: 2,
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <TextField
                size="small"
                label="Search roles"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ width: { xs: '100%', sm: 320 } }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAddModal}>
                Add Role
              </Button>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Permissions</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">No roles found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((role) => {
                      const normalized = normalizeModulePermissions(
                        role.modulePermissions,
                        role.permissions,
                        role.name
                      );
                      const permissionCount = flattenModulePermissions(normalized).length;

                      return (
                        <TableRow key={role._id} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>{role.name}</Typography>
                          </TableCell>
                          <TableCell>{role.description || '-'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={`${permissionCount} permissions`} />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit permissions">
                              <IconButton onClick={() => openEditModal(role)} size="small">
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete role">
                              <span>
                                <IconButton
                                  onClick={() => setDeleteTarget(role)}
                                  size="small"
                                  color="error"
                                  disabled={['admin', 'manager', 'user'].includes(
                                    role.name.toLowerCase()
                                  )}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}>
              <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} />
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={modalOpen} onClose={closeModal} fullWidth maxWidth="lg">
        <DialogTitle>{editTarget ? 'Edit Role Permissions' : 'Add Role'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.45fr) 1fr' },
                gap: 2,
              }}
            >
              <Box>
                <TextField
                  fullWidth
                  label="Role name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={
                    editTarget
                      ? ['admin', 'manager', 'user'].includes(editTarget.name.toLowerCase())
                      : false
                  }
                />
              </Box>
              <Box>
                <TextField
                  fullWidth
                  label="Description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </Box>
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allPermissionsSelected}
                    indeterminate={!allPermissionsSelected && selectedPermissionCount > 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                }
                label="Select All Permissions"
              />
              <Chip size="small" color="primary" label={`${selectedPermissionCount} selected`} />
            </Stack>

            <TableContainer sx={{ border: '1px solid #E5E7EB', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>Page / Module</TableCell>
                    <TableCell align="center">Select All</TableCell>
                    {CRUD_ACTIONS.map((action) => (
                      <TableCell key={action} align="center">
                        {ACTION_LABELS[action]}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MODULES.map((module) => {
                    const actions = getActions(form.modulePermissions, module.key);
                    const moduleChecked = CRUD_ACTIONS.every((action) => actions.includes(action));
                    const moduleIndeterminate =
                      !moduleChecked && CRUD_ACTIONS.some((action) => actions.includes(action));

                    return (
                      <TableRow key={module.key} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600 }}>{module.label}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={moduleChecked}
                            indeterminate={moduleIndeterminate}
                            onChange={(event) => toggleModule(module.key, event.target.checked)}
                          />
                        </TableCell>
                        {CRUD_ACTIONS.map((action) => (
                          <TableCell key={action} align="center">
                            <Checkbox
                              checked={actions.includes(action)}
                              onChange={() => toggleAction(module.key, action)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
