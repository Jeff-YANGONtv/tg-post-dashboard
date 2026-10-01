import { NextResponse } from "next/server";
import { admin } from "../../../../../lib/supabase/admin";
import { getChatProfilePhoto } from "../../../../../lib/telegram/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHANNEL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_CACHE =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

function emptyResponse(status: number, cacheControl = "no-store") {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { channelId: string } }
) {
  void request;
  const channelId = params.channelId;
  if (!CHANNEL_ID_PATTERN.test(channelId)) return emptyResponse(404);

  const { data: channel, error } = await admin
    .from("channels")
    .select("telegram_chat_id")
    .eq("id", channelId)
    .maybeSingle();
  if (error) return emptyResponse(503);
  if (!channel) return emptyResponse(404, "public, max-age=300, s-maxage=300");

  try {
    const photo = await getChatProfilePhoto(channel.telegram_chat_id);
    if (!photo) return emptyResponse(404, "public, max-age=300, s-maxage=300");

    return new NextResponse(photo.data, {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": IMAGE_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return emptyResponse(502);
  }
}
