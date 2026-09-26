import { NextRequest, NextResponse } from 'next/server';
import { admin } from '../../../lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { post_id?: string; destination_channel_ids?: string[]; scheduled_at?: string } | null;
  if (!body?.post_id || !body.scheduled_at || !Array.isArray(body.destination_channel_ids) || body.destination_channel_ids.length === 0) {
    return NextResponse.json({ error: 'Post, destination channels, and schedule time are required' }, { status: 400 });
  }
  const scheduledAt = new Date(body.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return NextResponse.json({ error: 'Choose a schedule time in the future' }, { status: 422 });
  const ids = [...new Set(body.destination_channel_ids)];
  const { data: channels, error: channelError } = await admin.from('channels').select('id').in('id', ids).eq('type', 'destination').eq('is_active', true);
  if (channelError) return NextResponse.json({ error: channelError.message }, { status: 500 });
  if ((channels?.length ?? 0) !== ids.length) return NextResponse.json({ error: 'One or more destinations are unavailable' }, { status: 422 });
  const rows = ids.map((destination_channel_id) => ({ post_id: body.post_id!, destination_channel_id, scheduled_at: scheduledAt.toISOString(), status: 'pending' }));
  const { data, error } = await admin.from('scheduled_publications').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Schedule id is required' }, { status: 400 });
  const { data, error } = await admin.from('scheduled_publications').delete().eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Pending schedule not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
