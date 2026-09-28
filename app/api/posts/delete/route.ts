import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../../lib/supabase/admin";
import { deleteMessage } from "../../../../lib/telegram/actions";
export async function POST(req: NextRequest) {
  const { published_message_id } = await req.json();
  const { data: record } = await admin
    .from("published_messages")
    .select(
      "*,destination_channel:channels!destination_channel_id(telegram_chat_id,can_delete)"
    )
    .eq("id", published_message_id)
    .single();
  if (!record?.telegram_message_id)
    return NextResponse.json(
      { error: "Published message not found" },
      { status: 404 }
    );
  if (!record.destination_channel.can_delete)
    return NextResponse.json(
      { error: "Bot lacks delete permission" },
      { status: 422 }
    );
  await deleteMessage(
    record.destination_channel.telegram_chat_id,
    record.telegram_message_id
  );
  const { data } = await admin
    .from("published_messages")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", published_message_id)
    .select()
    .single();
  return NextResponse.json(data);
}
