import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../../lib/supabase/admin";
import {
  forwardMessage,
  sendMessage,
  sendPhoto,
  sendVideo,
} from "../../../../lib/telegram/actions";
export async function POST(req: NextRequest) {
  const { post_id, destination_channel_ids, mode = "copy" } = await req.json();
  const { data: post } = await admin
    .from("posts")
    .select("*,source_channel:channels!source_channel_id(*)")
    .eq("id", post_id)
    .single();
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (mode === "forward" && (!post.source_message_id || !post.source_channel))
    return NextResponse.json(
      { error: "Forward mode requires an ingested Telegram source message" },
      { status: 422 }
    );
  const settings = (
    await admin
      .from("app_settings")
      .select("max_channels_per_post")
      .eq("id", 1)
      .single()
  ).data;
  const ids = (destination_channel_ids as string[]).slice(
    0,
    settings?.max_channels_per_post ?? 3
  );
  const results = [];
  for (const destination_channel_id of ids) {
    const existing = await admin
      .from("published_messages")
      .select("id,status")
      .eq("post_id", post_id)
      .eq("destination_channel_id", destination_channel_id)
      .maybeSingle();
    if (existing.data?.status === "posted") continue;
    const { data: channel } = await admin
      .from("channels")
      .select("*")
      .eq("id", destination_channel_id)
      .eq("type", "destination")
      .eq("is_active", true)
      .single();
    if (!channel || !channel.can_post) continue;
    try {
      const message =
        mode === "forward"
          ? await forwardMessage(
              channel.telegram_chat_id,
              post.source_channel.telegram_chat_id,
              post.source_message_id
            )
          : post.media_type === "photo" && post.telegram_file_id
            ? await sendPhoto(
                channel.telegram_chat_id,
                post.telegram_file_id,
                post.caption ?? post.text ?? undefined
              )
            : post.media_type === "video" && post.telegram_file_id
              ? await sendVideo(
                  channel.telegram_chat_id,
                  post.telegram_file_id,
                  post.caption ?? post.text ?? undefined
                )
              : await sendMessage(
                  channel.telegram_chat_id,
                  post.text ?? post.caption ?? ""
                );
      const { data, error: recordError } = await admin
        .from("published_messages")
        .upsert(
          {
            post_id,
            destination_channel_id,
            telegram_message_id: message.message_id,
            publish_mode: mode,
            status: "posted",
            posted_at: new Date().toISOString(),
            error_message: null,
          },
          { onConflict: "post_id,destination_channel_id" }
        )
        .select()
        .single();
      if (recordError || !data) {
        results.push({
          destination_channel_id,
          status: "failed",
          telegram_message_id: message.message_id,
          error_message: `Telegram sent message ${message.message_id}, but its published record could not be saved. Check the Supabase schema/permissions before retrying to avoid a duplicate. ${recordError?.message ?? "No record was returned."}`,
        });
        continue;
      }
      results.push(data);
    } catch (e) {
      const error_message = e instanceof Error ? e.message : "Publish failed";
      await admin.from("published_messages").upsert(
        {
          post_id,
          destination_channel_id,
          publish_mode: mode,
          status: "failed",
          error_message,
        },
        { onConflict: "post_id,destination_channel_id" }
      );
      results.push({ destination_channel_id, status: "failed", error_message });
    }
  }
  return NextResponse.json({ results });
}
