import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/supabase/admin";
import { getChat, getChatMember, getMe } from "../../../lib/telegram/actions";
import { TelegramError } from "../../../lib/telegram/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET() {
  const { data, error } = await admin
    .from("channels")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error)
    return privateJson(
      {
        error: `Could not load the channel list from Supabase: ${error.message}`,
      },
      500
    );
  return privateJson(data ?? []);
}

export async function DELETE(req: NextRequest) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return privateJson({ error: "Request body must be valid JSON." }, 400);
  }

  if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return privateJson({ error: "A valid channel ID is required." }, 400);
  }

  const { data, error } = await admin
    .from("channels")
    .update({ is_archived: true, is_active: false })
    .eq("id", body.id)
    .eq("is_archived", false)
    .select("id")
    .maybeSingle();

  if (error)
    return privateJson(
      { error: `Could not remove channel: ${error.message}` },
      500
    );
  if (!data) return privateJson({ error: "Channel not found." }, 404);
  return privateJson({ ok: true, id: data.id });
}

export async function POST(req: NextRequest) {
  let body: { telegram_chat_id?: string | number; type?: string };
  try {
    body = await req.json();
  } catch {
    return privateJson({ error: "Request body must be valid JSON." }, 400);
  }

  const chatId = String(body.telegram_chat_id ?? "").trim();
  if (!chatId || !body.type)
    return privateJson(
      { error: "Channel type and Telegram username or chat ID are required." },
      400
    );
  if (body.type !== "source" && body.type !== "destination") {
    return privateJson(
      { error: "Channel type must be source or destination." },
      400
    );
  }

  try {
    const bot = await getMe();
    const chat = await getChat(chatId);
    const member = await getChatMember(chat.id, bot.id);
    const canPost =
      member.status === "administrator" &&
      (member.can_post_messages ||
        member.can_manage_chat ||
        member.can_post_stories) === true;
    const canDelete =
      member.status === "administrator" && member.can_delete_messages === true;

    if (body.type === "destination" && !canPost) {
      return privateJson(
        {
          error:
            "The bot can access this channel, but cannot post. Promote it to an administrator and allow it to post messages, then try again.",
        },
        422
      );
    }

    const { data, error } = await admin
      .from("channels")
      .insert({
        type: body.type,
        title: chat.title ?? String(chat.id),
        username: chat.username ?? null,
        telegram_chat_id: chat.id,
        can_post: canPost,
        can_delete: canDelete,
        last_permission_check_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error?.code === "23505") {
      return privateJson(
        { error: "This Telegram channel is already in the channel list." },
        409
      );
    }
    if (error) {
      return privateJson(
        {
          error: `Telegram access was verified, but Supabase could not save the channel: ${error.message}`,
        },
        500
      );
    }

    return privateJson(data, 201);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Channel registration failed.";
    if (/chat not found/i.test(message)) {
      return privateJson(
        {
          error:
            "Telegram cannot find this channel or the bot cannot access it. Check the exact @username or -100… chat ID, add the bot to the channel first (as an administrator for channels), then try again.",
        },
        422
      );
    }
    if (
      /unauthorized|invalid.*token|token.*invalid|not configured/i.test(message)
    ) {
      return privateJson(
        {
          error: `The Telegram bot token is missing or invalid. Open Settings, save a valid BotFather token, and try again. Details: ${message}`,
        },
        422
      );
    }
    if (cause instanceof TelegramError) {
      return privateJson(
        { error: `Telegram could not verify this channel: ${message}` },
        422
      );
    }
    return privateJson({ error: message }, 502);
  }
}
