// Browser test of the OTP account flows against an in-memory FAKE Supabase (Auth + REST). NOT a live-project test.
// Usage: FAKE_OTP_LENGTH=6 BASE=http://127.0.0.1:5174 node e2e/auth.mjs
import { chromium } from 'playwright-core';
import { randomUUID, randomInt } from 'node:crypto';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5174';
const LEN = parseInt(process.env.FAKE_OTP_LENGTH ?? '6', 10);
const FAKE_COOLDOWN_MS = 6000; // server-side min interval; the app is configured with 3s so it can hit the 429 path
const SB = 'https://fake-project.supabase.co';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('br-splash-seen', '1'); } catch {} });
const page = await ctx.newPage();
const errors = [];
const logs = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => logs.push(m.text()));

// ---------- fake Supabase ----------
const users = new Map();
const tokens = new Map();
const mail = []; // {email,type,token,used,expired}
const lastSent = new Map();
const tables = { profiles: new Map(), bookmarks: [], reading_progress: [] };
const calls = [];
let failNextVerify = 0;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, app_metadata: {}, user_metadata: { display_name: u.name }, identities: [{}], created_at: new Date().toISOString() });
const session = (u) => { const t = `tok-${randomUUID()}`; tokens.set(t, u.id); return { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `ref-${u.id}`, user: userJson(u) }; };
const byId = (id) => [...users.values()].find((u) => u.id === id);
const code = () => Array.from({ length: LEN }, () => randomInt(0, 10)).join('');
const sendMail = (email, type) => {
  const k = `${email}:${type}`;
  const wait = lastSent.get(k) ? FAKE_COOLDOWN_MS - (Date.now() - lastSent.get(k)) : 0;
  if (wait > 0) return Math.ceil(wait / 1000);
  mail.filter((m) => m.email === email && m.type === type).forEach((m) => (m.used = true)); // newest code replaces older ones
  mail.push({ email, type, token: code(), used: false, expired: false });
  lastSent.set(k, Date.now());
  return 0;
};
const latest = (email, type) => [...mail].reverse().find((m) => m.email === email && m.type === type && !m.used);
const parseFilters = (url) => [...url.searchParams].filter(([k]) => !['select', 'on_conflict', 'order', 'columns'].includes(k)).map(([k, v]) => [k, v.replace(/^eq\./, '')]);

