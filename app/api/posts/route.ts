import { NextRequest, NextResponse } from 'next/server';
import { admin } from '../../../lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { text?: string; destination_channel_ids?: string[] } | null;
  const text = body?.text?.trim();
  const destinationIds = [...new Set(body?.destination_channel_ids ?? [])];
  if (!text) return NextResponse.json({ error: 'Post text is required' }, { status: 400 });
  if (!destinationIds.length) return NextResponse.json({ error: 'Select at least one destination channel' }, { status: 400 });
  const { data, error } = await admin.from('posts').insert({ text, caption: text, media_type: 'text', status: 'new' }).select('*,source_channel:channels!source_channel_id(id,title,username)').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, destination_channel_ids: destinationIds }, { status: 201 });
}
