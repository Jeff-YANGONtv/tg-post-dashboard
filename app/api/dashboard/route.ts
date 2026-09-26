import { NextResponse } from 'next/server';
import { admin } from '../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [posts, channels, scheduled, published] = await Promise.all([
    admin.from('posts').select('*,source_channel:channels!source_channel_id(id,title,username)').order('created_at', { ascending: false }).limit(200),
    admin.from('channels').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('scheduled_publications').select('*,post:posts!post_id(*,source_channel:channels!source_channel_id(id,title,username)),destination_channel:channels!destination_channel_id(*)').order('scheduled_at', { ascending: true }).limit(500),
    admin.from('published_messages').select('*,post:posts!post_id(*,source_channel:channels!source_channel_id(id,title,username)),destination_channel:channels!destination_channel_id(*)').order('created_at', { ascending: false }).limit(500),
  ]);
  const failed = [posts.error, channels.error, scheduled.error, published.error].find(Boolean);
  if (failed) return NextResponse.json({ error: failed.message }, { status: 500 });
  return NextResponse.json({ posts: posts.data ?? [], channels: channels.data ?? [], scheduled: scheduled.data ?? [], published: published.data ?? [] });
}
