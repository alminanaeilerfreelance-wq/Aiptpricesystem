import React from 'react';
import clsx from 'clsx';

export type SkeletonVariant = 'text' | 'card' | 'table';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  rows?: number;
  className?: string;
}

const TextSkeleton: React.FC<{ rows: number; className?: string }> = ({ rows, className }) => (
  <div className={clsx('space-y-2', className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={clsx(
          'h-4 bg-gray-200 rounded animate-pulse',
          i === rows - 1 ? 'w-3/4' : 'w-full',
        )}
      />
    ))}
  </div>
);

const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('card p-6 animate-pulse', className)}>
    <div className="flex items-start justify-between mb-4">
      <div className="h-5 bg-gray-200 rounded w-32" />
      <div className="h-8 w-8 bg-gray-200 rounded-lg" />
    </div>
    <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
    <div className="h-4 bg-gray-200 rounded w-40" />
  </div>
);

const TableSkeleton: React.FC<{ rows: number; className?: string }> = ({ rows, className }) => (
  <div className={clsx('w-full', className)}>
    {/* Header row */}
    <div className="flex gap-4 px-4 py-3 border-b border-border">
      {[40, 20, 15, 15, 10].map((w, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 rounded animate-pulse"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
    {/* Data rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex gap-4 px-4 py-4 border-b border-border last:border-0"
      >
        {[40, 20, 15, 15, 10].map((w, j) => (
          <div
            key={j}
            className="h-4 bg-gray-100 rounded animate-pulse"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    ))}
  </div>
);

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  rows = 3,
  className,
}) => {
  if (variant === 'card') return <CardSkeleton className={className} />;
  if (variant === 'table') return <TableSkeleton rows={rows} className={className} />;
  return <TextSkeleton rows={rows} className={className} />;
};

export default Skeleton;
