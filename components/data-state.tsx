import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading dashboard data…' }: { label?: string }) {
  return <div className="data-state" role="status"><LoaderCircle className="spin" size={22} /><div><strong>{label}</strong><div className="muted">Syncing with your workspace.</div></div></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="data-state"><Inbox size={22} /><div><strong>{title}</strong><div className="muted">{detail}</div></div></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="data-state error-state" role="alert"><AlertTriangle size={22} /><div className="state-copy"><strong>Dashboard data is unavailable</strong><div className="muted">{message}</div></div><button className="btn small" onClick={onRetry}>Try again</button></div>;
}
