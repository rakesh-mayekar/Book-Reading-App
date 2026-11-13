import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Session, User } from '@supabase/supabase-js';
import { buildAccountDb, fetchAccountData, updateProfile } from './cloud';
import { isSupabaseConfigured, OTP_RESEND_SECONDS, supabase } from './config';
import { describeAuthError, type AuthFailure } from './otp';
import { clearPending } from './pending';
import { enterAccount, flushCloud, leaveAccount } from '../store/store';

/** 'recovery' = the user proved ownership of the email with a reset code and must now choose a new password. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'recovery' | 'error';
export type AuthResult = { ok: true; needsVerification?: boolean } | ({ ok: false } & AuthFailure);

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  error: string;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  verifySignupOtp: (email: string, code: string) => Promise<AuthResult>;
  resendSignupOtp: (email: string) => Promise<AuthResult>;
  sendRecoveryCode: (email: string) => Promise<AuthResult>;
  verifyRecoveryOtp: (email: string, code: string) => Promise<AuthResult>;
  completeRecovery: (password: string) => Promise<AuthResult>;
  cancelRecovery: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

const RECOVERY_FLAG = 'br-recovery-pending';
const readFlag = () => {
  try {
    return localStorage.getItem(RECOVERY_FLAG) === '1';
  } catch {
    return false;
  }
};
const setFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(RECOVERY_FLAG, '1');
    else localStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* ignore */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'signedOut');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const loadedId = useRef<string | null>(null);
  const loading = useRef<string | null>(null);
  const recovery = useRef<boolean>(readFlag());
  const statusRef = useRef<AuthStatus>(status);
  statusRef.current = status;

  const load = useCallback(async (u: User) => {
    if (loading.current === u.id) return;
    loading.current = u.id;
    setStatus('loading');
    try {
      const data = await fetchAccountData(u.id);
      // Make sure the display name chosen at sign-up is on the profile row.
      const metaName = typeof u.user_metadata?.display_name === 'string' ? u.user_metadata.display_name.trim() : '';
      if (!data.profile.display_name && metaName) {
        await updateProfile(u.id, { display_name: metaName.slice(0, 80) });
        data.profile.display_name = metaName.slice(0, 80);
      }
      enterAccount(buildAccountDb({ id: u.id, email: u.email ?? '' }, data));
      loadedId.current = u.id;
      setUser(u);
      setError('');
      setStatus('signedIn');
    } catch (e) {
      setError(describeAuthError(e as Error, 'login').message);
      setStatus('error');
    } finally {
      loading.current = null;
    }
  }, []);

  const sync = useCallback(
    (session: Session | null) => {
      if (recovery.current) {
        // Reset-code session: stay on "New password"; do not load account data or open Discover.
        if (session) {
          setUser(session.user);
          setStatus('recovery');
        } else {
          recovery.current = false;
          setFlag(false);
          setUser(null);
          setStatus('signedOut');
        }
        return;
      }
      if (!session) {
        if (loadedId.current) {
          leaveAccount(); // clear the previous user's visible data
          loadedId.current = null;
        }
        setUser(null);
        setStatus('signedOut');
        return;
      }
      if (session.user.id === loadedId.current) {
        setUser(session.user);
        return;
      }
      if (loadedId.current) {
        leaveAccount(); // account changed: drop the old user's data before loading the new one
        loadedId.current = null;
      }
      void load(session.user);
    },
    [load],
  );

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => sync(session), 0); // never await Supabase calls inside this callback
    });
    return () => data.subscription.unsubscribe();
  }, [sync]);

  // Android: pause/resume token refresh with the app; hardware Back never leaves the New-password step by accident.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const subs = [
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!supabase) return;
        if (isActive) void supabase.auth.startAutoRefresh();
        else {
          void flushCloud();
          void supabase.auth.stopAutoRefresh();
        }
      }),
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (statusRef.current === 'recovery') return;
        if (canGoBack) window.history.back();
        else void CapApp.exitApp();
      }),
    ];
    return () => subs.forEach((s) => void s.then((h) => h.remove()));
  }, []);

  const api = useMemo<AuthCtx>(() => {
    const sb = () => {
      if (!supabase) throw new Error('Accounts are not configured in this build.');
      return supabase;
    };
    const fail = (e: unknown, action: Parameters<typeof describeAuthError>[1]): AuthResult => ({ ok: false, ...describeAuthError(e as Error, action, OTP_RESEND_SECONDS) });
    return {
      status,
      user,
      error,
      async signUp(email, password, displayName) {
        const { data, error: e } = await sb().auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } });
        if (e) return fail(e, 'signup');
        return { ok: true, needsVerification: !data.session };
      },
      async signIn(email, password) {
        const { error: e } = await sb().auth.signInWithPassword({ email: email.trim(), password });
        return e ? fail(e, 'login') : { ok: true };
      },
      async verifySignupOtp(email, code) {
        const { error: e } = await sb().auth.verifyOtp({ email: email.trim(), token: code, type: 'signup' });
        return e ? fail(e, 'verify') : { ok: true };
      },
      async resendSignupOtp(email) {
        const { error: e } = await sb().auth.resend({ type: 'signup', email: email.trim() });
        return e ? fail(e, 'send') : { ok: true };
      },
      async sendRecoveryCode(email) {
        // Supabase answers the same whether or not the address is registered.
        const { error: e } = await sb().auth.resetPasswordForEmail(email.trim());
        return e ? fail(e, 'send') : { ok: true };
      },
      async verifyRecoveryOtp(email, code) {
        recovery.current = true; // set first so the SIGNED_IN event keeps us on "New password"
        setFlag(true);
        const { data, error: e } = await sb().auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
        if (e || !data.session) {
          recovery.current = false;
          setFlag(false);
          return e ? fail(e, 'verify') : fail({ message: 'Verification failed.' }, 'verify');
        }
        setUser(data.session.user);
        setStatus('recovery');
        return { ok: true };
      },
      async completeRecovery(password) {
        const { error: e } = await sb().auth.updateUser({ password });
        if (e) return fail(e, 'password');
        // Keep the recovery flag set until sign-out finishes so the USER_UPDATED event can't load account data.
        await sb().auth.signOut({ scope: 'local' }).catch(() => {});
        recovery.current = false;
        setFlag(false);
        leaveAccount();
        loadedId.current = null;
        setUser(null);
        setStatus('signedOut');
        return { ok: true };
      },
      async cancelRecovery() {
        recovery.current = false;
        setFlag(false);
        if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setUser(null);
        setStatus('signedOut');
      },
      async signOut() {
        await flushCloud();
        if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        leaveAccount();
        clearPending();
        loadedId.current = null;
        setUser(null);
        setStatus('signedOut');
      },
      retry() {
        void sb().auth.getSession().then(({ data }) => {
          loading.current = null;
          sync(data.session);
        });
      },
    };
  }, [status, user, error, sync]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
