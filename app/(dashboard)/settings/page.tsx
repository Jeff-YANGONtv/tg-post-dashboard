'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Link2, Save, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DashboardShell } from '../../../components/dashboard-shell';

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export default function Settings() {
  const [token, setToken] = useState('');
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [maxChannels, setMaxChannels] = useState('3');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectingWebhook, setConnectingWebhook] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(readResponse<{ token: string | null; max_channels_per_post: number }>)
      .then((data) => {
        if (data.token) setMaskedToken(data.token);
        if (data.max_channels_per_post) setMaxChannels(String(data.max_channels_per_post));
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to load settings'));
  }, []);

  async function save() {
    if (!token.trim()) { toast.error('Enter a new bot token before saving'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegram_bot_token: token, max_channels_per_post: Number(maxChannels) }),
      });
      const data = await readResponse<{ token: string; bot: { username: string } }>(response);
      setMaskedToken(data.token);
      setToken('');
      toast.success(`Telegram token validated and connected as @${data.bot.username}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save bot token');
    } finally {
      setSaving(false);
    }
  }

  async function testSavedToken() {
    setTesting(true);
    try {
      const response = await fetch('/api/settings/test', { method: 'POST' });
      const data = await readResponse<{ bot: { username: string } }>(response);
      toast.success(`Telegram connection verified as @${data.bot.username}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not verify the saved bot token');
    } finally {
      setTesting(false);
    }
  }

  async function connectWebhook() {
    setConnectingWebhook(true);
    try {
      const response = await fetch('/api/settings/webhook', { method: 'POST' });
      const data = await readResponse<{ bot_username: string; url: string; last_error_message?: string | null; pending_update_count?: number }>(response);
      if (data.last_error_message) {
        toast.warning(`Telegram accepted the webhook, but its latest delivery failed: ${data.last_error_message}`);
      } else {
        toast.success(`Webhook connected for @${data.bot_username}`);
      }
      if (data.pending_update_count) toast.message(`${data.pending_update_count} Telegram update(s) are pending delivery.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not connect the Telegram webhook');
    } finally {
      setConnectingWebhook(false);
    }
  }

  return <DashboardShell>
    <Toaster theme="dark" />
    <div className="topline">
      <div>
        <div className="eyebrow">System / configuration</div>
        <h1 className="h1">Settings</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 7 }}>Credentials are stored server-side in Supabase and never returned in full.</div>
      </div>
      <button className="btn primary" onClick={() => void save()} disabled={saving}><Save size={14} />{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
    <div className="grid grid2">
      <div className="card">
        <div className="eyebrow">Telegram bot</div>
        <h2 style={{ fontSize: 18, margin: '5px 0 20px' }}>Connection</h2>
        <label className="label">Bot token {maskedToken && <span className="green">· configured as {maskedToken}</span>}</label>
        <input className="input" type="password" placeholder={maskedToken ? 'Enter a new token to replace it' : '123456789:AA…'} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
        <div style={{ display: 'flex', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void testSavedToken()} disabled={testing}><CheckCircle2 size={13} className="green" />{testing ? 'Testing…' : 'Test saved token'}</button>
          <button className="btn primary" onClick={() => void connectWebhook()} disabled={connectingWebhook}><Link2 size={13} />{connectingWebhook ? 'Connecting…' : 'Connect webhook'}</button>
        </div>
        <div className="notice" style={{ marginTop: 15 }}>Saving checks the token with Telegram <span className="mono">getMe</span>. The webhook button then configures the deployed HTTPS endpoint and keeps its shared secret in Supabase.</div>
      </div>
      <div className="card">
        <div className="eyebrow">Distribution rules</div>
        <h2 style={{ fontSize: 18, margin: '5px 0 20px' }}>Guardrails</h2>
        <label className="label">Maximum destination channels per post</label>
        <input className="input" type="number" min="1" max="20" value={maxChannels} onChange={(event) => setMaxChannels(event.target.value)} />
        <div className="notice" style={{ marginTop: 15 }}><ShieldCheck size={15} className="green" style={{ verticalAlign: 'middle', marginRight: 7 }} />Forwarded mode is automatically disabled for manually drafted posts.</div>
      </div>
    </div>
  </DashboardShell>;
}
