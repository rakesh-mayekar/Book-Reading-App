import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured, OTP_LENGTH, OTP_RESEND_SECONDS, supabase, validateEmail, validatePassword } from '../auth/config';
import { describeAuthError } from '../auth/otp';
import { sanitizeOtp } from '../auth/otp';
import { clearPending, readPending, secondsLeft, writePending, type OtpPurpose } from '../auth/pending';
import { setMode } from '../store/store';
import { Page, toast } from '../components/Shell';
import { Button, Notice, TextField } from '../components/ui';
import { COUNTRIES, countryByCode, DEFAULT_COUNTRY, formatNational, maskTarget, nationalDigits, toE164, validatePhone } from '../auth/phone';
import { useId } from 'react';

function AuthFrame({ title, sub, children, back, noBack, header }: { title: string; sub?: string; children: React.ReactNode; back?: string; noBack?: boolean; header?: string }) {
  return (
    <Page noBack={noBack ?? !back} fallback={back ?? '/auth'} title={header} centerTitle className="auth">
      <div className="stack" style={{ paddingTop: 8 }}>
        <div className="stack-sm"><h1 className="fm-h1" style={{ margin: 0 }}>{title}</h1>{sub && <p className="fm-sub">{sub}</p>}</div>
        {children}
      </div>
    </Page>
  );
}

function OtpInput({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>Verification code</label>
      <div className={`otp-boxes ${error ? 'bad' : ''}`} style={{ gridTemplateColumns: `repeat(${OTP_LENGTH}, 1fr)` }}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => <span key={i} className={`otp-box ${i === value.length ? 'cur' : ''}`} aria-hidden="true">{value[i] ?? ''}</span>)}
        <input
          id={id}
          className="otp-real"
          value={value}
          onChange={(e) => onChange(sanitizeOtp(e.target.value, OTP_LENGTH))}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={!!error}
          aria-describedby={`${id}-d`}
          disabled={disabled}
        />
      </div>
      <div id={`${id}-d`}>{error ? <p className="t-error" role="alert">{error}</p> : <p className="fm-sub">Enter the {OTP_LENGTH}-digit code. Never share this code with anyone.</p>}</div>
    </div>
  );
}

interface LoginState { tab?: 'login' | 'signup'; email?: string; name?: string; notice?: string }

/** Log in / Create account */
export function PasswordScreen() {
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
    <AuthFrame header="Log in with password" title={tab === 'login' ? 'Welcome back.' : 'Create your account.'} sub="Use your email and password. You can also use a one-time code instead." back="/auth">
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
        {tab === 'login' && <Link className="fm-link" to="/auth/forgot" state={{ email }}>Forgot password?</Link>}
        <Link className="fm-link" to="/auth">Use a one-time code instead</Link>
      </form>
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

  if (!pending) return <Navigate to={signup ? '/auth/password' : '/auth/forgot'} replace />;
  if (signup && auth.status === 'signedIn') return <Navigate to="/" replace />;
  if (!signup && auth.status === 'recovery') return <Navigate to="/auth/reset" replace />;

  const working = busy || (signup && auth.status === 'loading');
  return (
    <AuthFrame back={signup ? '/auth/password' : '/auth/forgot'} header="Verify code" title={signup ? 'Verify your email.' : 'Enter your reset code.'}
      sub={signup ? `We sent a ${OTP_LENGTH}-digit code to ${pending.email}.` : `If an account exists for ${pending.email}, we sent a ${OTP_LENGTH}-digit code.`}>
      <OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(''); }} error={error} disabled={working} />
      <Button loading={working} disabled={code.length !== OTP_LENGTH} onClick={() => void verify()}>{signup ? 'Verify email' : 'Verify code'}</Button>
      <Button variant="secondary" loading={resending} disabled={left > 0} onClick={() => void resend()}>{left > 0 ? `Resend code in ${left}s` : 'Resend code'}</Button>
      <div className="row between wrap">
        <button className="btn-link" onClick={() => { clearPending(); navigate(signup ? '/auth/password' : '/auth/forgot', { state: { tab: 'signup', email: pending.email, name: pending.name } }); }}>Use a different email</button>
        {signup && <Link className="btn-link" to="/auth/password" onClick={() => clearPending()}>Log in instead</Link>}
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
    <AuthFrame back="/auth/password" header="Forgot password?" title="Reset your password."  sub="Enter your email and we’ll send a code to choose a new password.">
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
  if (auth.status !== 'recovery') return finished.current ? null : <Navigate to="/auth/password" replace />;
  const errors = { pw: validatePassword(pw), pw2: pw2 !== pw ? 'Passwords don’t match.' : '' };
  return (
    <AuthFrame noBack header="Set a new password" title="Choose a new password." sub="Code verified. Choose a new password for your account.">
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
          navigate('/auth/password', { replace: true, state: { email, notice: 'Password updated. Log in with your new password.' } satisfies LoginState });
        } else setMsg(r.message);
      }}>
        <TextField label="New password" type="password" value={pw} onChange={setPw} error={tried ? errors.pw : ''} autoComplete="new-password" help="At least 8 characters." />
        <TextField label="Confirm password" type="password" value={pw2} onChange={setPw2} error={tried ? errors.pw2 : ''} autoComplete="new-password" />
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        <Button type="submit" loading={busy}>Save new password</Button>
        <button type="button" className="btn-link" onClick={() => void auth.cancelRecovery().then(() => navigate('/auth/password', { replace: true }))}>Cancel and log in</button>
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

