import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'placeholder-service-role-key';

export const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

export function supabaseAdminConfigError() {
  if (url.includes('placeholder') || key === 'placeholder-service-role-key') {
    return 'Supabase server configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the deployment environment.';
  }
  return null;
}
