'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Radio, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DashboardShell } from '../../../components/dashboard-shell';
import { EmptyState, ErrorState, LoadingState } from '../../../components/data-state';
import { formatDate, request, useDashboardData } from '../../../lib/dashboard';

type SubscriberCount = { channelId: string; count: number | null; error?: string };
const numberFormat = new Intl.NumberFormat();

export default function Channels() {
  const { data, loading, error, reload } = useDashboardData();
  const [tab, setTab] = useState<'source' | 'destination'>('source');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, SubscriberCount>>({});
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [subscribersUpdatedAt, setSubscribersUpdatedAt] = useState<string | null>(null);

  const refreshSubscriberCounts = useCallback(async (showToast = false) => {
    setSubscribersLoading(true);
    try {
      const result = await request<{ counts: SubscriberCount[]; updatedAt: string }>('/api/channels/subscribers');
      setSubscriberCounts(Object.fromEntries(result.counts.map((item) => [item.channelId, item])));
      setSubscribersUpdatedAt(result.updatedAt);
      const failures = result.counts.filter((item) => item.error).length;
      if (showToast) {
        if (failures) toast.message(`${failures} channel${failures === 1 ? '' : 's'} could not return a subscriber count.`);
        else toast.success('Subscriber counts refreshed.');
      }
    } catch (cause) {
      if (showToast) toast.error(cause instanceof Error ? cause.message : 'Could not refresh subscriber counts.');
    } finally {
      setSubscribersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data?.channels.length) void refreshSubscriberCounts();
  }, [data?.channels.length, refreshSubscriberCounts]);

  async function addChannel(formData: FormData) {
    try {
      const result = await request<{ error?: string }>('/api/channels', { method: 'POST', body: JSON.stringify({ type: tab, telegram_chat_id: String(formData.get('telegram_chat_id') ?? '').trim() }) });
      if (result.error) throw new Error(result.error);
      toast.success('Channel added.'); setAdding(false); await reload();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not add channel.'); }
  }

  async function testChannel(id: string) {
    setBusyId(id);
    try {
      const result = await request<{ canPost: boolean; canDelete: boolean; error?: string }>('/api/channels/test', { method: 'POST', body: JSON.stringify({ id }) });
      if (result.error) throw new Error(result.error);
      toast.success(tab === 'source' ? 'Source channel permission check completed.' : result.canPost ? `Posting access confirmed${result.canDelete ? ' · delete access confirmed' : ''}.` : 'Channel is reachable; posting permission is missing.'); await reload();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Permission check failed.'); }
    finally { setBusyId(''); }
  }

  const rows = data?.channels.filter((channel) => channel.type === tab) ?? [];

  return <DashboardShell>
    <Toaster theme="dark" />
    <div className="topline">
      <div>
        <div className="eyebrow">Network / channels</div>
        <h1 className="h1">Channel registry</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 7 }}>Control intake and distribution endpoints.</div>
      </div>
      <button className="btn primary" onClick={() => setAdding((value) => !value)}><Plus size={14} /> {adding ? 'Close' : 'Add channel'}</button>
    </div>
    {adding && <form className="card channel-add" onSubmit={(event) => { event.preventDefault(); void addChannel(new FormData(event.currentTarget)); }}>
      <div><div className="eyebrow">Register a {tab} channel</div><div className="muted channel-hint">Use the public @username or numeric Telegram chat ID. The bot must already have access.</div></div>
      <div className="channel-add-controls"><input className="input" name="telegram_chat_id" required placeholder="@channelname or -100…" aria-label="Telegram channel username or ID" /><button className="btn primary" type="submit">Add channel</button></div>
    </form>}
    <div className="tabs">
      <button className={`tab ${tab === 'source' ? 'active' : ''}`} onClick={() => setTab('source')}><Radio size={13} className="inline-icon" />Source channels <span className="muted">{data?.channels.filter((channel) => channel.type === 'source').length ?? '—'}</span></button>
      <button className={`tab ${tab === 'destination' ? 'active' : ''}`} onClick={() => setTab('destination')}><Send size={13} className="inline-icon" />Destination channels <span className="muted">{data?.channels.filter((channel) => channel.type === 'destination').length ?? '—'}</span></button>
    </div>
    {loading ? <LoadingState label="Loading channels…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? <EmptyState title={`No ${tab} channels registered`} detail="Add a channel to connect this dashboard to your Telegram network." /> : <div className="card table-card">
      <div className="subscriber-tools">
        <span className="muted" title={subscribersUpdatedAt ? formatDate(subscribersUpdatedAt) : undefined}>
          {subscribersUpdatedAt ? `Subscriber counts updated ${formatDate(subscribersUpdatedAt)}` : 'Subscriber counts load from Telegram'}
        </span>
        <button className="btn small" disabled={subscribersLoading} onClick={() => void refreshSubscriberCounts(true)}>
          <RefreshCw size={12} className={subscribersLoading ? 'spin' : ''} />
          {subscribersLoading ? 'Refreshing…' : 'Refresh counts'}
        </button>
      </div>
      <table className="table"><thead><tr><th>Channel</th><th>Telegram ID</th><th>Subscribers</th><th>Status</th><th>Last permission check</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((channel) => {
          const missingRights = tab === 'destination' && !channel.can_post;
          const status = !channel.is_active ? 'Paused' : missingRights ? 'Missing post rights' : 'Ready';
          const subscriber = subscriberCounts[channel.id];
          return <tr key={channel.id}>
            <td><div className="table-primary">{channel.title}</div><div className="muted table-sub">{channel.username ? `@${channel.username.replace(/^@/, '')}` : 'No public username'}</div></td>
            <td className="mono muted">{channel.telegram_chat_id}</td>
            <td className="mono" title={subscriber?.error ?? 'Current Telegram subscriber count'}>{typeof subscriber?.count === 'number' ? numberFormat.format(subscriber.count) : subscribersLoading ? '…' : '—'}</td>
            <td><span className={`badge ${!channel.is_active ? 'amber' : missingRights ? 'red' : 'green'}`}>{missingRights ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}{status}</span>{channel.last_error && <div className="channel-error">{channel.last_error}</div>}</td>
            <td className="muted">{formatDate(channel.last_permission_check_at)}</td>
            <td><button className="btn small" disabled={busyId === channel.id} onClick={() => void testChannel(channel.id)}><RefreshCw size={12} className={busyId === channel.id ? 'spin' : ''} />{busyId === channel.id ? 'Checking…' : 'Test permissions'}</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <div className="notice page-note">Subscriber counts are read from Telegram when this page loads. The bot must be able to access each channel; unavailable counts appear as —. Source channels need read access. Destination channels must grant the bot administrator posting rights; deletion rights enable removing messages from the Published page.</div>
  </DashboardShell>;
}
