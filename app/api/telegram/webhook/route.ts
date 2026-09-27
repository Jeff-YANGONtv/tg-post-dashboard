import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { admin, supabaseAdminConfigError } from '../../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

function secretsMatch(provided: string | null, expected: string) {
  if (!provided) return false;
  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function POST(req: NextRequest) {
  const configError = supabaseAdminConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 500 });

  const { data: settings, error: settingsError } = await admin
    .from('app_settings')
    .select('telegram_webhook_secret')
    .eq('id', 1)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: 'Could not load webhook settings.' }, { status: 500 });

  const expectedSecret = settings?.telegram_webhook_secret?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return NextResponse.json({ error: 'Webhook secret is not configured.' }, { status: 503 });
  if (!secretsMatch(req.headers.get('x-telegram-bot-api-secret-token'), expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Telegram update payload.' }, { status: 400 });
  }

  const post = update.channel_post;
  if (!post?.chat?.id) return NextResponse.json({ ok: true, ignored: true });

  const { data: source } = await admin
    .from('channels')
    .select('id')
    .eq('telegram_chat_id', post.chat.id)
    .eq('type', 'source')
    .eq('is_active', true)
    .maybeSingle();
  if (!source) return NextResponse.json({ ok: true, ignored: true });

  const media = post.photo?.at(-1) ?? post.video ?? post.document;
  const { error } = await admin.from('posts').upsert({
    source_channel_id: source.id,
    source_message_id: post.message_id,
    telegram_update_id: update.update_id,
    text: post.text ?? null,
    caption: post.caption ?? null,
    media_type: post.photo ? 'photo' : post.video ? 'video' : post.document ? 'document' : 'text',
    telegram_file_id: media?.file_id ?? null,
    status: 'new',
  }, { onConflict: 'telegram_update_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
