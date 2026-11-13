import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured, OTP_LENGTH, OTP_RESEND_SECONDS, validateEmail, validatePassword } from '../auth/config';
import { sanitizeOtp } from '../auth/otp';
import { clearPending, readPending, secondsLeft, writePending, type OtpPurpose } from '../auth/pending';
import { setMode } from '../store/store';
import { Page, toast } from '../components/Shell';
import { Button, Ico, Notice, TextField } from '../components/ui';
import { useId } from 'react';

function AuthFrame({ title, sub, children, back, noBack }: { title: string; sub?: string; children: React.ReactNode; back?: string; noBack?: boolean }) {
  return (
    <Page noBack={noBack ?? !back} fallback={back ?? '/auth'}>
      <div className="stack" style={{ paddingTop: 8 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--dark)', color: '#fff', display: 'grid', placeItems: 'center' }}><Ico i={Sparkles} size={24} /></div>
        <div className="stack-sm"><h1 className="t-title">{title}</h1>{sub && <p className="t-meta">{sub}</p>}</div>
        {children}
      </div>
    </Page>
  );
}

function OtpInput({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Verification code</label>
      <input
        id={id}
        className="input otp"
        value={value}
        onChange={(e) => onChange(sanitizeOtp(e.target.value, OTP_LENGTH))}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={'•'.repeat(OTP_LENGTH)}
        aria-invalid={!!error}
        aria-describedby={`${id}-d`}
        disabled={disabled}
      />
      <div id={`${id}-d`}>{error ? <p className="t-error" role="alert">{error}</p> : <p className="t-help">Enter the {OTP_LENGTH}-digit code. You can paste it.</p>}</div>
    </div>
  );
}

interface LoginState { tab?: 'login' | 'signup'; email?: string; name?: string; notice?: string }

/** Log in / Create account */
export function AuthScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const st = (loc.state ?? {}) as LoginState;
  const [tab, setTab] = useState<'login' | 'signup'>(st.tab ?? 'login');
  const [name, setName] = useState(st.name ?? '');
  const [email, setEmail] = useState(st.email ?? '');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [msg, setMsg] = useState('');
  const [unverified, setUnverified] = useState(false);

  if (auth.status === 'signedIn') return <Navigate to="/" replace />;
  if (auth.status === 'recovery') return <Navigate to="/auth/reset" replace />;
  const errors = { name: tab === 'signup' && name.trim().length < 2 ? 'Enter your name.' : '', email: validateEmail(email), password: tab === 'signup' ? validatePassword(password) : password ? '' : 'Enter your password.' };
  const invalid = Object.values(errors).some(Boolean);

  const toVerify = (cooldownSecs: number) => {
    writePending({ email: email.trim(), name: name.trim(), purpose: 'signup', resendAt: Date.now() + cooldownSecs * 1000 });
    navigate('/auth/verify');
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setMsg('');
    setUnverified(false);
    if (invalid || lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = tab === 'login' ? await auth.signIn(email, password) : await auth.signUp(email, password, name);
    lock.current = false;
    setBusy(false);
    if (!r.ok) {
      if (tab === 'signup' && r.cooldown) return afterSignupError(r);
      setMsg(r.message);
      setUnverified(!!r.unverified);
    } else if (tab === 'signup' && r.needsVerification) {
      toVerify(OTP_RESEND_SECONDS);
    }
  };
  const afterSignupError = (r: { ok: false; message: string; cooldown?: number }) => {
    // A code for this address was sent moments ago: go and enter it instead of dead-ending.
    if (tab === 'signup' && r.cooldown) toVerify(r.cooldown);
  };
  const verifyExisting = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = await auth.resendSignupOtp(email); // a fresh code, then the verification screen
    lock.current = false;
    setBusy(false);
    if (r.ok) toVerify(OTP_RESEND_SECONDS);
    else if (r.cooldown) toVerify(r.cooldown); // a code was sent recently: go enter it
    else setMsg(r.message);
  };

  return (
    <AuthFrame title="Stories" sub="Sign in to keep your bookmarks and reading progress on every device.">
      {st.notice && <Notice icon={MailCheck} tone="ok">{st.notice}</Notice>}
      {!isSupabaseConfigured && <Notice icon={TriangleAlert} tone="warn">Accounts aren’t configured in this build (missing Supabase environment variables). Demo mode still works.</Notice>}
      <div role="tablist" aria-label="Account" className="segment">
        <button role="tab" aria-selected={tab === 'login'} onClick={() => { setTab('login'); setMsg(''); setUnverified(false); }}>Log in</button>
        <button role="tab" aria-selected={tab === 'signup'} onClick={() => { setTab('signup'); setMsg(''); setUnverified(false); }}>Create account</button>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        {tab === 'signup' && <TextField label="Display name" value={name} onChange={setName} error={tried ? errors.name : ''} autoComplete="name" maxLength={80} />}
        <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={tried ? errors.email : ''} autoComplete="email" autoCapitalize="none" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} error={tried ? errors.password : ''} help={tab === 'signup' ? 'At least 8 characters.' : undefined} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        {unverified && <Button variant="secondary" loading={busy} onClick={verifyExisting}>Verify my email</Button>}
        <Button type="submit" loading={busy && !unverified} disabled={!isSupabaseConfigured}>{tab === 'login' ? 'Log in' : 'Create account'}</Button>
        {tab === 'login' && <Link className="btn-link" to="/auth/forgot" state={{ email }}>Forgot password?</Link>}
      </form>
      <div className="card stack-sm">
        <p className="t-h3">Just looking around?</p>
        <p className="t-help">Demo mode uses sample data stored only on this device. It isn’t connected to any account.</p>
        <Button variant="secondary" onClick={() => { setMode('demo'); navigate('/', { replace: true }); }}>Continue in demo mode</Button>
      </div>
    </AuthFrame>
  );
}

