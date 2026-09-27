import { NextResponse } from 'next/server';
import { admin, supabaseAdminConfigError } from '../../../../lib/supabase/admin';
import { getMe } from '../../../../lib/telegram/actions';

export async function POST() {
  const configError = supabaseAdminConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 500 });

  const { data, error } = await admin
    .from('app_settings')
    .select('telegram_bot_token')
    .eq('id', 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: `Could not read the saved bot token from Supabase: ${error.message}` }, { status: 500 });

  const token = data?.telegram_bot_token?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'No bot token is configured. Save a token first.' }, { status: 422 });

  try {
    const bot = await getMe(token);
    return NextResponse.json({ ok: true, bot: { id: bot.id, username: bot.username } });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Telegram could not validate the saved bot token.' }, { status: 422 });
  }
}
