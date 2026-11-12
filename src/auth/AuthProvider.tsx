import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Session, User } from '@supabase/supabase-js';
import { buildAccountDb, fetchAccountData } from './cloud';
import { isSupabaseConfigured, parseAuthLink, redirectUrl, supabase } from './config';
import { enterAccount, flushCloud, leaveAccount } from '../store/store';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error';
export type AuthResult = { ok: true; needsVerification?: boolean } | { ok: false; message: string; unverified?: boolean };

interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  error: string;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  resend: (email: string) => Promise<AuthResult>;
  exchangeCode: (code: string) => Promise<AuthResult>;
  retry: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

const friendly = (m: string): string => {
  const s = m.toLowerCase();
  if (s.includes('invalid login')) return 'Email or password is incorrect.';
  if (s.includes('rate limit') || s.includes('security purposes')) return 'Too many attempts. Wait a minute and try again.';
  if (s.includes('weak') || s.includes('password should')) return 'Choose a stronger password (at least 8 characters).';
  if (s.includes('same password')) return 'Choose a password different from your current one.';
  if (s.includes('fetch') || s.includes('network')) return 'Can’t reach the server. Check your connection.';
  return m;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'signedOut');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const loadedId = useRef<string | null>(null);
  const loading = useRef<string | null>(null);

  const load = useCallback(async (u: User) => {
    if (loading.current === u.id) return;
    loading.current = u.id;
    setStatus('loading');
    try {
      const data = await fetchAccountData(u.id);
      enterAccount(buildAccountDb({ id: u.id, email: u.email ?? '' }, data));
      loadedId.current = u.id;
      setUser(u);
      setError('');
      setStatus('signedIn');
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : 'Couldn’t load your account.'));
      setStatus('error');
    } finally {
      loading.current = null;
    }
  }, []);

  const sync = useCallback(
    (session: Session | null) => {
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
      // never await Supabase calls inside this callback; defer.
      setTimeout(() => sync(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [sync]);

  // Android: pause/resume token refresh with the app; open email links delivered as deep links.
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return;
    const subs = [
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void supabase!.auth.startAutoRefresh();
        else {
          void flushCloud();
          void supabase!.auth.stopAutoRefresh();
        }
      }),
      CapApp.addListener('appUrlOpen', ({ url }) => {
        const link = parseAuthLink(url);
        if (!link.kind) return;
        const q = new URLSearchParams();
        if (link.code) q.set('code', link.code);
        if (link.error) q.set('error_description', link.error);
        navigate(`/auth/${link.kind}?${q.toString()}`, { replace: true });
      }),
    ];
    return () => subs.forEach((s) => void s.then((h) => h.remove()));
  }, [navigate]);

  const api = useMemo<AuthCtx>(() => {
    const need = () => {
      if (!supabase) throw new Error('Accounts are not configured in this build.');
      return supabase;
    };
    return {
      status,
      user,
      error,
      async signUp(email, password, displayName) {
        const { data, error: e } = await need().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl('callback'), data: { display_name: displayName.trim() } },
        });
        if (e) return { ok: false, message: friendly(e.message) };
        return { ok: true, needsVerification: !data.session };
      },
      async signIn(email, password) {
        const { error: e } = await need().auth.signInWithPassword({ email: email.trim(), password });
        if (e) return { ok: false, message: e.message.toLowerCase().includes('not confirmed') ? 'Verify your email first. Check your inbox for the link.' : friendly(e.message), unverified: e.message.toLowerCase().includes('not confirmed') };
        return { ok: true };
      },
      async signOut() {
        await flushCloud();
        if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        leaveAccount();
        loadedId.current = null;
        setUser(null);
        setStatus('signedOut');
      },
      async sendReset(email) {
        const { error: e } = await need().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl('recovery') });
        return e ? { ok: false, message: friendly(e.message) } : { ok: true };
      },
      async updatePassword(password) {
        const { error: e } = await need().auth.updateUser({ password });
        return e ? { ok: false, message: friendly(e.message) } : { ok: true };
      },
      async resend(email) {
        const { error: e } = await need().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl('callback') } });
        return e ? { ok: false, message: friendly(e.message) } : { ok: true };
      },
      async exchangeCode(code) {
        const { error: e } = await need().auth.exchangeCodeForSession(code);
        return e ? { ok: false, message: e.message } : { ok: true };
      },
      retry() {
        void need().auth.getSession().then(({ data }) => {
          loading.current = null;
          sync(data.session);
        });
      },
    };
  }, [status, user, error, sync]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
