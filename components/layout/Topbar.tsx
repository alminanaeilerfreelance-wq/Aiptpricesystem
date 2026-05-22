import React from 'react';
import clsx from 'clsx';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface TopbarProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  userName?: string;
  userEmail?: string;
  className?: string;
}

const Topbar: React.FC<TopbarProps> = ({
  title,
  breadcrumbs,
  userName = 'Admin User',
  userEmail,
  className,
}) => {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header
      className={clsx(
        'flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-6',
        className,
      )}
    >
      {/* Left: breadcrumb + title */}
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-0.5">
            <ol className="flex items-center gap-1.5 text-xs text-gray-400">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <li aria-hidden="true">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </li>
                  )}
                  <li>
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="hover:text-gray-600 transition-colors"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span
                        className={
                          i === breadcrumbs.length - 1 ? 'text-gray-600 font-medium' : ''
                        }
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                </React.Fragment>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="truncate text-lg font-semibold text-gray-900 leading-tight">
          {title}
        </h1>
      </div>

      {/* Right: user avatar */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium text-gray-900 leading-tight">{userName}</p>
          {userEmail && (
            <p className="text-xs text-gray-400 leading-tight">{userEmail}</p>
          )}
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white shrink-0"
          aria-hidden="true"
          title={userName}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
