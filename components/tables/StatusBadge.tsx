import React from 'react';

export type QuotationStatus = 'Approved' | 'Pending' | 'Draft' | 'Rejected';

export interface StatusBadgeProps {
  status?: QuotationStatus | string;
  isActive?: boolean;
}

const statusClassMap: Record<QuotationStatus, string> = {
  Approved: 'badge-approved',
  Pending: 'badge-pending',
  Draft: 'badge-draft',
  Rejected: 'badge-rejected',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isActive }) => {
  // Boolean active/inactive badge when status is not provided
  if (status === undefined && isActive !== undefined) {
    return (
      <span
        className={
          isActive
            ? 'badge-approved'
            : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600'
        }
      >
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  }

  if (!status) return null;

  const cssClass =
    statusClassMap[status as QuotationStatus] ??
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700';

  return <span className={cssClass}>{status}</span>;
};

export default StatusBadge;
