import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../../lib/supabase/admin";
import {
  getChat,
  getChatMember,
  getMe,
} from "../../../../lib/telegram/actions";
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const { data: channel } = await admin
    .from("channels")
    .select("*")
    .eq("id", id)
    .single();
  if (!channel)
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  try {
    const [chat, bot] = await Promise.all([
      getChat(channel.telegram_chat_id),
      getMe(),
    ]);
    const member = await getChatMember(channel.telegram_chat_id, bot.id);
    const canPost =
      member.status === "administrator" &&
      (member.can_post_messages ||
        member.can_manage_chat ||
        member.can_post_stories) === true;
    const canDelete =
      member.status === "administrator" && member.can_delete_messages === true;
    const last_error =
      canPost && canDelete ? null : "Missing Post/Delete Rights";
    const { data } = await admin
      .from("channels")
      .update({
        title: chat.title ?? channel.title,
        username: chat.username ?? channel.username,
        can_post: canPost,
        can_delete: canDelete,
        last_permission_check_at: new Date().toISOString(),
        last_error,
      })
      .eq("id", id)
      .select()
      .single();
    return NextResponse.json({ channel: data, canPost, canDelete });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Permission check failed";
    await admin
      .from("channels")
      .update({
        last_error: message,
        last_permission_check_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
