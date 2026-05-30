#!/bin/bash
# RBAC Migration Script
# This script outlines the changes needed for each dashboard page

# Pattern to apply to ALL pages:
# 1. Add imports at the top:
#    import { usePermission } from '@/hooks/usePermission';
#    import { useAuth } from '@/hooks/useAuth';

# 2. In the component function, add:
#    const { user } = useAuth();
#    const { canAdd, canEdit, canDelete, canView } = usePermission();

# 3. Wrap all "Add" buttons with:
#    {canAdd('resource-name') && (
#      <Button>Add</Button>
#    )}

# 4. Wrap all "Edit" buttons in table actions with:
#    {canEdit('resource-name') && (
#      <Button>Edit</Button>
#    )}

# 5. Wrap all "Delete" buttons with:
#    {canDelete('resource-name') && (
#      <Button>Delete</Button>
#    )}

# Pages to update (in priority order):

echo "=== RBAC Migration Checklist ==="
echo ""
echo "✅ COMPLETED:"
echo "  - /app/(dashboard)/clients/page.tsx"
echo "  - /app/(dashboard)/quotations/page.tsx"
echo "  - /app/(dashboard)/services/page.tsx (partial)"
echo ""
echo "📋 TODO (Apply same pattern):"
echo "  - /app/(dashboard)/countries/page.tsx"
echo "  - /app/(dashboard)/procedures/page.tsx"
echo "  - /app/(dashboard)/departments/page.tsx"
echo "  - /app/(dashboard)/client-types/page.tsx"
echo "  - /app/(dashboard)/pricing-rules/page.tsx"
echo "  - /app/(dashboard)/company-details/page.tsx"
echo "  - /app/(dashboard)/own-offices/page.tsx"
echo "  - /app/(dashboard)/continents/page.tsx"
echo "  - /app/(dashboard)/associate-quotations/page.tsx"
echo "  - /app/(dashboard)/associte/page.tsx"
echo "  - /app/(dashboard)/client-quotations/page.tsx"
echo "  - /app/(dashboard)/inquires/page.tsx"
echo "  - /app/(dashboard)/requirements/page.tsx"
echo "  - /app/(dashboard)/classification-of-fees/page.tsx"
echo "  - /app/(dashboard)/settings/page.tsx"
echo "  - /app/(dashboard)/users/page.tsx"
echo "  - /app/(dashboard)/roles/page.tsx"
echo "  - /app/(dashboard)/reports/page.tsx"
echo "  - /app/(dashboard)/profit-loss-analysis/page.tsx"
echo "  - /app/(dashboard)/dashboard/page.tsx"
echo ""
echo "=== Template Pattern ==="
echo ""
echo "Import pattern:"
echo "  import { usePermission } from '@/hooks/usePermission';"
echo "  import { useAuth } from '@/hooks/useAuth';"
echo ""
echo "Hook usage:"
echo "  const { canAdd, canEdit, canDelete, canView } = usePermission();"
echo ""
echo "Button pattern:"
echo "  {canAdd('resource') && <AddButton />}"
echo "  {canEdit('resource') && <EditButton />}"
echo "  {canDelete('resource') && <DeleteButton />}"
echo ""
