'use client';

import { CalendarClock, Play, Trash2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DashboardShell } from '../../../components/dashboard-shell';
import { EmptyState, ErrorState, LoadingState } from '../../../components/data-state';
import { formatDate, postText, request, useDashboardData } from '../../../lib/dashboard';

export default function Scheduled() {
  const { data, loading, error, reload } = useDashboardData();
  async function remove(id: string) {
    try { await request('/api/scheduled', { method: 'DELETE', body: JSON.stringify({ id }) }); toast.success('Schedule cancelled.'); await reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not cancel schedule.'); }
  }
  async function publishNow(item: NonNullable<typeof data>['scheduled'][number]) {
    if (!item.post) return toast.error('The scheduled post could not be loaded.');
    try {
      const result = await request<{ results: { status: string; error_message?: string }[] }>('/api/posts/publish', { method: 'POST', body: JSON.stringify({ post_id: item.post_id, destination_channel_ids: [item.destination_channel_id], mode: 'copy' }) });
      if (result.results.some((entry) => entry.status === 'failed')) return toast.error(result.results.find((entry) => entry.status === 'failed')?.error_message ?? 'Publication failed; schedule was kept.');
      if (!result.results.some((entry) => entry.status === 'posted')) return toast.error('No message was published; schedule was kept. Check destination permission or delivery status.');
      await request('/api/scheduled', { method: 'DELETE', body: JSON.stringify({ id: item.id }) });
      toast.success('Published and removed from the queue.'); await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not publish now.'); }
  }
  const pending = data?.scheduled.filter((item) => item.status === 'pending') ?? [];
  return <DashboardShell><Toaster theme="dark" /><div className="topline"><div><div className="eyebrow">Queue / scheduled publications</div><h1 className="h1">Publication queue</h1><div className="muted" style={{ fontSize: 13, marginTop: 7 }}>{pending.length} pending publication{pending.length === 1 ? '' : 's'}.</div></div><button className="btn" onClick={reload}><CalendarClock size={14} /> Refresh queue</button></div>
    {loading ? <LoadingState label="Loading scheduled publications…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !pending.length ? <EmptyState title="Your queue is clear" detail="Posts scheduled for later will appear here." /> : <div className="card table-card"><table className="table"><thead><tr><th>Post</th><th>Destination</th><th>Scheduled for</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td><div className="table-primary">{postText(item.post)}</div><div className="muted table-sub">Added {formatDate(item.created_at)}</div></td><td><span className="badge blue">{item.destination_channel?.title ?? 'Unknown channel'}</span></td><td className="mono muted">{formatDate(item.scheduled_at)}</td><td><span className="badge amber">{item.status}</span></td><td><div className="action-row"><button className="btn small" onClick={() => void publishNow(item)}><Play size={12} /> Send now</button><button className="btn small danger" aria-label="Cancel schedule" onClick={() => void remove(item.id)}><Trash2 size={12} /> Cancel</button></div></td></tr>)}</tbody></table></div>}
  </DashboardShell>;
}
