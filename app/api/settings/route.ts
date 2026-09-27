import { NextRequest, NextResponse } from 'next/server';
import { admin, supabaseAdminConfigError } from '../../../lib/supabase/admin';
import { getMe } from '../../../lib/telegram/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

function maskToken(token: string | null | undefined) {
  if (!token) return null;
  return token.length > 10 ? `${token.slice(0, 6)}••••••${token.slice(-4)}` : '••••••••';
}

export async function GET() {
  const configError = supabaseAdminConfigError();
  if (configError) return privateJson({ error: configError }, 500);

  const { data, error } = await admin
    .from('app_settings')
    .select('telegram_bot_token,telegram_webhook_secret,max_channels_per_post,updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) return privateJson({ error: `Could not read app_settings from Supabase: ${error.message}` }, 500);

  const token = data?.telegram_bot_token?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  return privateJson({
    configured: Boolean(token),
    token: maskToken(token),
    max_channels_per_post: data?.max_channels_per_post ?? 3,
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const configError = supabaseAdminConfigError();
  if (configError) return privateJson({ error: configError }, 500);

  let body: { telegram_bot_token?: string; telegram_webhook_secret?: string; max_channels_per_post?: number };
  try {
    body = await req.json();
  } catch {
    return privateJson({ error: 'Request body must be valid JSON.' }, 400);
  }

  const token = body.telegram_bot_token?.trim();
  if (!token) return privateJson({ error: 'Enter a bot token before saving.' }, 400);
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return privateJson({ error: 'Invalid Telegram bot token format. Copy the full token from BotFather.' }, 422);
  }

  const submittedSecret = body.telegram_webhook_secret?.trim();
  if (submittedSecret && !/^[A-Za-z0-9_-]{1,256}$/.test(submittedSecret)) {
    return privateJson({ error: 'Webhook secret may contain only letters, numbers, underscores, and hyphens (up to 256 characters).' }, 422);
  }

  try {
    const bot = await getMe(token);
    const { data: existing, error: readError } = await admin
      .from('app_settings')
      .select('telegram_webhook_secret,max_channels_per_post')
      .eq('id', 1)
      .maybeSingle();
    if (readError) return privateJson({ error: `Telegram token is valid, but Supabase settings could not be read: ${readError.message}` }, 500);

    const requestedMax = Number(body.max_channels_per_post ?? existing?.max_channels_per_post ?? 3);
    const max = Number.isFinite(requestedMax) ? Math.min(20, Math.max(1, requestedMax)) : 3;
    const { error } = await admin.from('app_settings').upsert({
      id: 1,
      telegram_bot_token: token,
      telegram_webhook_secret: submittedSecret || existing?.telegram_webhook_secret || null,
      max_channels_per_post: max,
      updated_at: new Date().toISOString(),
    });
    if (error) return privateJson({ error: `Telegram token is valid, but Supabase could not save it: ${error.message}` }, 500);

    return privateJson({ ok: true, bot: { id: bot.id, username: bot.username }, token: maskToken(token), max_channels_per_post: max });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : 'Telegram token validation failed.' }, 422);
  }
}
