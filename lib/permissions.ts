/**
 * Role-Based Access Control (RBAC) Permissions
 * Defines what actions each role can perform on each resource
 */

export type UserRole = 'admin' | 'manager' | 'user';

export type ResourceAction = 'add' | 'edit' | 'update' | 'delete' | 'assign' | 'view' | 'approve' | 'reject';

export type Resource = 
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

// Permissions matrix: role -> resource -> actions
const PERMISSIONS: Record<UserRole, Record<Resource, ResourceAction[]>> = {
  admin: {
    clients: ['view', 'add', 'edit', 'update', 'delete', 'assign'],
    quotations: ['view', 'add', 'edit', 'update', 'delete', 'approve', 'reject'],
    services: ['view', 'add', 'edit', 'update', 'delete'],
    countries: ['view', 'add', 'edit', 'update', 'delete'],
    procedures: ['view', 'add', 'edit', 'update', 'delete'],
    departments: ['view', 'add', 'edit', 'update', 'delete'],
    'client-types': ['view', 'add', 'edit', 'update', 'delete'],
    'pricing-rules': ['view', 'add', 'edit', 'update', 'delete'],
    'company-details': ['view', 'add', 'edit', 'update', 'delete'],
    'own-offices': ['view', 'add', 'edit', 'update', 'delete'],
    continents: ['view', 'add', 'edit', 'update', 'delete'],
    'associate-quotations': ['view', 'add', 'edit', 'update', 'delete'],
    associates: ['view', 'add', 'edit', 'update', 'delete', 'assign'],
    'client-quotations': ['view', 'add', 'edit', 'update', 'delete'],
    inquiries: ['view', 'add', 'edit', 'update', 'delete'],
    requirements: ['view', 'add', 'edit', 'update', 'delete'],
    'classification-of-fees': ['view', 'add', 'edit', 'update', 'delete'],
    settings: ['view', 'add', 'edit', 'update', 'delete'],
    users: ['view', 'add', 'edit', 'update', 'delete', 'approve', 'reject', 'assign'],
    roles: ['view', 'add', 'edit', 'update', 'delete', 'assign'],
    reports: ['view'],
    'profit-loss-analysis': ['view'],
  },

  manager: {
    clients: ['view', 'add', 'edit', 'update', 'delete'],
    quotations: ['view', 'add', 'edit', 'update', 'delete', 'approve', 'reject'],
    services: ['view', 'add', 'edit', 'update'],
    countries: ['view'],
    procedures: ['view'],
    departments: ['view', 'add', 'edit', 'update'],
    'client-types': ['view'],
    'pricing-rules': ['view', 'add', 'edit', 'update'],
    'company-details': ['view', 'edit', 'update'],
    'own-offices': ['view', 'add', 'edit', 'update'],
    continents: ['view'],
    'associate-quotations': ['view', 'add', 'edit', 'update'],
    associates: ['view', 'add', 'edit', 'update'],
    'client-quotations': ['view', 'add', 'edit', 'update'],
    inquiries: ['view', 'add', 'edit', 'update'],
    requirements: ['view'],
    'classification-of-fees': ['view'],
    settings: ['view'],
    users: ['view', 'add', 'edit', 'update'],
    roles: ['view'],
    reports: ['view'],
    'profit-loss-analysis': ['view'],
  },

  user: {
    clients: ['view'],
    quotations: ['view', 'add', 'edit', 'update'],
    services: ['view'],
    countries: ['view'],
    procedures: ['view'],
    departments: ['view'],
    'client-types': ['view'],
    'pricing-rules': ['view'],
    'company-details': ['view'],
    'own-offices': ['view'],
    continents: ['view'],
    'associate-quotations': ['view'],
    associates: ['view'],
    'client-quotations': ['view'],
    inquiries: ['view'],
    requirements: ['view'],
    'classification-of-fees': ['view'],
    settings: ['view'],
    users: [],
    roles: [],
    reports: ['view'],
    'profit-loss-analysis': ['view'],
  },
};

/**
 * Check if a user has permission to perform an action on a resource
 * @param role - User role (admin, manager, user)
 * @param resource - Resource name
 * @param action - Action to perform (add, edit, update, delete, assign, view, etc.)
 * @returns boolean - True if user has permission
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: ResourceAction
): boolean {
  if (!PERMISSIONS[role]) return false;
  if (!PERMISSIONS[role][resource]) return false;
  return PERMISSIONS[role][resource].includes(action);
}

/**
 * Check if a user can perform an action (shorthand for common actions)
 */
export const can = {
  add: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'add'),
  edit: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'edit'),
  update: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'update'),
  delete: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'delete'),
  assign: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'assign'),
  view: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'view'),
  approve: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'approve'),
  reject: (role: UserRole, resource: Resource) => hasPermission(role, resource, 'reject'),
};

/**
 * Get all actions a role can perform on a resource
 */
export function getPermissions(role: UserRole, resource: Resource): ResourceAction[] {
  if (!PERMISSIONS[role] || !PERMISSIONS[role][resource]) {
    return [];
  }
  return PERMISSIONS[role][resource];
}

/**
 * Check if user can perform multiple actions
 */
export function canAll(role: UserRole, resource: Resource, actions: ResourceAction[]): boolean {
  return actions.every(action => hasPermission(role, resource, action));
}

/**
 * Check if user can perform any of the actions
 */
export function canAny(role: UserRole, resource: Resource, actions: ResourceAction[]): boolean {
  return actions.some(action => hasPermission(role, resource, action));
}
