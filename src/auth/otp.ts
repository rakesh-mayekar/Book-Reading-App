/** Pure helpers for the email-OTP flows (no secrets are logged or stored here). */

export function intEnv(v: string | undefined, def: number, min: number, max: number): number {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Keep digits only (handles pasted "123 456", "123-456", full-width digits) and cap at the code length. */
export function sanitizeOtp(raw: string, length: number): string {
  const ascii = raw.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  return ascii.replace(/\D/g, '').slice(0, length);
}

/** "…you can only request this after 49 seconds." -> 49 */
export function cooldownFromMessage(msg: string): number | null {
  const m = /after\s+(\d+)\s*(?:second|sec)/i.exec(msg);
  return m ? parseInt(m[1], 10) : null;
}

export interface AuthFailure {
  message: string;
  unverified?: boolean;
  /** Seconds the user must wait before requesting another code. */
  cooldown?: number;
}
interface ErrLike { message?: string; code?: string; status?: number; name?: string }

export type AuthAction = 'login' | 'signup' | 'verify' | 'send' | 'password';

/** Maps Supabase errors to short, actionable messages. Unknown errors are shown as-is (never hidden). */
export function describeAuthError(e: ErrLike, action: AuthAction, defaultCooldown = 60): AuthFailure {
  const msg = e.message ?? 'Something went wrong.';
  const low = msg.toLowerCase();
  const code = e.code ?? '';
  if (e.name === 'AuthRetryableFetchError' || low.includes('failed to fetch') || low.includes('network') || low.includes('load failed')) {
    return { message: 'Can’t reach the server. Check your connection and try again.' };
  }
  if (code === 'email_not_confirmed' || low.includes('email not confirmed')) {
    return { message: 'Your email isn’t verified yet. Verify it to continue.', unverified: true };
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e.status === 429 || low.includes('rate limit') || low.includes('security purposes')) {
    const secs = cooldownFromMessage(msg);
    if (secs) return { message: `Please wait ${secs} seconds before requesting another code.`, cooldown: secs };
    return { message: 'Too many requests. Wait a few minutes before trying again.', cooldown: defaultCooldown };
  }
  if (action === 'verify' && (code === 'otp_expired' || low.includes('expired') || low.includes('invalid'))) {
    return { message: 'That code is incorrect, expired or already used. Check it, or request a new code.' };
  }
  if (code === 'invalid_credentials' || low.includes('invalid login')) return { message: 'Email or password is incorrect.' };
  if (code === 'same_password' || low.includes('different from the old')) return { message: 'Choose a password different from your current one.' };
  if (code === 'weak_password' || low.includes('password should')) return { message: 'Choose a stronger password (at least 8 characters).' };
  if (code === 'user_already_exists' || low.includes('already registered')) return { message: 'An account with this email already exists. Log in instead.' };
  return { message: msg };
}
