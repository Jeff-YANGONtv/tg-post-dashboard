'use client';

import { useState } from 'react';
import { ArrowUpRight, CalendarClock, Image, Send, Video } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DashboardShell } from '../../../components/dashboard-shell';
import { EmptyState, ErrorState, LoadingState } from '../../../components/data-state';
import { formatDate, postText, request, useDashboardData } from '../../../lib/dashboard';

export default function Posts() {
  const { data, loading, error, reload } = useDashboardData();
  const [showComposer, setShowComposer] = useState(false);
  const [publishModes, setPublishModes] = useState<Record<string, 'copy' | 'forward'>>({});
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    const text = String(formData.get('text') ?? '').trim();
    const destination_channel_ids = formData.getAll('destinations').map(String);
    const scheduleLocal = String(formData.get('scheduled_at') ?? '');
    if (!text || !destination_channel_ids.length) return toast.error('Add post text and choose at least one destination.');
    setBusy(true);
    try {
      const post = await request<{ id: string }>('/api/posts', { method: 'POST', body: JSON.stringify({ text, destination_channel_ids }) });
      if (scheduleLocal) {
        await request('/api/scheduled', { method: 'POST', body: JSON.stringify({ post_id: post.id, destination_channel_ids, scheduled_at: new Date(scheduleLocal).toISOString() }) });
        toast.success('Post scheduled successfully.');
      } else {
        const result = await request<{ results: { status: string; error_message?: string }[] }>('/api/posts/publish', { method: 'POST', body: JSON.stringify({ post_id: post.id, destination_channel_ids, mode: 'copy' }) });
        const failed = result.results.filter((item) => item.status === 'failed');
        if (failed.length) toast.error(`${failed.length} destination${failed.length === 1 ? '' : 's'} failed: ${failed[0].error_message ?? 'check permissions'}`);
        else if (!scheduleLocal && !result.results.length) toast.error('No messages were published. Check permissions or whether these destinations already received this post.');
        else if (!scheduleLocal) toast.success(`Published to ${result.results.length} destination${result.results.length === 1 ? '' : 's'}.`);
      }
      setShowComposer(false);
      await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not submit post.'); }
    finally { setBusy(false); }
  }

  async function publishExisting(postId: string, publishMode: 'copy' | 'forward') {
    const destinations = data?.channels.filter((channel) => channel.type === 'destination' && channel.is_active && channel.can_post) ?? [];
    if (!destinations.length) return toast.error('No active destination with posting permission is available.');
    setBusy(true);
    try {
      const result = await request<{ results: { status: string; error_message?: string }[] }>('/api/posts/publish', { method: 'POST', body: JSON.stringify({ post_id: postId, destination_channel_ids: destinations.map((channel) => channel.id), mode: publishMode }) });
      const failed = result.results.filter((item) => item.status === 'failed');
      if (failed.length) toast.error(`${failed.length} destination${failed.length === 1 ? '' : 's'} failed.`);
      else if (!result.results.length) toast.error('Nothing was published. Check destination permissions or existing deliveries.');
      else toast.success(`Published to ${result.results.length} destination${result.results.length === 1 ? '' : 's'}.`);
      await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Publish failed.'); }
    finally { setBusy(false); }
  }

  const ready = data?.channels.filter((channel) => channel.type === 'destination' && channel.is_active && channel.can_post) ?? [];
  return <DashboardShell><Toaster theme="dark" /><div className="topline"><div><div className="eyebrow">Inbox / ingested content</div><h1 className="h1">Posts to distribute</h1><div className="muted" style={{ fontSize: 13, marginTop: 7 }}>Review source content and choose where it goes next.</div></div><button className="btn primary" onClick={() => setShowComposer((value) => !value)}><Send size={14} /> {showComposer ? 'Close composer' : 'Draft manually'}</button></div>
    {showComposer && <form className="card compose-form" onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}><div className="eyebrow">New publication</div><label className="label" htmlFor="post-text">Message</label><textarea className="textarea" id="post-text" name="text" required rows={5} placeholder="Write your Telegram post…"/><div className="form-grid" style={{ marginTop: 16 }}><div className="notice draft-mode-note">Manual text posts publish as copies. Forward mode is available for ingested Telegram posts.</div><div><label className="label" htmlFor="schedule-at">Schedule for (leave blank to publish now)</label><input className="input" type="datetime-local" name="scheduled_at" id="schedule-at" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} /></div></div><fieldset className="destination-picker"><legend className="label">Destinations</legend>{ready.length ? <div className="channel-options">{ready.map((channel) => <label className="checkbox-option" key={channel.id}><input type="checkbox" name="destinations" value={channel.id} defaultChecked={channel.can_post} /><span>{channel.title}</span>{!channel.can_post && <small className="amber">permission check needed</small>}</label>)}</div> : <div className="muted">No active destination channels are registered.</div>}</fieldset><div className="compose-actions"><span className="muted">Forward mode only works for posts ingested from Telegram with source message IDs.</span><button className="btn primary" type="submit" disabled={busy || ready.length === 0}>{busy ? 'Working…' : <><ArrowUpRight size={14} /> Publish / schedule</>}</button></div></form>}
    {loading ? <LoadingState label="Loading posts…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.posts.length ? <EmptyState title="No posts yet" detail="Posts received by your Telegram webhook will appear here. You can also draft a text post." /> : <div className="grid post-list">{data.posts.map((post) => <article className="card post-card" key={post.id}><div className="post-head"><div className="post-title"><div className="brand-mark post-kind">{post.media_type === 'photo' || post.media_type === 'image' ? <Image size={16} /> : post.media_type === 'video' ? <Video size={16} /> : <Send size={16} />}</div><div><div className="post-copy">{postText(post)}</div><div className="muted post-meta">From <span className="cyan">{post.source_channel?.title ?? 'Manual draft'}</span> · {formatDate(post.created_at)}</div></div></div><span className={`badge ${post.status === 'failed' ? 'red' : post.status === 'posted' ? 'green' : 'blue'}`}>{post.status}</span></div><div className="post-actions"><span className="muted">{post.media_type || 'text'} · {post.source_message_id ? `source message ${post.source_message_id}` : 'original content'}</span><div className="post-action-controls"><select className="select mode-select" aria-label="Publishing mode" value={publishModes[post.id] ?? 'copy'} onChange={(event) => setPublishModes((current) => ({ ...current, [post.id]: event.target.value as 'copy' | 'forward' }))}><option value="copy">Copy</option><option value="forward" disabled={!post.source_message_id || !post.source_channel_id}>Forward{!post.source_message_id || !post.source_channel_id ? ' · source required' : ''}</option></select><button className="btn primary small" disabled={busy || !ready.some((channel) => channel.can_post)} onClick={() => void publishExisting(post.id, publishModes[post.id] ?? 'copy')}><Send size={13} /> Publish</button></div></div></article>)}</div>}
    <div className="notice page-note"><CalendarClock size={15} /> Scheduled posts are delivered by the configured publishing worker.</div>
  </DashboardShell>;
}
