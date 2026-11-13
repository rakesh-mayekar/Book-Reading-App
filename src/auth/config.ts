import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { intEnv } from './otp';

/** Public values only (project URL + publishable key). Never put a secret/service-role key in this app. */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key && /^https?:\/\//.test(url));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: {
        persistSession: true, // restores the session after the app/site is reopened
        autoRefreshToken: true,
        detectSessionInUrl: false, // email OTP codes are typed in; no URL callbacks are used
        storageKey: 'book-reading-auth',
      },
    })
  : null;

/** Must equal Supabase → Authentication → Email → "Email OTP Length" (default 6). */
export const OTP_LENGTH = intEnv(import.meta.env.VITE_OTP_LENGTH as string | undefined, 6, 4, 10);
/** Should equal Supabase's minimum interval between emails per user (default 60s). */
export const OTP_RESEND_SECONDS = intEnv(import.meta.env.VITE_OTP_RESEND_SECONDS as string | undefined, 60, 1, 600);

export function validateEmail(v: string): string {
  const e = v.trim();
  if (!e) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'Enter a valid email address.';
  return '';
}
export function validatePassword(v: string): string {
  if (!v) return 'Enter a password.';
  if (v.length < 8) return 'Use at least 8 characters.';
  return '';
}
