import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';

export function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <div className="item-list" aria-label="Loading" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton skeleton-icon" />
          <span className="skeleton-lines">
            <span className="skeleton skeleton-line wide" />
            <span className="skeleton skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <AlertCircle size={20} />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state state-empty">
      <Inbox size={20} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
