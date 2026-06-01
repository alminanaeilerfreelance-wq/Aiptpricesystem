/**
 * Shared RBAC permission definitions.
 *
 * Roles now store modulePermissions, but we still understand the older flat
 * permission strings so existing seeded roles keep working after deployment.
 */

export type UserRole = 'admin' | 'manager' | 'user';

export type ResourceAction =
  | 'view'
  | 'add'
  | 'edit'
  | 'update'
  | 'delete'
  | 'assign'
  | 'approve'
  | 'reject'
  | 'export';

export type Resource =
  | 'dashboard'
  | 'clients'
  | 'quotations'
  | 'services'
  | 'countries'
  | 'procedures'
  | 'departments'
  | 'client-types'
  | 'pricing-rules'
  | 'company-details'
  | 'own-offices'
  | 'continents'
  | 'associate-quotations'
  | 'associates'
  | 'client-quotations'
  | 'inquiries'
  | 'requirements'
  | 'classification-of-fees'
  | 'settings'
  | 'users'
  | 'roles'
  | 'reports'
  | 'profit-loss-analysis';

export interface ModulePermission {
  module: Resource;
  actions: ResourceAction[];
}

export interface PermissionSubject {
  role?: string;
  permissions?: string[];
  modulePermissions?: ModulePermission[];
}

export const CRUD_ACTIONS: ResourceAction[] = ['view', 'add', 'edit', 'update', 'delete'];

export const MODULES: Array<{ key: Resource; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'client-quotations', label: 'Client Quotations' },
  { key: 'associate-quotations', label: 'Associate Quotations' },
  { key: 'inquiries', label: 'Inquires' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'pricing-rules', label: 'Pricing Rules' },
  { key: 'reports', label: 'Reports' },
  { key: 'profit-loss-analysis', label: 'Profit/Loss Analysis' },
  { key: 'clients', label: 'Clients' },
  { key: 'associates', label: 'Associates' },
  { key: 'own-offices', label: 'Own Offices' },
  { key: 'company-details', label: 'Company Details' },
  { key: 'departments', label: 'Departments' },
  { key: 'services', label: 'Services' },
  { key: 'countries', label: 'Countries' },
  { key: 'continents', label: 'Continents' },
  { key: 'classification-of-fees', label: 'Classification of Fees' },
  { key: 'client-types', label: 'Client Types' },
  { key: 'settings', label: 'Settings' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles & Permissions' },
];

const MODULE_KEYS = new Set<Resource>(MODULES.map((module) => module.key));
const ACTION_KEYS = new Set<ResourceAction>([
  ...CRUD_ACTIONS,
  'assign',
  'approve',
  'reject',
  'export',
]);

const OPERATIONAL_MODULES: Resource[] = [
  'dashboard',
  'quotations',
  'client-quotations',
  'associate-quotations',
  'inquiries',
  'procedures',
  'requirements',
  'pricing-rules',
  'reports',
  'profit-loss-analysis',
  'clients',
  'associates',
  'own-offices',
  'company-details',
  'departments',
  'services',
  'countries',
  'continents',
  'classification-of-fees',
  'client-types',
  'settings',
];

function modulePermission(module: Resource, actions: ResourceAction[]): ModulePermission {
  return { module, actions: Array.from(new Set(actions)) };
}

const ADMIN_MODULE_PERMISSIONS: ModulePermission[] = MODULES.map(({ key }) =>
  modulePermission(key, key === 'reports' || key === 'profit-loss-analysis'
    ? ['view']
    : CRUD_ACTIONS)
);

const MANAGER_MODULE_PERMISSIONS: ModulePermission[] = [
  ...OPERATIONAL_MODULES.map((key) =>
    modulePermission(key, key === 'reports' || key === 'profit-loss-analysis'
      ? ['view']
      : ['view', 'add', 'edit', 'update'])
  ),
  modulePermission('users', ['view']),
  modulePermission('roles', ['view']),
];

const USER_MODULE_PERMISSIONS: ModulePermission[] = [
  modulePermission('dashboard', ['view']),
  modulePermission('quotations', ['view', 'add', 'edit', 'update']),
  modulePermission('client-quotations', ['view', 'add']),
  modulePermission('associate-quotations', ['view']),
  modulePermission('clients', ['view']),
  modulePermission('associates', ['view']),
  modulePermission('inquiries', ['view']),
  modulePermission('procedures', ['view']),
  modulePermission('requirements', ['view']),
  modulePermission('pricing-rules', ['view']),
  modulePermission('services', ['view']),
  modulePermission('countries', ['view']),
  modulePermission('continents', ['view']),
  modulePermission('client-types', ['view']),
  modulePermission('company-details', ['view']),
  modulePermission('settings', ['view']),
  modulePermission('reports', ['view']),
  modulePermission('profit-loss-analysis', ['view']),
];

export const DEFAULT_MODULE_PERMISSIONS: Record<UserRole, ModulePermission[]> = {
  admin: ADMIN_MODULE_PERMISSIONS,
  manager: MANAGER_MODULE_PERMISSIONS,
  user: USER_MODULE_PERMISSIONS,
};

