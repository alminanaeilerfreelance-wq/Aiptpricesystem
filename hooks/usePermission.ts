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
  const role = user?.role || 'user';

  return {
    /**
     * Check if user has permission for an action on a resource
     * @example: if (can('add', 'clients')) { ... }
     */
    can: (action: ResourceAction, resource: Resource) => {
      return hasPermission(role, resource, action);
    },

    /**
     * Quick checks for common actions
     * @example: if (canAdd('clients')) { ... }
     */
    canAdd: (resource: Resource) => permissionsCan.add(role, resource),
    canEdit: (resource: Resource) => permissionsCan.edit(role, resource),
    canUpdate: (resource: Resource) => permissionsCan.update(role, resource),
    canDelete: (resource: Resource) => permissionsCan.delete(role, resource),
    canAssign: (resource: Resource) => permissionsCan.assign(role, resource),
    canView: (resource: Resource) => permissionsCan.view(role, resource),
    canApprove: (resource: Resource) => permissionsCan.approve(role, resource),
    canReject: (resource: Resource) => permissionsCan.reject(role, resource),

    /**
     * Get all permissions for a resource
     */
    getPermissions: (resource: Resource) => getPermissions(role, resource),

    /**
     * Check if user can perform multiple actions
     */
    canAll: (resource: Resource, actions: ResourceAction[]) => canAll(role, resource, actions),

    /**
     * Check if user can perform any of the actions
     */
    canAny: (resource: Resource, actions: ResourceAction[]) => canAny(role, resource, actions),

    /**
     * Get current user role
     */
    role,
  };
}

export default usePermission;
