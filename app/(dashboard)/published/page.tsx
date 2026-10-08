"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { DashboardShell } from "../../../components/dashboard-shell";
import { ChannelAvatar } from "../../../components/channel-avatar";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../components/data-state";
import {
  formatDate,
  postText,
  request,
  useDashboardData,
} from "../../../lib/dashboard";

function telegramMessageUrl(
  channel:
    | { username?: string | null; telegram_chat_id?: number | string | null }
    | null
    | undefined,
  messageId: number | null | undefined
) {
  if (!channel || messageId == null || messageId <= 0) return null;
  const username = channel.username?.replace(/^@/, "").trim();
  if (username) return `https://t.me/${username}/${messageId}`;

  const privateChatId = String(channel.telegram_chat_id ?? "").match(
    /^-100(\d+)$/
  )?.[1];
  return privateChatId ? `https://t.me/c/${privateChatId}/${messageId}` : null;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the compatibility path for browsers that block Clipboard API.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    if (!document.execCommand("copy")) {
      throw new Error("Browser refused to copy to clipboard.");
    }
  } finally {
    textarea.remove();
  }
}

export default function Published() {
  const {
    data,
    loading,
    error,
    refreshing,
    refreshError,
    lastUpdatedAt,
    reload,
  } = useDashboardData({ refreshIntervalMs: 10_000 });
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [copied, setCopied] = useState("");
  const channels =
    data?.channels.filter(channel => channel.type === "destination") ?? [];
  const rows = (data?.published ?? []).filter(
    record => filter === "all" || record.destination_channel_id === filter
  );
  async function copyLink(id: string, link: string | null) {
    if (!link)
      return toast.error("A Telegram link is unavailable for this message.");
    try {
      await copyTextToClipboard(link);
      setCopied(id);
      toast.success("Telegram link copied.");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }
  async function deleteRecord(id: string) {
    if (
      !window.confirm(
        "Delete this message from its Telegram destination? This cannot be undone."
      )
    )
      return;
    setBusyId(id);
    try {
      await request("/api/posts/delete", {
        method: "POST",
        body: JSON.stringify({ published_message_id: id }),
      });
      toast.success("Message deleted from Telegram.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId("");
    }
  }
  return (
    <DashboardShell>
      <Toaster theme="dark" />
      <div className="topline">
        <div>
          <div className="eyebrow">Archive / delivery log</div>
          <h1 className="h1">Published records</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 7 }}>
            Every outbound message, in one place.
          </div>
          <div className="muted published-live-status" aria-live="polite">
            {refreshError
              ? "Live refresh delayed; showing the last loaded records."
              : "Auto-updates every 10 seconds while this page is visible."}
            {lastUpdatedAt ? ` Last updated ${formatDate(lastUpdatedAt)}.` : ""}
          </div>
        </div>
        <button
          className="btn"
          disabled={loading || refreshing}
          onClick={reload}
        >
          {refreshing ? "Updating…" : "Refresh records"}
        </button>
      </div>
      {!loading && !error && (
        <div className="tabs published-tabs">
          <button
            className={`tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All destinations
          </button>
          {channels.map(channel => (
            <button
              key={channel.id}
              className={`tab ${filter === channel.id ? "active" : ""}`}
              onClick={() => setFilter(channel.id)}
            >
              {channel.title}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading published records…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState
          title="No published records"
          detail={
            filter === "all"
              ? "Successful, failed, and deleted Telegram deliveries will appear here."
              : "There are no delivery records for this destination yet."
          }
        />
      ) : (
        <div className="published-record-grid">
          {rows.map(record => {
            const url = telegramMessageUrl(
              record.destination_channel,
              record.telegram_message_id
            );
            return (
              <article className="card published-record-card" key={record.id}>
                <div className="published-record-head">
                  <span className="badge blue published-record-destination">
                    {record.destination_channel && (
                      <ChannelAvatar
                        channel={record.destination_channel}
                        size={22}
                      />
                    )}
                    <span className="published-record-destination-text">
                      {record.destination_channel?.title ?? "Unknown channel"}
                    </span>
                  </span>
                  <span
                    className={`badge ${record.status === "posted" ? "green" : record.status === "failed" ? "red" : "amber"}`}
                  >
                    {record.status}
                  </span>
                </div>
                <div className="published-record-text">
                  {postText(record.post)}
                </div>
                <div className="published-record-meta">
                  <div className="published-record-stat">
                    <span>Source</span>
                    <strong>
                      {record.post?.source_channel?.title ?? "Manual draft"}
                    </strong>
                  </div>
                  <div className="published-record-stat">
                    <span>Mode</span>
                    <strong>{record.publish_mode}</strong>
                  </div>
                  <div className="published-record-stat">
                    <span>Published</span>
                    <strong>
                      {formatDate(record.posted_at ?? record.created_at)}
                    </strong>
                  </div>
                </div>
                {record.error_message && (
                  <div className="channel-error published-record-error">
                    {record.error_message}
                  </div>
                )}
                <div className="published-record-actions">
                  <button
                    className="btn small"
                    onClick={() => void copyLink(record.id, url)}
                  >
                    {copied === record.id ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copied === record.id ? "Copied" : "Copy link"}
                  </button>
                  {url ? (
                    <a
                      className="btn small"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open Telegram message"
                    >
                      <ExternalLink size={12} />
                      Open
                    </a>
                  ) : (
                    <button
                      className="btn small"
                      disabled
                      title="No public Telegram link is available"
                    >
                      <ExternalLink size={12} />
                      Open
                    </button>
                  )}
                  {record.status === "posted" && (
                    <button
                      className="btn small danger"
                      disabled={
                        busyId === record.id ||
                        !record.destination_channel?.can_delete
                      }
                      title={
                        !record.destination_channel?.can_delete
                          ? "Bot lacks delete permission"
                          : "Delete this message"
                      }
                      onClick={() => void deleteRecord(record.id)}
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