await ctx.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const reply = (status, body) => route.fulfill({ status, headers: cors, body: body === undefined ? '' : JSON.stringify(body) });
  const limited = (s) => reply(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: `For security purposes, you can only request this after ${s} seconds.` });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  const uid = tokens.get((req.headers()['authorization'] ?? '').replace('Bearer ', ''));
  calls.push(`${req.method()} ${url.pathname}`);
  const p = url.pathname;
  if (p === '/auth/v1/signup') {
    const ex = users.get(body.email);
    if (ex) { if (!ex.confirmed) { const w = sendMail(body.email, 'signup'); if (w) return limited(w); } return reply(200, userJson({ ...ex, id: ex.id })); }
    const u = { id: randomUUID(), email: body.email, password: body.password, confirmed: false, name: body.data?.display_name ?? '' };
    users.set(body.email, u);
    // the DB trigger copies display_name; simulate a project where it is missing for names starting "Carol"
    tables.profiles.set(u.id, { id: u.id, display_name: u.name.startsWith('Carol') ? '' : u.name, genres: [], languages: [], onboarded: false, reader_font_size: 1, reader_theme: 'light' });
    sendMail(body.email, 'signup');
    return reply(200, userJson(u));
  }
  if (p === '/auth/v1/verify') {
    if (failNextVerify > 0) { failNextVerify--; return route.abort('failed'); }
    const m = latest(body.email, body.type);
    if (!m || m.token !== body.token || m.expired) return reply(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    m.used = true;
    const u = users.get(body.email);
    if (body.type === 'signup') u.confirmed = true;
    return reply(200, session(u));
  }
  if (p === '/auth/v1/resend') { const u = users.get(body.email); if (u && !u.confirmed) { const w = sendMail(body.email, 'signup'); if (w) return limited(w); } return reply(200, { message_id: 'x' }); }
  if (p === '/auth/v1/recover') { const u = users.get(body.email); if (u) { const w = sendMail(body.email, 'recovery'); if (w) return limited(w); } return reply(200, {}); }
  if (p === '/auth/v1/token') {
    const g = url.searchParams.get('grant_type');
    if (g === 'password') {
      const u = users.get(body.email);
      if (!u || u.password !== body.password) return reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (!u.confirmed) return reply(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return reply(200, session(u));
    }
    if (g === 'refresh_token') return reply(200, session(byId(body.refresh_token.replace('ref-', ''))));
  }
  if (p === '/auth/v1/user') {
    if (!uid) return reply(401, { msg: 'invalid JWT' });
    const u = byId(uid);
    if (req.method() === 'PUT' && body.password) { if (body.password === u.password) return reply(422, { error_code: 'same_password', msg: 'New password should be different from the old password.' }); u.password = body.password; }
    return reply(200, userJson(u));
  }
  if (p === '/auth/v1/logout') return reply(204);
  if (p.startsWith('/rest/v1/')) {
    if (!uid) return reply(401, { message: 'JWT required' });
    const t = p.split('/').pop();
    const mine = (rows) => rows.filter((r) => (r.user_id ?? r.id) === uid);
    const f = parseFilters(url);
    const match = (r) => f.every(([k, v]) => String(r[k]) === v);
    if (t === 'profiles') {
      const row = tables.profiles.get(uid);
      if (req.method() === 'PATCH') { Object.assign(row, body); return reply(204); }
      return reply(200, f.length && f[0][1] !== uid ? [] : row ? [row] : []);
    }
    const rows = tables[t];
    if (req.method() === 'GET') return reply(200, mine(rows).filter(match));
    if (req.method() === 'POST') {
      const ex = rows.find((r) => r.user_id === uid && r.story_id === body.story_id);
      if (ex) { if (t === 'reading_progress') Object.assign(ex, body); return reply(201); }
      rows.push({ ...body, user_id: uid, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return reply(201);
    }
    if (req.method() === 'DELETE') { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_id === uid && match(rows[i])) rows.splice(i, 1); return reply(204); }
  }
  return reply(404, { msg: `unhandled ${req.method()} ${p}` });
});

// ---------- helpers ----------
let pass = 0, failed = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n); } else { failed++; console.log('  ✗', n, x); } };
const text = () => page.locator('#app-canvas').innerText();
const has = async (t) => (await text()).includes(t);
const wait = (ms) => page.waitForTimeout(ms);
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState('networkidle'); await wait(150); };
const field = (l, v) => page.getByLabel(l, { exact: true }).fill(v);
const otpBox = () => page.getByLabel('Verification code');
const btn = (n, exact = true) => page.getByRole('button', { name: n, exact });
const verifyCalls = () => calls.filter((c) => c === 'POST /auth/v1/verify').length;
const wrongCode = (real) => (real[0] === '1' ? '2' : '1') + real.slice(1);
async function signup(name, email, pw) {
  await go('/auth');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await field('Display name', name); await field('Email', email); await field('Password', pw);
  await btn('Create account').click();
  await page.waitForURL('**/auth/verify', { timeout: 8000 }).catch(async () => { console.log('SIGNUP STUCK:', (await text()).replace(/\n+/g, ' / ').slice(0, 300)); throw new Error('signup did not reach verify'); });
}
async function login(email, pw) { await go('/auth'); await field('Email', email); await field('Password', pw); await btn('Log in').click(); await wait(500); }
async function logout() { await go('/profile'); await btn('Log out').click(); await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click(); await page.waitForURL('**/auth'); }
async function finishOnboarding() {
  await btn('Skip').click();
  await btn('Drama', false).click(); await btn('Continue').click();
  await btn('English', false).click(); await btn('Explore stories').click(); await page.waitForURL('**/discover');
}

// ---------- tests ----------
console.log(`OTP length ${LEN}`);
console.log('Gate & validation');
await go('/');
check('unauthenticated visit is sent to /auth', page.url().endsWith('/auth'));
await go('/library');
check('private route redirects to /auth', page.url().endsWith('/auth'));
await btn('Log in').click();
check('login validation messages', (await has('Enter your email address.')) && (await has('Enter your password.')));
await page.getByRole('tab', { name: 'Create account' }).click();
await field('Display name', 'A'); await field('Email', 'bad'); await field('Password', 'short');
await btn('Create account').click();
check('signup validation (name, email, password)', (await has('Enter your name.')) && (await has('Enter a valid email address.')) && (await has('Use at least 8 characters.')));