/* ---------------- Passwordless sign-in: Phone / Email, country code, verify code, social ---------------- */
const COUNTRY_KEY = 'br-country';
const readCountry = () => { try { return countryByCode(sessionStorage.getItem(COUNTRY_KEY)); } catch { return DEFAULT_COUNTRY; } };

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
  );
}
function FacebookF() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#fff"/><path fill="#1877F2" d="M13.4 22v-8h2.7l.4-3.2h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.4V14h2.8v8z"/></svg>
  );
}

/** Log in / Sign up with a one-time code (Phone or Email) or Google / Facebook. */
export function AuthLanding({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const signup = mode === 'signup';
  const [tab, setTab] = useState<'phone' | 'email'>(((loc.state as { tab?: 'phone' | 'email' } | null)?.tab) ?? 'email');
  const [email, setEmail] = useState((loc.state as { email?: string } | null)?.email ?? '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(readCountry);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<'' | 'code' | 'google' | 'facebook'>('');
  const lock = useRef(false);
  const [msg, setMsg] = useState('');
  useEffect(() => setCountry(readCountry()), [loc.key]);
  if (auth.status === 'signedIn') return <Navigate to="/" replace />;
  if (auth.status === 'recovery') return <Navigate to="/auth/reset" replace />;
  const err = tab === 'email' ? validateEmail(email) : validatePhone(phone, country);
  const configured = isSupabaseConfigured;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setMsg('');
    if (err || lock.current || !configured) return;
    lock.current = true;
    setBusy('code');
    const value = tab === 'email' ? email.trim() : toE164(phone, country);
    const r = await auth.sendCode({ channel: tab, value }, signup);
    lock.current = false;
    setBusy('');
    if (r.ok || r.cooldown) {
      writePending({ email: value, purpose: 'code', channel: tab, create: signup, resendAt: Date.now() + (r.ok ? OTP_RESEND_SECONDS : (r.cooldown ?? 0)) * 1000 });
      navigate('/auth/code');
    } else setMsg(r.message);
  };
  const social = async (p: 'google' | 'facebook') => {
    if (lock.current || !configured) return;
    lock.current = true;
    setBusy(p);
    setMsg('');
    const r = await auth.signInWithProvider(p);
    lock.current = false;
    setBusy('');
    if (!r.ok) setMsg(r.message);
  };
  void params;
  return (
    <Page title={signup ? 'Sign up' : 'Log in'} centerTitle noBack={!signup} fallback="/auth" className="auth">
      <form className="stack" onSubmit={send} noValidate>
        <div role="tablist" aria-label="Sign-in method" className="auth-tabs">
          <button type="button" role="tab" aria-selected={tab === 'phone'} onClick={() => { setTab('phone'); setMsg(''); setTried(false); }}>Phone</button>
          <button type="button" role="tab" aria-selected={tab === 'email'} onClick={() => { setTab('email'); setMsg(''); setTried(false); }}>Email</button>
        </div>
        <h1 className="fm-h1" style={{ margin: 0 }}>{signup ? 'Begin your story.' : 'Your stories await.'}</h1>
        {!configured && <Notice icon={TriangleAlert} tone="warn">Accounts aren’t configured in this build (missing Supabase environment variables). Guest mode still works.</Notice>}
        {tab === 'email' ? (
          <TextField label="Email address" type="email" inputMode="email" value={email} onChange={setEmail} error={tried ? err : ''} placeholder="Enter email address" autoComplete="email" autoCapitalize="none"
            help="We’ll email a one-time code to securely access your Stories account." />
        ) : (
          <div className="field">
            <label htmlFor="ph">Phone number</label>
            <div className="phone-row">
              <Link to="/auth/country" state={{ back: signup ? '/auth/signup' : '/auth' }} className="country-btn" aria-label={`Country code, ${country.name} ${country.dial}`}>{country.code} {country.dial}<span aria-hidden="true">⌄</span></Link>
              <input id="ph" className="input" type="tel" inputMode="tel" autoComplete="tel-national" value={formatNational(phone, country)} onChange={(ev) => setPhone(nationalDigits(ev.target.value, country))} placeholder="98765 43210" aria-invalid={tried && !!err} />
            </div>
            {tried && err ? <p className="t-error" role="alert">{err}</p> : <p className="fm-sub">We’ll send a one-time SMS code to this number. Standard message rates may apply.</p>}
          </div>
        )}
        {msg && <Notice icon={TriangleAlert} tone="err">{msg}</Notice>}
        <Button type="submit" arrow loading={busy === 'code'} disabled={!configured || !!err}>Send code</Button>
        <p className="fm-help" style={{ margin: '2px 0 -6px' }}>or continue with</p>
        <button type="button" className="social google" disabled={!configured || !!busy} onClick={() => void social('google')}><GoogleG /><span>Continue with Google</span></button>
        <button type="button" className="social facebook" disabled={!configured || !!busy} onClick={() => void social('facebook')}><FacebookF /><span>Continue with Facebook</span></button>
        {signup && <p className="fm-help">By continuing, you agree to our <Link to="/legal/terms">Terms of use</Link> and <Link to="/legal/privacy">Privacy policy</Link>.</p>}
        {signup ? <Link className="fm-link" to="/auth">Already have an account? Log in</Link> : <Link className="fm-link" to="/auth/signup">New to Stories? Sign up</Link>}
        {!signup && <Link className="fm-link" to="/auth/password">Use password instead</Link>}
        <button type="button" className="fm-link" onClick={() => { setMode('demo'); navigate('/', { replace: true }); }}>Continue as guest</button>
        <p className="fm-help">Guest mode uses sample stories saved only on this device.</p>
      </form>
    </Page>
  );
}

export function CountryScreen() {
  const navigate = useNavigate();
  const loc = useLocation();
  const back = ((loc.state as { back?: string } | null)?.back) ?? '/auth';
  return (
    <Page title="Country code" centerTitle fallback={back} className="auth">
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Choose your country.</h1>
        <div className="stack-sm" role="listbox" aria-label="Country code">
          {COUNTRIES.map((c) => (
            <button key={c.code} type="button" role="option" aria-selected={readCountry().code === c.code} className="country-opt" onClick={() => { try { sessionStorage.setItem(COUNTRY_KEY, c.code); } catch { /* ignore */ } navigate(back, { replace: true, state: { tab: 'phone' } }); }}>
              <span>{c.name}</span><span>{c.code} {c.dial}</span>
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

/** "Check your code." — six-digit verification for the Phone / Email one-time code. */
export function CodeScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const pending = readPending('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [left, setLeft] = useState(() => (pending ? secondsLeft(pending.resendAt) : 0));
  const verifyLock = useRef(false);
  const resendLock = useRef(false);
  const lastTried = useRef('');
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setLeft(secondsLeft(pending.resendAt)), 500);
    return () => clearInterval(t);
  }, [pending?.resendAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = pending ? { channel: pending.channel ?? 'email', value: pending.email } as const : null;
  const verify = async (value = code) => {
    if (!target || value.length !== OTP_LENGTH || verifyLock.current) return;
    verifyLock.current = true;
    lastTried.current = value;
    setBusy(true);
    setError('');
    const r = await auth.verifyCode(target, value);
    verifyLock.current = false;
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    clearPending();
    setBusy(false);
  };
  useEffect(() => {
    if (code.length === OTP_LENGTH && code !== lastTried.current) void verify(code);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  const resend = async () => {
    if (!pending || !target || left > 0 || resendLock.current) return;
    resendLock.current = true;
    setResending(true);
    setError('');
    const r = await auth.sendCode(target, !!pending.create);
    resendLock.current = false;
    setResending(false);
    const secs = r.ok ? OTP_RESEND_SECONDS : (r.cooldown ?? 0);
    writePending({ ...pending, resendAt: Date.now() + secs * 1000 });
    setLeft(secs);
    if (r.ok) { setCode(''); lastTried.current = ''; toast('New code sent'); } else setError(r.message);
  };
  if (!pending || !target) return <Navigate to="/auth" replace />;
  if (auth.status === 'signedIn') return <Navigate to="/" replace />;
  const back = pending.create ? '/auth/signup' : '/auth';
  const working = busy || auth.status === 'loading';
  const m = pending.channel === 'phone' ? 'phone' : 'email';
  return (
    <Page title="Verify code" centerTitle fallback={back} className="auth">
      <div className="stack">
        <div className="stack-sm"><h1 className="fm-h1" style={{ margin: 0 }}>Check your code.</h1><p className="fm-sub">Code sent to {maskTarget(m, pending.email)}</p></div>
        <OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(''); }} error={error} disabled={working} />
        <Button arrow loading={working} disabled={code.length !== OTP_LENGTH} onClick={() => void verify()}>Verify &amp; continue</Button>
        <button type="button" className="fm-link" disabled={left > 0 || resending} onClick={() => void resend()}>{left > 0 ? `Resend code in 00:${String(left).padStart(2, '0')}` : 'Resend code'}</button>
        <button type="button" className="fm-link" onClick={() => { clearPending(); navigate(back, { state: { tab: m, email: m === 'email' ? pending.email : undefined } }); }}>Change phone or email</button>
      </div>
    </Page>
  );
}

/** Web return from Google / Facebook (PKCE): exchange the code, then continue. */
export function AuthCallback() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = new URLSearchParams(window.location.search).get('code');
    const err = new URLSearchParams(window.location.search).get('error_description');
    if (err || !code || !supabase) { setMsg(err ?? 'That sign-in link is no longer valid. Try again.'); return; }
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) setMsg(describeAuthError(error, 'login').message); });
  }, []);
  if (auth.status === 'signedIn') return <Navigate to="/" replace />;
  return (
    <AuthFrame noBack title={msg ? 'Sign-in didn’t finish.' : 'Signing you in…'} sub={msg || 'One moment.'}>
      {msg && <Button arrow onClick={() => navigate('/auth', { replace: true })}>Back to log in</Button>}
    </AuthFrame>
  );
}
