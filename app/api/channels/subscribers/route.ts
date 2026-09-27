import { NextResponse } from 'next/server';
import { admin } from '../../../../lib/supabase/admin';
import { getChatMemberCount } from '../../../../lib/telegram/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONCURRENCY = 5;

type ChannelCount = {
  channelId: string;
  count: number | null;
  error?: string;
};

export async function GET() {
  const { data: channels, error } = await admin
    .from('channels')
    .select('id,telegram_chat_id')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: ChannelCount[] = new Array(channels?.length ?? 0);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      const channel = channels?.[index];
      if (!channel) return;

      try {
        const count = await getChatMemberCount(channel.telegram_chat_id);
        results[index] = { channelId: channel.id, count };
      } catch (cause) {
        results[index] = {
          channelId: channel.id,
          count: null,
          error: cause instanceof Error ? cause.message : 'Could not retrieve subscriber count',
        };
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, results.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return NextResponse.json(
    { counts: results, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
