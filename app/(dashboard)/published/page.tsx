'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DashboardShell } from '../../../components/dashboard-shell';
import { EmptyState, ErrorState, LoadingState } from '../../../components/data-state';
import { formatDate, postText, request, useDashboardData } from '../../../lib/dashboard';

export default function Published() {
  const { data, loading, error, reload } = useDashboardData();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [copied, setCopied] = useState('');
  const channels = data?.channels.filter((channel) => channel.type === 'destination') ?? [];
  const rows = (data?.published ?? []).filter((record) => filter === 'all' || record.destination_channel_id === filter);
  async function copyLink(id: string, username: string | null | undefined, messageId: number | null) {
    if (!username || !messageId) return toast.error('A public Telegram link is unavailable for this message.');
    const link = `https://t.me/${username.replace(/^@/, '')}/${messageId}`;
    try { await navigator.clipboard.writeText(link); setCopied(id); toast.success('Telegram link copied.'); setTimeout(() => setCopied(''), 1500); }
    catch { toast.error('Could not access the clipboard.'); }
  }
  async function deleteRecord(id: string) {
    if (!window.confirm('Delete this message from its Telegram destination? This cannot be undone.')) return;
    setBusyId(id);
    try { await request('/api/posts/delete', { method: 'POST', body: JSON.stringify({ published_message_id: id }) }); toast.success('Message deleted from Telegram.'); await reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed.'); }
    finally { setBusyId(''); }
  }
  return <DashboardShell><Toaster theme="dark" /><div className="topline"><div><div className="eyebrow">Archive / delivery log</div><h1 className="h1">Published records</h1><div className="muted" style={{ fontSize: 13, marginTop: 7 }}>Every outbound message, in one place.</div></div><button className="btn" onClick={reload}>Refresh records</button></div>
    {!loading && !error && <div className="tabs published-tabs"><button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All destinations</button>{channels.map((channel) => <button key={channel.id} className={`tab ${filter === channel.id ? 'active' : ''}`} onClick={() => setFilter(channel.id)}>{channel.title}</button>)}</div>}
    {loading ? <LoadingState label="Loading published records…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? <EmptyState title="No published records" detail={filter === 'all' ? 'Successful, failed, and deleted Telegram deliveries will appear here.' : 'There are no delivery records for this destination yet.'} /> : <div className="card table-card"><table className="table"><thead><tr><th>Post</th><th>Destination</th><th>Mode</th><th>Published</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((record) => { const username = record.destination_channel?.username; const url = username && record.telegram_message_id ? `https://t.me/${username.replace(/^@/, '')}/${record.telegram_message_id}` : null; return <tr key={record.id}><td><div className="table-primary published-post">{postText(record.post)}</div><div className="muted table-sub">from {record.post?.source_channel?.title ?? 'Manual draft'}</div></td><td><span className="badge blue">{record.destination_channel?.title ?? 'Unknown channel'}</span></td><td className="mono muted">{record.publish_mode}</td><td className="muted">{formatDate(record.posted_at ?? record.created_at)}</td><td><span className={`badge ${record.status === 'posted' ? 'green' : record.status === 'failed' ? 'red' : 'amber'}`}>{record.status}</span>{record.error_message && <div className="channel-error">{record.error_message}</div>}</td><td><div className="action-row"><button className="btn small" onClick={() => void copyLink(record.id, username, record.telegram_message_id)}>{copied === record.id ? <Check size={12} /> : <Copy size={12} />}{copied === record.id ? 'Copied' : 'Copy link'}</button>{url ? <a className="btn small" href={url} target="_blank" rel="noreferrer" aria-label="Open Telegram message"><ExternalLink size={12} />Open</a> : <button className="btn small" disabled title="No public Telegram link is available"><ExternalLink size={12} />Open</button>}{record.status === 'posted' && <button className="btn small danger" disabled={busyId === record.id || !record.destination_channel?.can_delete} title={!record.destination_channel?.can_delete ? 'Bot lacks delete permission' : 'Delete this message'} onClick={() => void deleteRecord(record.id)}><Trash2 size={12} />Delete</button>}</div></td></tr>; })}</tbody></table></div>}
  </DashboardShell>;
}