/** One screen for both "Verify your email" (signup) and the password-reset code. */
export function OtpScreen({ purpose }: { purpose: OtpPurpose }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pending = readPending(purpose);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [left, setLeft] = useState(() => (pending ? secondsLeft(pending.resendAt) : 0));
  const verifyLock = useRef(false);
  const resendLock = useRef(false);
  const lastTried = useRef('');
  const signup = purpose === 'signup';

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setLeft(secondsLeft(pending.resendAt)), 500);
    return () => clearInterval(t);
  }, [pending?.resendAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (value = code) => {
    if (!pending || value.length !== OTP_LENGTH || verifyLock.current) return;
    verifyLock.current = true;
    lastTried.current = value;
    setBusy(true);
    setError('');
    const r = signup ? await auth.verifySignupOtp(pending.email, value) : await auth.verifyRecoveryOtp(pending.email, value);
    verifyLock.current = false;
    if (!r.ok) {
      setBusy(false);
      setError(r.message);
      return;
    }
    clearPending();
    if (signup) toast('Email verified');
    else navigate('/auth/reset', { replace: true });
    // signup: the auth listener loads the account, then this screen redirects to Discover
    setBusy(false);
  };

  // Auto-submit once a full code is entered (once per distinct code).
  useEffect(() => {
    if (code.length === OTP_LENGTH && code !== lastTried.current) void verify(code);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const resend = async () => {
    if (!pending || left > 0 || resendLock.current) return;
    resendLock.current = true;
    setResending(true);
    setError('');
    const r = signup ? await auth.resendSignupOtp(pending.email) : await auth.sendRecoveryCode(pending.email);
    resendLock.current = false;
    setResending(false);
    const secs = r.ok ? OTP_RESEND_SECONDS : (r.cooldown ?? 0);
    writePending({ ...pending, resendAt: Date.now() + secs * 1000 });
    setLeft(secs);
    if (r.ok) {
      setCode('');
      lastTried.current = '';
      toast('New code sent');
    } else setError(r.message);
  };

  if (!pending) return <Navigate to={signup ? '/auth' : '/auth/forgot'} replace />;
  if (signup && auth.status === 'signedIn') return <Navigate to="/" replace />;
  if (!signup && auth.status === 'recovery') return <Navigate to="/auth/reset" replace />;

  const working = busy || (signup && auth.status === 'loading');
  return (
    <AuthFrame back={signup ? '/auth' : '/auth/forgot'} title={signup ? 'Verify your email' : 'Enter reset code'}
      sub={signup ? `We sent a ${OTP_LENGTH}-digit code to ${pending.email}.` : `If an account exists for ${pending.email}, we sent a ${OTP_LENGTH}-digit code.`}>
      <OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(''); }} error={error} disabled={working} />
      <Button loading={working} disabled={code.length !== OTP_LENGTH} onClick={() => void verify()}>{signup ? 'Verify email' : 'Verify code'}</Button>
      <Button variant="secondary" loading={resending} disabled={left > 0} onClick={() => void resend()}>{left > 0 ? `Resend code in ${left}s` : 'Resend code'}</Button>
      <div className="row between wrap">
        <button className="btn-link" onClick={() => { clearPending(); navigate(signup ? '/auth' : '/auth/forgot', { state: { tab: 'signup', email: pending.email, name: pending.name } }); }}>Use a different email</button>
        {signup && <Link className="btn-link" to="/auth" onClick={() => clearPending()}>Log in instead</Link>}
      </div>
      {signup && <p className="t-help">Didn’t get it? Check spam. If you already have an account with this email, no new code is sent, so log in instead.</p>}
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const st = (useLocation().state ?? {}) as LoginState;
  const [email, setEmail] = useState(st.email ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [msg, setMsg] = useState('');
  const err = validateEmail(email);
  if (auth.status === 'recovery') return <Navigate to="/auth/reset" replace />;
  return (
    <AuthFrame back="/auth" title="Reset password" sub="Enter your email and we’ll send a code to choose a new password.">
      <form className="stack" noValidate onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (err || lock.current) return;
        lock.current = true;
        setBusy(true);
        const r = await auth.sendRecoveryCode(email);
        lock.current = false;
        setBusy(false);
        if (r.ok || r.cooldown) {
          // identical acknowledgement whether or not the email is registered
          writePending({ email: email.trim(), purpose: 'recovery', resendAt: Date.now() + (r.ok ? OTP_RESEND_SECONDS : (r.cooldown ?? 0)) * 1000 });
          navigate('/auth/forgot/code');
        } else setMsg(r.message);
      }}>
        <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} error={tried ? err : ''} autoComplete="email" autoCapitalize="none" />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        <Button type="submit" loading={busy}>Send reset code</Button>
      </form>
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
  const lock = useRef(false);
  const [msg, setMsg] = useState('');
  const finished = useRef(false); // set once the password is saved, so the redirect below doesn't race the confirmation navigation
  if (auth.status === 'loading') return <Splash />;
  if (auth.status !== 'recovery') return finished.current ? null : <Navigate to="/auth" replace />;
  const errors = { pw: validatePassword(pw), pw2: pw2 !== pw ? 'Passwords don’t match.' : '' };
  return (
    <AuthFrame noBack title="New password" sub="Code verified. Choose a new password for your account.">
      <form className="stack" noValidate onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (errors.pw || errors.pw2 || lock.current) return;
        lock.current = true;
        setBusy(true);
        const email = auth.user?.email ?? '';
        finished.current = true;
        const r = await auth.completeRecovery(pw);
        if (!r.ok) finished.current = false;
        lock.current = false;
        setBusy(false);
        if (r.ok) {
          clearPending();
          navigate('/auth', { replace: true, state: { email, notice: 'Password updated. Log in with your new password.' } satisfies LoginState });
        } else setMsg(r.message);
      }}>
        <TextField label="New password" type="password" value={pw} onChange={setPw} error={tried ? errors.pw : ''} autoComplete="new-password" help="At least 8 characters." />
        <TextField label="Confirm password" type="password" value={pw2} onChange={setPw2} error={tried ? errors.pw2 : ''} autoComplete="new-password" />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        <Button type="submit" loading={busy}>Save new password</Button>
        <button type="button" className="btn-link" onClick={() => void auth.cancelRecovery().then(() => navigate('/auth', { replace: true }))}>Cancel and log in</button>
      </form>
    </AuthFrame>
  );
}

export function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <span className="spinner" aria-hidden="true" />
      <p className="t-meta" role="status">Loading your account…</p>
      {children}
    </div>
  );
}
