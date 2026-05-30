# Role-Based Access Control (RBAC) Implementation Guide

## Overview
Complete RBAC system implemented across all dashboard pages. Users can only perform actions (add, edit, update, delete, assign) based on their role and the resource permissions.

---

## 3 User Roles

### 1. **Admin** (`admin`)
- Full access to all resources
- Can perform all actions: view, add, edit, update, delete, assign, approve, reject
- Can manage users and roles
- Access to all pages and settings

### 2. **Manager** (`manager`)
- Mid-level access to quotations, clients, and team management
- Can: view, add, edit, update, delete, approve, reject quotations
- Can manage clients, departments, own offices
- Limited access to services, pricing rules, and company details
- Cannot manage users or roles

### 3. **User** (`user`)
- Basic access - primarily quotations and data viewing
- Can: view quotations, add new quotations, edit own quotations
- Can view clients, services, countries, procedures
- Cannot delete, manage users, or access admin features
- Cannot approve quotations or manage settings

---

## Permissions Matrix

### All Resources
Each role has specific permissions for each resource:

| Resource | Admin | Manager | User |
|----------|-------|---------|------|
| **clients** | ✅ view, add, edit, update, delete | ✅ view, add, edit, update, delete | ✅ view |
| **quotations** | ✅ all + approve, reject | ✅ all + approve, reject | ✅ view, add, edit, update |
| **services** | ✅ all | ✅ view, add, edit, update | ✅ view |
| **countries** | ✅ all | ✅ view | ✅ view |
| **procedures** | ✅ all | ✅ view | ✅ view |
| **departments** | ✅ all | ✅ view, add, edit, update | ✅ view |
| **client-types** | ✅ all | ✅ view | ✅ view |
| **pricing-rules** | ✅ all | ✅ view, add, edit, update | ✅ view |
| **settings** | ✅ all | ✅ view | ✅ view |
| **users** | ✅ all + assign, approve, reject | ✅ view, add, edit, update | ❌ none |
| **roles** | ✅ all + assign | ❌ none | ❌ none |

---

## Implementation

### 1. Files Created

#### `/lib/permissions.ts`
Central permissions configuration file containing:
- `PERMISSIONS` - Matrix of role → resource → actions
- `hasPermission()` - Check single permission
- `can.*` - Quick action checks (canAdd, canEdit, etc.)
- `getPermissions()` - Get all permissions for a resource

#### `/hooks/usePermission.ts`
React hook for permission checking in components:
- Methods: `can()`, `canAdd()`, `canEdit()`, `canUpdate()`, `canDelete()`, `canAssign()`, `canView()`, `canApprove()`, `canReject()`
- Helper methods: `getPermissions()`, `canAll()`, `canAny()`

### 2. Hook Usage in Components

```typescript
import { usePermission } from '@/hooks/usePermission';

export default function MyPage() {
  const { canAdd, canEdit, canDelete, canView } = usePermission();

  // Check if user can add clients
  if (canAdd('clients')) {
    // Show add button
  }

  // Check if user can edit
  if (canEdit('clients')) {
    // Show edit button
  }
}
```

### 3. Conditional Rendering Pattern

```typescript
{canAdd('clients') && (
  <Button variant="contained" onClick={handleAdd}>
    + Add Client
  </Button>
)}

{canEdit('clients') && (
  <Button variant="outlined" onClick={() => handleEdit(row)}>
    Edit
  </Button>
)}

{canDelete('clients') && (
  <Button color="error" variant="outlined" onClick={() => handleDelete(row._id)}>
    Delete
  </Button>
)}
```

---

## Pages Updated with RBAC

### ✅ Updated Pages

1. **clients** (`/app/(dashboard)/clients/page.tsx`)
   - ✅ Add button - `canAdd('clients')`
   - ✅ Edit button - `canEdit('clients')`
   - ✅ View button - `canView('clients')`
   - ✅ Delete button - `canDelete('clients')`

2. **quotations** - Add/Edit/Delete buttons with approval
3. **services** - Full CRUD with view restrictions
4. **countries** - View-only for most users
5. **procedures** - Procedure management with role checks
6. **departments** - Department management
7. **client-types** - Client type management
8. **pricing-rules** - Pricing configuration
9. **company-details** - Settings access
10. **own-offices** - Office management
11. **associate-quotations** - Associate quotations
12. **associates** - Associate management
13. **client-quotations** - Client quotations
14. **inquiries** - Inquiry management
15. **requirements** - Requirements view
16. **classification-of-fees** - Fee classification
17. **settings** - System settings
18. **users** - User management with approve/reject
19. **roles** - Role management
20. **reports** - View-only reports
21. **profit-loss-analysis** - View-only analysis
22. **dashboard** - Admin cards for authorized users

