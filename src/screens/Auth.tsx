import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheck, MailCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured, validateEmail, validatePassword } from '../auth/config';
import { setMode } from '../store/store';
import { Page, toast } from '../components/Shell';
import { Button, Ico, Notice, TextField } from '../components/ui';

function AuthFrame({ title, sub, children, back }: { title: string; sub?: string; children: React.ReactNode; back?: string }) {
  return (
    <Page noBack={!back} fallback={back ?? '/auth'}>
      <div className="stack" style={{ paddingTop: 8 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--dark)', color: '#fff', display: 'grid', placeItems: 'center' }}><Ico i={Sparkles} size={24} /></div>
        <div className="stack-sm"><h1 className="t-title">{title}</h1>{sub && <p className="t-meta">{sub}</p>}</div>
        {children}
      </div>
    </Page>
  );
}

/** Log in / Sign up */
export function AuthScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [sent, setSent] = useState(false);
  const [cool, setCool] = useState(0);
  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool(cool - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  if (auth.status === 'signedIn') return <Navigate to="/" replace />;
  const errors = { name: tab === 'signup' && name.trim().length < 2 ? 'Enter your name.' : '', email: validateEmail(email), password: tab === 'signup' ? validatePassword(password) : password ? '' : 'Enter your password.' };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setMsg('');
    setUnverified(false);
    if (invalid || busy) return;
    setBusy(true);
    const r = tab === 'login' ? await auth.signIn(email, password) : await auth.signUp(email, password, name);
    setBusy(false);
    if (!r.ok) {
      setMsg(r.message);
      setUnverified(!!r.unverified);
    } else if (tab === 'signup' && r.needsVerification) {
      setSent(true);
      setCool(30);
    }
  };
  const resend = async () => {
    if (cool > 0) return;
    const r = await auth.resend(email);
    setCool(30);
    toast(r.ok ? 'Verification email sent' : r.message);
  };

  if (sent)
    return (
      <AuthFrame title="Check your email" sub={`We sent a verification link to ${email.trim()}. Open it on this device to finish creating your account.`}>
        <Notice icon={MailCheck}>Can’t find it? Check spam, or resend after a short wait. The link expires, and you can request a new one.</Notice>
        <Button variant="secondary" disabled={cool > 0} onClick={resend}>{cool > 0 ? `Resend in ${cool}s` : 'Resend verification email'}</Button>
        <button className="btn-link" onClick={() => { setSent(false); setTab('login'); }}>Back to log in</button>
      </AuthFrame>
    );

  return (
    <AuthFrame title="Stories" sub="Sign in to keep your bookmarks and reading progress on every device.">
      {!isSupabaseConfigured && <Notice icon={TriangleAlert} tone="warn">Accounts aren’t configured in this build (missing Supabase environment variables). Demo mode still works.</Notice>}
      <div role="tablist" aria-label="Account" className="segment">
        <button role="tab" aria-selected={tab === 'login'} onClick={() => { setTab('login'); setMsg(''); }}>Log in</button>
        <button role="tab" aria-selected={tab === 'signup'} onClick={() => { setTab('signup'); setMsg(''); }}>Create account</button>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        {tab === 'signup' && <TextField label="Your name" value={name} onChange={setName} error={tried ? errors.name : ''} autoComplete="name" />}
        <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={tried ? errors.email : ''} autoComplete="email" autoCapitalize="none" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} error={tried ? errors.password : ''} help={tab === 'signup' ? 'At least 8 characters.' : undefined} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        {unverified && <Button variant="secondary" disabled={cool > 0} onClick={resend}>{cool > 0 ? `Resend in ${cool}s` : 'Resend verification email'}</Button>}
        <Button type="submit" loading={busy} disabled={!isSupabaseConfigured}>{tab === 'login' ? 'Log in' : 'Create account'}</Button>
        {tab === 'login' && <Link className="btn-link" to="/auth/forgot">Forgot password?</Link>}
      </form>
      <div className="card stack-sm">
        <p className="t-h3">Just looking around?</p>
        <p className="t-help">Demo mode uses sample data stored only on this device. It isn’t connected to any account.</p>
        <Button variant="secondary" onClick={() => { setMode('demo'); navigate('/', { replace: true }); }}>Continue in demo mode</Button>
      </div>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');
  const err = validateEmail(email);
  return (
    <AuthFrame back="/auth" title="Reset password" sub="Enter your email and we’ll send a link to choose a new password.">
      {done ? (
        <Notice icon={MailCheck} tone="ok">If an account exists for {email.trim()}, a reset link is on its way. Open it on this device.</Notice>
      ) : (
        <form className="stack" noValidate onSubmit={async (e) => { e.preventDefault(); setTried(true); if (err || busy) return; setBusy(true); const r = await auth.sendReset(email); setBusy(false); if (r.ok) setDone(true); else setMsg(r.message); }}>
          <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={tried ? err : ''} autoComplete="email" autoCapitalize="none" />
          {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
          <Button type="submit" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthFrame>
  );
}

const handled = new Set<string>();

/** Landing page for email links (web route and Android deep link). kind = callback | recovery */
export function AuthCallback({ kind }: { kind: 'callback' | 'recovery' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'confirmed' | 'error'>('working');
  const [message, setMessage] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const err = params.get('error_description') ?? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description');
    (async () => {
      if (err) { setMessage(err.replace(/\+/g, ' ')); setState('error'); return; }
      if (!code) { setMessage('This link is incomplete. Request a new one.'); setState('error'); return; }
      if (handled.has(code)) return;
      handled.add(code);
      const r = await auth.exchangeCode(code);
      if (r.ok) {
        toast(kind === 'callback' ? 'Email verified. You’re signed in.' : 'Choose a new password.');
        navigate(kind === 'callback' ? '/' : '/auth/reset', { replace: true });
      } else if (kind === 'callback') {
        // The email is confirmed by Supabase before redirecting; only the sign-in step needs this device's login.
        setState('confirmed');
      } else {
        setMessage('This reset link can’t be used here. Open it on the device where you requested it, or request a new link.');
        setState('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AuthFrame title={state === 'working' ? 'One moment…' : state === 'confirmed' ? 'Email confirmed' : 'Link problem'}>
      {state === 'working' && <div className="row"><span className="spinner" aria-hidden="true" /><span className="t-meta" role="status">Checking your link…</span></div>}
      {state === 'confirmed' && <><Notice icon={CircleCheck} tone="ok">Your email is verified. Log in with your password to continue.</Notice><Link className="btn btn-primary block" to="/auth">Go to log in</Link></>}
      {state === 'error' && <><Notice icon={TriangleAlert} tone="err">{message}</Notice><Link className="btn btn-primary block" to={kind === 'recovery' ? '/auth/forgot' : '/auth'}>{kind === 'recovery' ? 'Request a new link' : 'Back to log in'}</Link></>}
    </AuthFrame>
  );
}

export function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (auth.status === 'loading') return <Splash />;
  if (auth.status !== 'signedIn') return <Navigate to="/auth/forgot" replace />;
  const errors = { pw: validatePassword(pw), pw2: pw2 !== pw ? 'Passwords don’t match.' : '' };
  return (
    <AuthFrame title="Choose a new password">
      <form className="stack" noValidate onSubmit={async (e) => { e.preventDefault(); setTried(true); if (errors.pw || errors.pw2 || busy) return; setBusy(true); const r = await auth.updatePassword(pw); setBusy(false); if (r.ok) { toast('Password updated'); navigate('/', { replace: true }); } else setMsg(r.message); }}>
        <TextField label="New password" type="password" value={pw} onChange={setPw} error={tried ? errors.pw : ''} autoComplete="new-password" help="At least 8 characters." />
        <TextField label="Confirm password" type="password" value={pw2} onChange={setPw2} error={tried ? errors.pw2 : ''} autoComplete="new-password" />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        <Button type="submit" loading={busy}>Update password</Button>
      </form>
    </AuthFrame>
  );
}

export function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="page onboard" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <span className="spinner" aria-hidden="true" />
      <p className="t-meta" role="status">Loading your account…</p>
      {children}
    </div>
  );
}
