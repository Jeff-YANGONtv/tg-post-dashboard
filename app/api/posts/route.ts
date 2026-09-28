import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    text?: string;
    destination_channel_ids?: string[];
  } | null;
  const text = body?.text?.trim();
  const destinationIds = [...new Set(body?.destination_channel_ids ?? [])];
  if (!text)
    return NextResponse.json(
      { error: "Post text is required" },
      { status: 400 }
    );
  if (!destinationIds.length)
    return NextResponse.json(
      { error: "Select at least one destination channel" },
      { status: 400 }
    );
  const { data, error } = await admin
    .from("posts")
    .insert({ text, caption: text, media_type: "text", status: "new" })
    .select("*,source_channel:channels!source_channel_id(id,title,username)")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { ...data, destination_channel_ids: destinationIds },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    post_id?: string;
  } | null;
  if (!body?.post_id)
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

  const [published, scheduled] = await Promise.all([
    admin
      .from("published_messages")
      .select("id", { count: "exact", head: true })
      .eq("post_id", body.post_id),
    admin
      .from("scheduled_publications")
      .select("id", { count: "exact", head: true })
      .eq("post_id", body.post_id),
  ]);
  const lookupError = published.error ?? scheduled.error;
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if ((published.count ?? 0) > 0 || (scheduled.count ?? 0) > 0)
    return NextResponse.json(
      {
        error: "Posts with delivery history cannot be deleted from this screen",
      },
      { status: 409 }
    );

  const { data, error } = await admin
    .from("posts")
    .delete()
    .eq("id", body.post_id)
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
