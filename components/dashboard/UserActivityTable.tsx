import React from 'react';
import Link from 'next/link';

interface Activity {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  quotationNo?: string;
  quotationId?: string;
  timestamp: string;
  details?: string;
}

interface UserActivityTableProps {
  activities: Activity[];
  loading?: boolean;
}

export function UserActivityTable({ activities, loading }: UserActivityTableProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  };

  const getActionColor = (action: string) => {
    if (action.includes('Created')) return 'bg-blue-50 text-blue-700';
    if (action.includes('Approved')) return 'bg-green-50 text-green-700';
    if (action.includes('Rejected')) return 'bg-red-50 text-red-700';
    if (action.includes('Updated')) return 'bg-purple-50 text-purple-700';
    return 'bg-gray-50 text-gray-700';
  };

  if (loading) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
        <p className="text-gray-500 text-center py-8">No activities found</p>
      </div>
    );
  }

  return (
    <div className="card p-6 overflow-hidden">
      <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => (
          <div key={activity._id} className="flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900">{activity.userName}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getActionColor(activity.action)}`}>
                  {activity.action}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                {activity.quotationNo && (
                  <Link
                    href={`/quotations/${activity.quotationId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {activity.quotationNo}
                  </Link>
                )}
                {activity.details && <span>{activity.details}</span>}
              </div>
            </div>
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {formatDate(activity.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