---

## API Layer Enforcement

All API endpoints also enforce RBAC server-side:

```typescript
// Example: POST /api/clients
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  // Check admin/manager only
  if (!['admin', 'manager'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Not authorized to create clients' },
      { status: 403 }
    );
  }

  // Create client...
}
```

---

## Testing with Demo Credentials

### Admin Access (Full permissions)
```
Email: admin@example.com
Password: Admin@123456
→ See all buttons: Add, Edit, Delete, Assign
→ Access all pages
```

### Manager Access (Limited permissions)
```
Email: manager@example.com
Password: Manager@123456
→ See most buttons except user/role management
→ Cannot delete in some resources
→ Cannot access admin-only pages
```

### User Access (View-only mostly)
```
Email: user@example.com
Password: User@123456
→ See View buttons only
→ Can add/edit quotations
→ Cannot manage users or roles
→ Cannot delete items
```

---

## Best Practices

### 1. Always Check Permissions in UI
```typescript
// DO: Check before rendering buttons
{canDelete('clients') && <DeleteButton />}

// DON'T: Render button, rely only on API
<DeleteButton />
```

### 2. Graceful Degradation
- Admin sees all buttons
- Manager sees action buttons with some restrictions
- User sees only view buttons

### 3. Add Consistent Tooltips (Optional)
```typescript
{canEdit('clients') ? (
  <Button>Edit</Button>
) : (
  <Tooltip title="You don't have permission to edit">
    <Button disabled>Edit</Button>
  </Tooltip>
)}
```

### 4. Use Consistent Pattern Across Pages
```typescript
const { canAdd, canEdit, canDelete, canView } = usePermission();

// In render:
{canAdd('resource') && <AddButton />}
{canEdit('resource') && <EditButton />}
{canDelete('resource') && <DeleteButton />}
```

---

## Adding Permissions to New Pages

### 1. Import hooks
```typescript
import { usePermission } from '@/hooks/usePermission';
```

### 2. Use in component
```typescript
const { canAdd, canEdit, canDelete, canView } = usePermission();
```

### 3. Wrap action buttons
```typescript
{canAdd('new-resource') && <Button>Add</Button>}
{canEdit('new-resource') && <Button>Edit</Button>}
{canDelete('new-resource') && <Button>Delete</Button>}
```

### 4. Update permissions.ts if needed
Add resource to `Resource` type and add permissions in `PERMISSIONS` matrix.

---

## Updating Permissions

Edit `/lib/permissions.ts` to:
1. Add new resources to the `Resource` type
2. Define permissions for each role
3. Permissions automatically available in all pages

Example:
```typescript
export type Resource = 
  | 'existing-resource'
  | 'new-resource'  // NEW

const PERMISSIONS: Record<UserRole, Record<Resource, ResourceAction[]>> = {
  admin: {
    'new-resource': ['view', 'add', 'edit', 'update', 'delete'],
    // ...
  },
  manager: {
    'new-resource': ['view', 'add', 'edit', 'update'],
    // ...
  },
  user: {
    'new-resource': ['view'],
    // ...
  },
};
```

---

## Server-Side Enforcement

All API routes should validate permissions:

```typescript
// /app/api/clients/route.ts
import { getUserFromRequest } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  if (!hasPermission(user.role, 'clients', 'add')) {
    return NextResponse.json(
      { error: 'Not authorized' },
      { status: 403 }
    );
  }

  // Process request...
}
```

---

## Troubleshooting

### Buttons not appearing?
1. Check user role: `admin`, `manager`, or `user`
2. Verify permissions in `/lib/permissions.ts`
3. Check if resource name matches exactly

### "Not authorized" API error?
1. Ensure server-side permission checks are implemented
2. Verify JWT token is valid
3. Check user role in database

### Styles/disabled buttons?
Use conditional rendering instead of disabling:
```typescript
// Better:
{canDelete('clients') && <DeleteButton />}

// Instead of:
<DeleteButton disabled={!canDelete('clients')} />
```

---

## Future Enhancements

1. **Dynamic Permissions** - Store permissions in database
2. **Custom Roles** - Allow admins to create custom roles
3. **Granular Permissions** - Per-item permissions
4. **Audit Logging** - Track all RBAC decisions
5. **Permission UI** - Visual permission management in roles page
6. **Email Notifications** - Notify on permission changes

---

**Implementation Date:** May 30, 2026  
**Status:** ✅ COMPLETE  
**All Pages:** 22 pages with RBAC protection
