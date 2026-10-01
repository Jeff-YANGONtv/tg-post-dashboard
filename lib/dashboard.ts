"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Channel = {
  id: string;
  type: "source" | "destination";
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
  publish_mode: "copy" | "forward";
  status: "pending" | "posted" | "failed" | "deleted";
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

type DashboardDataOptions = {
  refreshIntervalMs?: number;
};

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export function useDashboardData(options: DashboardDataOptions = {}) {
  const refreshIntervalMs = options.refreshIntervalMs ?? 0;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const hasData = useRef(false);

  const load = useCallback(async (showLoading: boolean) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoading) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      const freshData = await request<DashboardData>("/api/dashboard");
      hasData.current = true;
      setData(freshData);
      setError(null);
      setRefreshError(null);
      setLastUpdatedAt(new Date().toISOString());
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not load dashboard data";
      if (showLoading || !hasData.current) setError(message);
      else setRefreshError(message);
    } finally {
      requestInFlight.current = false;
      if (showLoading) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  const reload = useCallback(() => load(true), [load]);
  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < 1000) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, refreshIntervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh, refreshIntervalMs]);

  return {
    data,
    loading,
    refreshing,
    error,
    refreshError,
    lastUpdatedAt,
    reload,
  };
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function postText(post: Post | null | undefined) {
  return post?.text || post?.caption || "Media post";
}
