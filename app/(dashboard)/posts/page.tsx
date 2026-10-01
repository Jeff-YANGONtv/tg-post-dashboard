"use client";

import { useState } from "react";
import { Image as ImageIcon, Plus, Send, Trash2, Video } from "lucide-react";
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

export default function Posts() {
  const { data, loading, error, reload } = useDashboardData({
    refreshIntervalMs: 10_000,
  });
  const [showComposer, setShowComposer] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelPickerPostId, setChannelPickerPostId] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<
    Record<string, string[]>
  >({});
  const [publishModes, setPublishModes] = useState<
    Record<string, "copy" | "forward">
  >({});
  const [busy, setBusy] = useState(false);
  const [busyPostId, setBusyPostId] = useState("");

  const destinations =
    data?.channels.filter(
      channel => channel.type === "destination" && channel.is_active
    ) ?? [];
  const readyDestinations = destinations.filter(channel => channel.can_post);

  function selectedFor(postId: string) {
    return selectedChannels[postId] ?? [];
  }

  function toggleChannel(postId: string, channelId: string) {
    setSelectedChannels(current => {
      const existing = current[postId] ?? [];
      const next = existing.includes(channelId)
        ? existing.filter(id => id !== channelId)
        : [...existing, channelId];
      return { ...current, [postId]: next };
    });
  }

  function statusFor(postId: string, postStatus: string) {
    const records =
      data?.published.filter(item => item.post_id === postId) ?? [];
    if (records.some(item => item.status === "posted")) return "posted";
    if (records.some(item => item.status === "failed")) return "failed";
    return postStatus || "new";
  }

  function publishedCountFor(postId: string) {
    return (
      data?.published.filter(
        item => item.post_id === postId && item.status === "posted"
      ).length ?? 0
    );
  }

  function hasDeliveryHistory(postId: string) {
    return Boolean(
      data?.published.some(item => item.post_id === postId) ||
      data?.scheduled.some(item => item.post_id === postId)
    );
  }

  async function deleteDraft(postId: string) {
    if (
      !window.confirm(
        "Delete this unpublished post? Posts with delivery history cannot be deleted here."
      )
    )
      return;
    setBusyPostId(postId);
    try {
      await request("/api/posts", {
        method: "DELETE",
        body: JSON.stringify({ post_id: postId }),
      });
      toast.success("Draft deleted.");
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setBusyPostId("");
    }
  }

  const posts = (data?.posts ?? []).filter(post => {
    return (
      statusFilter === "all" || statusFor(post.id, post.status) === statusFilter
    );
  });

  async function publish(postId: string, destinationIds: string[]) {
    if (!destinationIds.length) {
      toast.error("Select at least one destination channel first.");
      return;
    }
    setBusyPostId(postId);
    try {
      const result = await request<{
        results: { status: string; error_message?: string }[];
      }>("/api/posts/publish", {
        method: "POST",
        body: JSON.stringify({
          post_id: postId,
          destination_channel_ids: destinationIds,
          mode: publishModes[postId] ?? "copy",
        }),
      });
      const failed = result.results.filter(item => item.status === "failed");
      if (failed.length) {
        toast.error(
          `${failed.length} destination${failed.length === 1 ? "" : "s"} failed: ${failed[0].error_message ?? "check permissions"}`
        );
      } else if (!result.results.length) {
        toast.error(
          "Nothing was published. Check permissions or existing deliveries."
        );
      } else {
        toast.success(
          `Published to ${result.results.length} destination${result.results.length === 1 ? "" : "s"}.`
        );
      }
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Publish failed.");
    } finally {
      setBusyPostId("");
    }
  }

  async function createAndPublish(formData: FormData) {
    const text = String(formData.get("text") ?? "").trim();
    const destinationIds = formData.getAll("destinations").map(String);
    if (!text || !destinationIds.length) {
      toast.error("Add post text and choose at least one destination.");
      return;
    }
    setBusy(true);
    try {
      const post = await request<{ id: string }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ text, destination_channel_ids: destinationIds }),
      });
      const result = await request<{
        results: { status: string; error_message?: string }[];
      }>("/api/posts/publish", {
        method: "POST",
        body: JSON.stringify({
          post_id: post.id,
          destination_channel_ids: destinationIds,
          mode: "copy",
        }),
      });
      const failed = result.results.filter(item => item.status === "failed");
      if (failed.length) {
        toast.error(
          `${failed.length} destination${failed.length === 1 ? "" : "s"} failed: ${failed[0].error_message ?? "check permissions"}`
        );
      } else if (!result.results.length) {
        toast.error("No message was published. Check channel permissions.");
      } else {
        toast.success(
          `Published to ${result.results.length} destination${result.results.length === 1 ? "" : "s"}.`
        );
      }
      setShowComposer(false);
      await reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not create the post."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <Toaster theme="dark" />
      <section className="broadcast-posts">
        <h1 className="visually-hidden">Posts</h1>
        <div className="broadcast-toolbar">
          <label className="visually-hidden" htmlFor="post-status-filter">
            Filter posts by status
          </label>
          <select
            className="select broadcast-status-filter"
            id="post-status-filter"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="posted">Published</option>
            <option value="failed">Failed</option>
          </select>
          <button
            className="btn broadcast-new-post"
            onClick={() => setShowComposer(value => !value)}
          >
            <Plus size={17} /> {showComposer ? "Close" : "New post"}
          </button>
        </div>

        {showComposer && (
          <form
            className="card broadcast-composer"
            onSubmit={event => {
              event.preventDefault();
              void createAndPublish(new FormData(event.currentTarget));
            }}
          >
            <div className="broadcast-composer-title">Create a post</div>
            <label className="visually-hidden" htmlFor="post-text">
              Post text
            </label>
            <textarea
              className="textarea"
              id="post-text"
              name="text"
              required
              rows={4}
              placeholder="Write your Telegram post…"
            />
            <fieldset className="destination-picker">
              <legend className="label">Select channels</legend>
              {readyDestinations.length ? (
                <div className="channel-options">
                  {readyDestinations.map(channel => (
                    <label className="checkbox-option" key={channel.id}>
                      <input
                        type="checkbox"
                        name="destinations"
                        value={channel.id}
                      />
                      <ChannelAvatar channel={channel} size={28} />
                      <span className="channel-choice-copy">
                        <strong>{channel.title}</strong>
                        <small>
                          {channel.username
                            ? `@${channel.username.replace(/^@/, "")}`
                            : "No public username"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="muted">
                  No active destination channels have posting permission.
                </div>
              )}
            </fieldset>
            <div className="broadcast-composer-actions">
              <span className="muted">
                The post will be sent immediately to the selected channels.
              </span>
              <button
                className="btn primary"
                type="submit"
                disabled={busy || !readyDestinations.length}
              >
                <Send size={15} /> {busy ? "Publishing…" : "Post now"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <LoadingState label="Loading posts…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !posts.length ? (
          <EmptyState
            title={
              statusFilter === "all" ? "No posts yet" : "No matching posts"
            }
            detail={
              statusFilter === "all"
                ? "Posts received by your Telegram webhook will appear here. You can also create a post."
                : "Try another status filter or create a new post."
            }
          />
        ) : (
          <div className="broadcast-post-list">
            {posts.map(post => {
              const chosen = selectedFor(post.id);
              const status = statusFor(post.id, post.status);
              const isPickerOpen = channelPickerPostId === post.id;
              const mediaType = post.media_type || "text";
              return (
                <article className="card broadcast-post-card" key={post.id}>
                  <div className="broadcast-post-heading">
                    <div className="broadcast-post-copy">{postText(post)}</div>
                    <span
                      className={`badge ${status === "posted" ? "green" : status === "failed" ? "red" : "blue"}`}
                    >
                      {status === "posted" ? "Published" : status}
                    </span>
                  </div>
                  <div className="broadcast-post-meta">
                    <span>{mediaType}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {chosen.length}/{readyDestinations.length} channels
                      selected
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{publishedCountFor(post.id)} published</span>
                  </div>
                  <div className="broadcast-post-source">
                    From {post.source_channel?.title ?? "Manual draft"} ·{" "}
                    {formatDate(post.created_at)}
                  </div>

                  {isPickerOpen && (
                    <div className="broadcast-channel-picker">
                      <div className="broadcast-picker-label">
                        Choose destination channels
                      </div>
                      {post.source_message_id && post.source_channel_id && (
                        <div className="broadcast-mode-row">
                          <label htmlFor={`mode-${post.id}`}>Send as</label>
                          <select
                            className="select broadcast-mode-select"
                            id={`mode-${post.id}`}
                            value={publishModes[post.id] ?? "copy"}
                            onChange={event =>
                              setPublishModes(current => ({
                                ...current,
                                [post.id]: event.target.value as
                                  "copy" | "forward",
                              }))
                            }
                          >
                            <option value="copy">Copy</option>
                            <option value="forward">Forward</option>
                          </select>
                        </div>
                      )}
                      {readyDestinations.length ? (
                        <div className="broadcast-picker-options">
                          {readyDestinations.map(channel => (
                            <label
                              className="broadcast-picker-option"
                              key={channel.id}
                            >
                              <input
                                type="checkbox"
                                checked={chosen.includes(channel.id)}
                                onChange={() =>
                                  toggleChannel(post.id, channel.id)
                                }
                              />
                              <ChannelAvatar channel={channel} size={28} />
                              <span className="channel-choice-copy">
                                <strong>{channel.title}</strong>
                                <small>
                                  {channel.username
                                    ? `@${channel.username.replace(/^@/, "")}`
                                    : "No public username"}
                                </small>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="muted">
                          No channels are ready to receive posts.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="broadcast-post-actions">
                    <button
                      className="btn broadcast-secondary"
                      aria-expanded={isPickerOpen}
                      onClick={() =>
                        setChannelPickerPostId(isPickerOpen ? "" : post.id)
                      }
                    >
                      Select channels
                    </button>
                    <button
                      className="btn primary broadcast-post-now"
                      disabled={busyPostId === post.id || chosen.length === 0}
                      onClick={() => void publish(post.id, chosen)}
                    >
                      <Send size={15} />
                      {busyPostId === post.id ? "Posting…" : "Post now"}
                    </button>
                  </div>
                  <div className="broadcast-post-footer">
                    {mediaType === "video" ? (
                      <Video size={15} />
                    ) : mediaType === "photo" || mediaType === "image" ? (
                      <ImageIcon size={15} />
                    ) : (
                      <Send size={15} />
                    )}
                    <span>{mediaType} post</span>
                    <span className="broadcast-footer-spacer" />
                    <span>
                      {post.source_message_id
                        ? `Source message ${post.source_message_id}`
                        : "Ready to publish"}
                    </span>
                    <button
                      className="broadcast-delete"
                      disabled={
                        busyPostId === post.id || hasDeliveryHistory(post.id)
                      }
                      title={
                        hasDeliveryHistory(post.id)
                          ? "Posts with delivery history are protected"
                          : "Delete unpublished post"
                      }
                      aria-label={`Delete post: ${postText(post)}`}
                      onClick={() => void deleteDraft(post.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