console.log('Registration + OTP verification');
await signup('Alice', 'typo@example.com', 'correct-horse-9');
check('“Verify your email” shows the entered email', (await has('Verify your email')) && (await has('typo@example.com')));
check('numeric keyboard + one-time-code autofill', (await otpBox().getAttribute('inputmode')) === 'numeric' && (await otpBox().getAttribute('autocomplete')) === 'one-time-code');
check('verify disabled until full code', await btn('Verify email').isDisabled());
await otpBox().fill('ab12');
check('non-digits are stripped', (await otpBox().inputValue()) === '12');
await btn('Use a different email', false).click();
await page.waitForURL('**/auth');
check('correcting email returns to sign-up prefilled', (await page.getByLabel('Email', { exact: true }).inputValue()) === 'typo@example.com' && (await page.getByLabel('Display name').inputValue()) === 'Alice');
await field('Email', 'alice@example.com'); await field('Password', 'correct-horse-9');
await btn('Create account').click();
await page.waitForURL('**/auth/verify');
check('new email shown on verification screen', await has('alice@example.com'));
const c1 = latest('alice@example.com', 'signup').token;
await otpBox().fill(wrongCode(c1));
await wait(400);
check('incorrect code → clear error, stays on screen', (await has('incorrect, expired or already used')) && page.url().includes('/auth/verify'));
check('Discover not opened before verification', !page.url().includes('/discover'));
check('resend is on cooldown after sending', (await btn('Resend code in', false).count()) === 1 && (await btn('Resend code in', false).isDisabled()));
await wait(3300);
await btn('Resend code').click();
await wait(500);
check('resend before the server interval → rate-limit message + countdown', (await has('Please wait')) && (await btn('Resend code in', false).count()) === 1);
await wait(3500);
await btn('Resend code').click();
await wait(500);
const c2 = latest('alice@example.com', 'signup').token;
check('resend after cooldown issues a new code', c2 !== c1);
await otpBox().fill(c1);
await wait(400);
check('replaced (old) code is rejected', await has('incorrect, expired or already used'));
// paste with spaces, full code, auto-verify
const spaced = c2.slice(0, 3) + ' ' + c2.slice(3);
await otpBox().fill(spaced);
await page.waitForURL('**/welcome');
check('pasted code with spaces verifies and opens the app', await has('Your next story'));
check('display name persisted to the profile row', [...tables.profiles.values()].some((p) => p.display_name === 'Alice'));
check('no password/OTP kept in local storage', !(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })).then((s) => s.includes('correct-horse-9') || s.includes(c2))));
await finishOnboarding();

console.log('Duplicate taps, network error, unverified login, name fallback');
await logout();
await signup('Bob', 'bob@example.com', 'another-pass-1');
const bobCode = latest('bob@example.com', 'signup').token;
failNextVerify = 1;
await otpBox().fill(bobCode);
await wait(500);
check('network error is shown, not swallowed', await has('reach the server'));
check('code kept so user can retry', (await otpBox().inputValue()) === bobCode);
const before = verifyCalls();
await btn('Verify email').dblclick();
await page.waitForURL('**/welcome');
check('double tap sends exactly one verification request', verifyCalls() - before === 1, `${verifyCalls() - before}`);
await finishOnboarding();
await go('/library');
check('bob sees none of alice’s data', await has('Your library is empty'));
await logout();
await signup('Dave', 'dave@example.com', 'dave-pass-1234');
await go('/auth');
await field('Email', 'dave@example.com'); await field('Password', 'dave-pass-1234'); await btn('Log in').click();
await wait(500);
check('unverified login explains and offers verification', (await has('isn’t verified yet')) && (await btn('Verify my email').count()) === 1);
await btn('Verify my email').click();
await page.waitForURL('**/auth/verify');
check('returns to verification for that email', await has('dave@example.com'));
await otpBox().fill(latest('dave@example.com', 'signup').token);
await page.waitForURL('**/welcome');
check('unverified user can finish verification and log in', await has('Your next story'));
await finishOnboarding();
await logout();
await signup('Carol', 'carol@example.com', 'carol-pass-1234');
await otpBox().fill(latest('carol@example.com', 'signup').token);
await page.waitForURL('**/welcome');
await wait(300);
check('display name saved to profile even if the DB trigger missed it', [...tables.profiles.values()].some((p) => p.display_name === 'Carol'));
await finishOnboarding();
await logout();

