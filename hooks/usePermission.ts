'use client';

import { useAuth } from './useAuth';
import {
  hasPermission,
  can as permissionsCan,
  getPermissions,
  canAll,
  canAny,
  type Resource,
  type ResourceAction,
} from '@/lib/permissions';

/**
 * Hook for role-based access control
 * Provides permission checking utilities based on user role
 */
export function usePermission() {
  const { user } = useAuth();
  const subject = user || { role: 'user' };
  const role = user?.role || 'user';

  return {
    /**
     * Check if user has permission for an action on a resource
     * @example: if (can('add', 'clients')) { ... }
     */
    can: (action: ResourceAction, resource: Resource) => {
      return hasPermission(subject, resource, action);
    },

    /**
     * Quick checks for common actions
     * @example: if (canAdd('clients')) { ... }
     */
    canAdd: (resource: Resource) => permissionsCan.add(subject, resource),
    canEdit: (resource: Resource) => permissionsCan.edit(subject, resource),
    canUpdate: (resource: Resource) => permissionsCan.update(subject, resource),
    canDelete: (resource: Resource) => permissionsCan.delete(subject, resource),
    canAssign: (resource: Resource) => permissionsCan.assign(subject, resource),
    canView: (resource: Resource) => permissionsCan.view(subject, resource),
    canApprove: (resource: Resource) => permissionsCan.approve(subject, resource),
    canReject: (resource: Resource) => permissionsCan.reject(subject, resource),
    canExport: (resource: Resource) => permissionsCan.export(subject, resource),

    /**
     * Get all permissions for a resource
     */
    getPermissions: (resource: Resource) => getPermissions(subject, resource),

    /**
     * Check if user can perform multiple actions
     */
    canAll: (resource: Resource, actions: ResourceAction[]) => canAll(subject, resource, actions),

    /**
     * Check if user can perform any of the actions
     */
    canAny: (resource: Resource, actions: ResourceAction[]) => canAny(subject, resource, actions),

    /**
     * Get current user role
     */
    role,
  };
}

export default usePermission;