const LEGACY_PERMISSION_MAP: Record<string, ModulePermission[]> = {
  view_dashboard: [modulePermission('dashboard', ['view'])],
  manage_users: [modulePermission('users', ['view', 'add', 'edit', 'update', 'delete', 'assign', 'approve', 'reject'])],
  manage_roles: [modulePermission('roles', ['view', 'add', 'edit', 'update', 'delete', 'assign'])],
  create_quotation: [modulePermission('quotations', ['add'])],
  view_quotation: [modulePermission('quotations', ['view'])],
  edit_quotation: [modulePermission('quotations', ['edit', 'update'])],
  approve_quotation: [modulePermission('quotations', ['approve', 'reject', 'update'])],
  delete_quotation: [modulePermission('quotations', ['delete'])],
  view_reports: [modulePermission('reports', ['view', 'export']), modulePermission('profit-loss-analysis', ['view', 'export'])],
  manage_clients: [modulePermission('clients', ['view', 'add', 'edit', 'update', 'delete'])],
  manage_services: [modulePermission('services', ['view', 'add', 'edit', 'update', 'delete'])],
  manage_settings: [modulePermission('settings', ['view', 'edit', 'update'])],
  manage_departments: [modulePermission('departments', ['view', 'add', 'edit', 'update', 'delete'])],
  manage_countries: [modulePermission('countries', ['view', 'add', 'edit', 'update', 'delete']), modulePermission('continents', ['view', 'add', 'edit', 'update', 'delete'])],
  manage_pricing: [modulePermission('pricing-rules', ['view', 'add', 'edit', 'update', 'delete'])],
  export_data: [modulePermission('reports', ['export']), modulePermission('profit-loss-analysis', ['export'])],
};

function isResource(value: string): value is Resource {
  return MODULE_KEYS.has(value as Resource);
}

function isAction(value: string): value is ResourceAction {
  return ACTION_KEYS.has(value as ResourceAction);
}

export function permissionKey(module: Resource, action: ResourceAction): string {
  return `${module}:${action}`;
}

export function flattenModulePermissions(modulePermissions: ModulePermission[]): string[] {
  return modulePermissions.flatMap(({ module, actions }) =>
    actions.map((action) => permissionKey(module, action))
  );
}

export function normalizeModulePermissions(
  modulePermissions?: ModulePermission[] | null,
  legacyPermissions?: string[] | null,
  role?: string | null
): ModulePermission[] {
  const merged = new Map<Resource, Set<ResourceAction>>();
  const hasSavedModulePermissions = Boolean(modulePermissions?.length);

  const add = (module: string, actions: string[]) => {
    if (!isResource(module)) return;
    const current = merged.get(module) || new Set<ResourceAction>();
    actions.forEach((action) => {
      if (isAction(action)) current.add(action);
    });
    merged.set(module, current);
  };

  if (!hasSavedModulePermissions && role && isKnownRole(role)) {
    DEFAULT_MODULE_PERMISSIONS[role].forEach((item) => add(item.module, item.actions));
  }

  modulePermissions?.forEach((item) => add(item.module, item.actions || []));

  legacyPermissions?.forEach((permission) => {
    if (permission.includes(':')) {
      const [module, action] = permission.split(':');
      add(module, [action]);
      return;
    }

    LEGACY_PERMISSION_MAP[permission]?.forEach((item) => add(item.module, item.actions));
  });

  return MODULES.map(({ key }) => {
    const actions = merged.get(key);
    return actions ? modulePermission(key, Array.from(actions)) : null;
  }).filter((item): item is ModulePermission => Boolean(item));
}

export function isKnownRole(role: string): role is UserRole {
  return role === 'admin' || role === 'manager' || role === 'user';
}

export function getSubjectModulePermissions(subject: PermissionSubject): ModulePermission[] {
  return normalizeModulePermissions(
    subject.modulePermissions,
    subject.permissions,
    subject.role
  );
}

export function hasPermission(
  subjectOrRole: PermissionSubject | string,
  resource: Resource,
  action: ResourceAction
): boolean {
  const subject =
    typeof subjectOrRole === 'string' ? { role: subjectOrRole } : subjectOrRole;

  const modulePermissions = getSubjectModulePermissions(subject);
  const match = modulePermissions.find((item) => item.module === resource);
  if (!match) return false;

  if (match.actions.includes(action)) return true;
  if (action === 'edit') return match.actions.includes('update');
  if (action === 'update') return match.actions.includes('edit');
  if (action === 'approve' || action === 'reject') return match.actions.includes('update');

  return false;
}

export const can = {
  add: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'add'),
  edit: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'edit'),
  update: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'update'),
  delete: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'delete'),
  assign: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'assign'),
  view: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'view'),
  approve: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'approve'),
  reject: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'reject'),
  export: (subject: PermissionSubject | string, resource: Resource) => hasPermission(subject, resource, 'export'),
};

export function getPermissions(
  subjectOrRole: PermissionSubject | string,
  resource: Resource
): ResourceAction[] {
  const subject =
    typeof subjectOrRole === 'string' ? { role: subjectOrRole } : subjectOrRole;
  return getSubjectModulePermissions(subject).find((item) => item.module === resource)?.actions || [];
}

export function canAll(
  subject: PermissionSubject | string,
  resource: Resource,
  actions: ResourceAction[]
): boolean {
  return actions.every((action) => hasPermission(subject, resource, action));
}

export function canAny(
  subject: PermissionSubject | string,
  resource: Resource,
  actions: ResourceAction[]
): boolean {
  return actions.some((action) => hasPermission(subject, resource, action));
}

export function permissionsFromKeys(keys?: string[] | null): ModulePermission[] {
  return normalizeModulePermissions(undefined, keys || []);
}
