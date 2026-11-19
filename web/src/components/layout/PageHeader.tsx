import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-4">
      {breadcrumb ? <div className="mb-1 text-xs text-ink-400">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 tabIndex={-1} className="text-xl font-semibold text-ink-900">
            {title}
          </h1>
          {description ? <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
