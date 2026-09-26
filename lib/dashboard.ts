'use client';

import { useCallback, useEffect, useState } from 'react';

export type Channel = {
  id: string;
  type: 'source' | 'destination';
  title: string;
  username: string | null;
  telegram_chat_id: number | string;
  is_active: boolean;
  can_post: boolean;
  can_delete: boolean;
  last_permission_check_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  source_channel_id: string | null;
  source_message_id: number | null;
  text: string | null;
  caption: string | null;
  media_type: string;
  status: string;
  created_at: string;
  source_channel: { id: string; title: string; username: string | null } | null;
};

export type ScheduledPublication = {
  id: string;
  post_id: string;
  destination_channel_id: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  post: Post | null;
  destination_channel: Channel | null;
};

export type PublishedMessage = {
  id: string;
  post_id: string;
  destination_channel_id: string;
  telegram_message_id: number | null;
  publish_mode: 'copy' | 'forward';
  status: 'pending' | 'posted' | 'failed' | 'deleted';
  posted_at: string | null;
  deleted_at: string | null;
  error_message: string | null;
  created_at: string;
  post: Post | null;
  destination_channel: Channel | null;
};

export type DashboardData = {
  posts: Post[];
  channels: Channel[];
  scheduled: ScheduledPublication[];
  published: PublishedMessage[];
};

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await request<DashboardData>('/api/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function postText(post: Post | null | undefined) {
  return post?.text || post?.caption || 'Media post';
}
