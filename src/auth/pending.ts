/** Remembers which email is mid-verification so a reload/Android back doesn't lose the screen. Never stores passwords or codes. */
export type OtpPurpose = 'signup' | 'recovery';
export interface PendingOtp { email: string; name?: string; purpose: OtpPurpose; resendAt: number }
const KEY = 'br-otp-pending';

export function readPending(purpose?: OtpPurpose): PendingOtp | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as PendingOtp | null;
    return p && (!purpose || p.purpose === purpose) ? p : null;
  } catch {
    return null;
  }
}
export function writePending(p: PendingOtp) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
export function clearPending() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
export const secondsLeft = (resendAt: number, now = Date.now()) => Math.max(0, Math.ceil((resendAt - now) / 1000));
