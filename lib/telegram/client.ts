import { admin } from '../supabase/admin';
const envToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
async function resolveToken(explicit?: string) {
  if (explicit?.trim()) return explicit.trim();
  const { data } = await admin.from('app_settings').select('telegram_bot_token').eq('id', 1).maybeSingle();
  return data?.telegram_bot_token?.trim() || envToken();
}
export type TelegramResponse<T> = { ok: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
export class TelegramError extends Error { constructor(message: string, public retryAfter?: number) { super(message); } }
export async function telegramCall<T>(method: string, body: Record<string, unknown> = {}, attempt = 0, token?: string): Promise<T> {
  const botToken = await resolveToken(token);
  if (!botToken) throw new TelegramError('Telegram bot token is not configured');
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data = (await res.json()) as TelegramResponse<T>;
  if (data.ok && data.result !== undefined) return data.result;
  if ((res.status === 429 || res.status >= 500) && attempt < 4) { const delay = (data.parameters?.retry_after ?? Math.min(2 ** attempt, 12)) * 1000; await new Promise(resolve => setTimeout(resolve, delay)); return telegramCall<T>(method, body, attempt + 1, token); }
  throw new TelegramError(data.description ?? `Telegram ${method} failed`, data.parameters?.retry_after);
}
