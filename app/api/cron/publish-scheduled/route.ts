import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

function secretsMatch(provided: string | null, expected: string) {
  if (!provided) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Scheduled publishing is not configured." },
      { status: 503 }
    );
  }
  if (
    !secretsMatch(
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      cronSecret
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: jobs, error } = await admin
    .from("scheduled_publications")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let completed = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    try {
      const response = await fetch(new URL("/api/posts/publish", request.url), {
        method: "POST",
        headers: {
          authorization: `Bearer ${cronSecret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          post_id: job.post_id,
          destination_channel_ids: [job.destination_channel_id],
          mode: "copy",
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        results?: { status?: string }[];
        error?: string;
      } | null;
      const deliveryFailed =
        !response.ok ||
        Boolean(result?.error) ||
        Boolean(result?.results?.some(item => item.status === "failed"));

      if (deliveryFailed) {
        failed += 1;
        continue;
      }

      const { error: updateError } = await admin
        .from("scheduled_publications")
        .update({ status: "completed" })
        .eq("id", job.id)
        .eq("status", "pending");
      if (updateError) {
        failed += 1;
        continue;
      }
      completed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ processed: jobs?.length ?? 0, completed, failed });
}
