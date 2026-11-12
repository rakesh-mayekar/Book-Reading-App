import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

/** Public values only (project URL + publishable key). Never put a secret/service-role key in this app. */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key && /^https?:\/\//.test(url));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, key as string, {
      auth: {
        flowType: 'pkce',
        persistSession: true, // restores the session after the app/site is reopened
        autoRefreshToken: true,
        detectSessionInUrl: false, // callback URLs are handled explicitly (web route + Android deep link)
        storageKey: 'book-reading-auth',
      },
    })
  : null;

export const APP_SCHEME = 'com.bookreading.prototype';
export type AuthLinkKind = 'callback' | 'recovery';

/** Where Supabase sends the user after tapping an email link. Must be in the Supabase redirect allow-list. */
export function redirectUrl(kind: AuthLinkKind, native = Capacitor.isNativePlatform(), origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return native ? `${APP_SCHEME}://auth/${kind}` : `${origin}/auth/${kind}`;
}

export interface ParsedAuthLink {
  kind: AuthLinkKind | null;
  code: string | null;
  error: string | null;
}
/** Understands both https://site/auth/callback?code=… and com.bookreading.prototype://auth/callback?code=… */
export function parseAuthLink(raw: string): ParsedAuthLink {
  try {
    const u = new URL(raw);
    const last = u.pathname.split('/').filter(Boolean).pop();
    const kind = last === 'callback' || last === 'recovery' ? last : null;
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    const error = u.searchParams.get('error_description') ?? hash.get('error_description') ?? u.searchParams.get('error') ?? hash.get('error');
    return { kind, code: u.searchParams.get('code'), error };
  } catch {
    return { kind: null, code: null, error: null };
  }
}

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