console.log('Login, session, sync');
await login('alice@example.com', 'wrong-password');
check('wrong password message', await has('Email or password is incorrect.'));
await login('alice@example.com', 'correct-horse-9');
await go('/discover');
await page.getByRole('button', { name: 'Save The Unsent Page' }).first().click();
await wait(300);
check('bookmark stored for alice', tables.bookmarks.length === 1);
await page.reload(); await page.waitForLoadState('networkidle'); await wait(400);
check('session restored after reopening', page.url().includes('/discover') && !(await has('Log in')));
await go('/library');
check('bookmark restored', await has('The Unsent Page'));
await logout();
check('logout clears private data and token', !(await page.evaluate(() => localStorage.getItem('book-reading-auth'))) && !(await has('The Unsent Page')));

console.log('Forgot password (recovery OTP)');
await go('/auth/forgot');
await field('Email', 'nobody@example.com');
await btn('Send reset code').click();
await page.waitForURL('**/auth/forgot/code');
const ackUnknown = (await page.locator('p.t-meta').first().innerText()).replace('nobody@example.com', 'X');
await go('/auth/forgot');
await field('Email', 'alice@example.com');
await btn('Send reset code').click();
await page.waitForURL('**/auth/forgot/code');
const ackKnown = (await page.locator('p.t-meta').first().innerText()).replace('alice@example.com', 'X');
check('same acknowledgement for unknown and registered emails', ackUnknown === ackKnown && ackKnown.includes('If an account exists'), `${ackUnknown} | ${ackKnown}`);
const r1 = latest('alice@example.com', 'recovery').token;
await otpBox().fill(wrongCode(r1));
await wait(400);
check('wrong reset code rejected', await has('incorrect, expired or already used'));
latest('alice@example.com', 'recovery').expired = true;
await otpBox().fill(r1);
await wait(400);
check('expired reset code rejected', await has('incorrect, expired or already used') && !page.url().includes('/auth/reset'));
await wait(6600);
await btn('Resend code').click();
await wait(500);
const r2 = latest('alice@example.com', 'recovery').token;
await otpBox().fill(r2);
await page.waitForURL('**/auth/reset');
check('valid reset code opens New password (not Discover)', (await has('New password')) && (await has('Confirm password')));
await page.reload(); await page.waitForLoadState('networkidle'); await wait(400);
check('reload keeps the user on New password', page.url().includes('/auth/reset'));
await go('/discover');
check('cannot reach Discover mid-recovery', page.url().includes('/auth/reset'));
await go('/library');
check('cannot reach Library mid-recovery', page.url().includes('/auth/reset'));
await field('New password', 'brand-new-pass-7'); await field('Confirm password', 'mismatch-pass-7');
await btn('Save new password').click();
check('mismatched passwords flagged', await has('Passwords don’t match.'));
await field('New password', 'correct-horse-9'); await field('Confirm password', 'correct-horse-9');
await btn('Save new password').click();
await wait(500);
check('reusing the current password is rejected visibly', await has('different from your current one'));
await field('New password', 'brand-new-pass-7'); await field('Confirm password', 'brand-new-pass-7');
await btn('Save new password').click();
await page.waitForURL('**/auth');
check('after saving, returns to Login with confirmation', (await has('Password updated')) && (await page.getByLabel('Email', { exact: true }).inputValue()) === 'alice@example.com');
check('user is signed out after reset', !(await page.evaluate(() => localStorage.getItem('book-reading-auth'))));
await field('Password', 'correct-horse-9'); await btn('Log in').click(); await wait(500);
check('old password no longer works', await has('Email or password is incorrect.'));
await field('Password', 'brand-new-pass-7'); await btn('Log in').click(); await wait(600);
check('new password works', !page.url().includes('/auth'));
await logout();
await wait(6200);
await go('/auth/forgot'); await field('Email', 'alice@example.com'); await btn('Send reset code').click(); await page.waitForURL('**/auth/forgot/code');
await otpBox().fill(r2);
await wait(400);
check('already-used reset code is rejected', await has('incorrect, expired or already used'));

console.log('Demo stays separate');
await go('/auth');
await btn('Continue in demo mode').click();
await page.waitForURL('**/welcome'); await wait(300);
check('demo opens sample data, not an account', (await has('Your next story')) && (await has('Demo controls')));
const bm = tables.bookmarks.length;
await finishOnboarding();
await page.getByRole('button', { name: 'Save The Unsent Page' }).first().click(); await wait(300);
check('demo bookmarks never reach the backend', tables.bookmarks.length === bm);

console.log('Logs');
const secrets = ['correct-horse-9', 'brand-new-pass-7', 'another-pass-1', c1, c2, r1, r2, bobCode];
check('no passwords or OTPs in console output', !logs.some((l) => secrets.some((s) => l.includes(s))));
check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\nResult: ${pass} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
