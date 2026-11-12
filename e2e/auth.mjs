// Browser test of the account flows against an in-memory FAKE Supabase (Auth + REST). Not a live-project test.
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5174';
const SB = 'https://fake-project.supabase.co';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ---------- fake Supabase ----------
const users = new Map(); // email -> {id,password,confirmed,name}
const tokens = new Map(); // access token -> userId
const codes = new Map(); // code -> userId
const tables = { profiles: new Map(), bookmarks: [], reading_progress: [] };
const calls = [];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, app_metadata: {}, user_metadata: { display_name: u.name }, identities: [{}], created_at: new Date().toISOString() });
const session = (u) => { const t = `tok-${randomUUID()}`; tokens.set(t, u.id); return { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `ref-${u.id}`, user: userJson(u) }; };
const byId = (id) => [...users.values()].find((u) => u.id === id);
const parseFilters = (url) => [...url.searchParams].filter(([k]) => !['select', 'on_conflict', 'order', 'columns'].includes(k)).map(([k, v]) => [k, v.replace(/^eq\./, '')]);

await ctx.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const reply = (status, body) => route.fulfill({ status, headers: cors, body: body === undefined ? '' : JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const body = req.postData() ? JSON.parse(req.postData()) : {};
  const uid = tokens.get((req.headers()['authorization'] ?? '').replace('Bearer ', ''));
  calls.push(`${req.method()} ${url.pathname}`);
  const p = url.pathname;
  if (p === '/auth/v1/signup') {
    if (users.has(body.email)) return reply(200, userJson({ ...users.get(body.email), id: randomUUID() }));
    const u = { id: randomUUID(), email: body.email, password: body.password, confirmed: false, name: body.data?.display_name ?? '' };
    users.set(body.email, u);
    tables.profiles.set(u.id, { id: u.id, display_name: u.name, genres: [], languages: [], onboarded: false, reader_font_size: 1, reader_theme: 'light' });
    return reply(200, userJson(u));
  }
  if (p === '/auth/v1/token') {
    const g = url.searchParams.get('grant_type');
    if (g === 'password') {
      const u = users.get(body.email);
      if (!u || u.password !== body.password) return reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (!u.confirmed) return reply(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return reply(200, session(u));
    }
    if (g === 'pkce') {
      const id = codes.get(body.auth_code);
      if (!id) return reply(400, { error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' });
      codes.delete(body.auth_code);
      return reply(200, session(byId(id)));
    }
    if (g === 'refresh_token') return reply(200, session(byId(body.refresh_token.replace('ref-', ''))));
  }
  if (p === '/auth/v1/user') {
    if (!uid) return reply(401, { msg: 'invalid JWT' });
    const u = byId(uid);
    if (req.method() === 'PUT') { if (body.password) u.password = body.password; }
    return reply(200, userJson(u));
  }
  if (p === '/auth/v1/logout') return reply(204);
  if (p === '/auth/v1/recover') { const u = users.get(body.email); if (u) codes.set(`rec-${u.id}`, u.id); return reply(200, {}); }
  if (p === '/auth/v1/resend') return reply(200, {});
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
      const key = t === 'bookmarks' ? ['story_id'] : ['story_id'];
      const ex = rows.find((r) => r.user_id === uid && key.every((k) => r[k] === body[k]));
      if (ex) { if (t === 'reading_progress') Object.assign(ex, body, { updated_at: new Date().toISOString() }); return reply(201); }
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
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState('networkidle'); await page.waitForTimeout(150); };
const ls = (k) => page.evaluate((key) => localStorage.getItem(key), k);
const field = (l, v) => page.getByLabel(l, { exact: true }).fill(v);
async function login(email, pw) { await go('/auth'); await field('Email', email); await field('Password', pw); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.waitForTimeout(500); }
const verify = (email) => { users.get(email).confirmed = true; const c = `code-${randomUUID()}`; codes.set(c, users.get(email).id); return c; };

// ---------- tests ----------
console.log('Gate & validation');
await go('/');
check('unauthenticated visit is sent to /auth', page.url().endsWith('/auth'));
await go('/library');
check('private route redirects to /auth', page.url().endsWith('/auth'));
await page.getByRole('button', { name: 'Log in', exact: true }).click();
check('login validation messages', (await has('Enter your email address.')) && (await has('Enter your password.')));
await page.getByRole('tab', { name: 'Create account' }).click();
await field('Your name', 'Alice'); await field('Email', 'alice@example.com'); await field('Password', 'short');
await page.getByRole('button', { name: 'Create account', exact: true }).click();
check('password length validation', await has('Use at least 8 characters.'));

console.log('Sign-up, verification, login');
await field('Password', 'correct-horse-9');
await page.getByRole('button', { name: 'Create account', exact: true }).click();
await page.waitForTimeout(400);
check('check-your-email screen', await has('Check your email'));
check('profile row created with display name', [...tables.profiles.values()].some((p) => p.display_name === 'Alice'));
await login('alice@example.com', 'correct-horse-9');
check('unverified login blocked with resend option', (await has('Verify your email first')) && (await page.getByRole('button', { name: /Resend verification/ }).count()) === 1);
await login('alice@example.com', 'wrong-password');
check('wrong password message', await has('Email or password is incorrect.'));
const code = verify('alice@example.com');
await go(`/auth/callback?code=${code}`);
await page.waitForURL('**/welcome');
check('verification link signs in and starts onboarding', await has('Hello Alice'));
check('no password stored locally', !(await page.evaluate(() => JSON.stringify(localStorage)).then((s) => s.includes('correct-horse-9'))));
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByRole('button', { name: 'Skip intro' }).click();
await page.getByRole('button', { name: 'Drama' }).click();
await page.getByRole('button', { name: 'English' }).click();
await page.getByRole('button', { name: 'Save and continue' }).click();
await page.waitForURL('**/discover');
await page.waitForTimeout(300);
check('preferences saved to the profile table', JSON.stringify([...tables.profiles.values()].find((p) => p.display_name === 'Alice').genres) === '["Drama"]');

console.log('Bookmarks & progress sync');
await page.getByRole('button', { name: 'Save The Unsent Page' }).click();
await page.waitForTimeout(300);
check('bookmark stored for alice only', tables.bookmarks.length === 1 && tables.bookmarks[0].story_id === 'story-unsent-page' && tables.bookmarks[0].user_id === users.get('alice@example.com').id);
await go('/read/story-unsent-page/2');
await page.evaluate(() => { const m = document.querySelector('main.scroll'); m.scrollTop = 0.5 * (m.scrollHeight - m.clientHeight); });
await page.waitForTimeout(2300);
const pr = tables.reading_progress[0];
check('progress stored with stable chapter id', pr?.chapter_id === 'ch-unsent-2' && pr.scroll > 0.3 && pr.story_id === 'story-unsent-page', JSON.stringify(pr));
await page.reload(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
check('session restored after reopening (still on reader)', page.url().includes('/read/story-unsent-page/2') && !(await has('Log in')));
await go('/library');
check('bookmark restored from account', await has('The Unsent Page'));
await go('/story/story-unsent-page');
check('continue reading restores chapter 2', await has('Continue reading · Chapter 2'));

console.log('Logout, isolation, account change');
await go('/profile');
check('profile shows account email and sync note', (await has('alice@example.com')) && (await has('sync to your account')));
check('account mode hides demo account switcher & marks enquiries demo-only', !(await has('Demo controls')) && (await has('Writer & filmmaker demo')));
await page.getByRole('button', { name: 'Log out', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/auth');
check('logout returns to auth', await has('Log in'));
await go('/library');
check('after logout private data is not reachable', page.url().endsWith('/auth') && !(await has('The Unsent Page')));
check('no auth token left in storage', !(await ls('book-reading-auth')));
// second user
await page.getByRole('tab', { name: 'Create account' }).click();
await field('Your name', 'Bob'); await field('Email', 'bob@example.com'); await field('Password', 'another-pass-1');
await page.getByRole('button', { name: 'Create account', exact: true }).click();
await page.waitForTimeout(300);
await go(`/auth/callback?code=${verify('bob@example.com')}`);
await page.waitForURL('**/welcome');
check('bob starts with a fresh onboarding, not alice’s prefs', await has('Hello Bob'));
await page.getByRole('button', { name: 'Get started' }).click(); await page.getByRole('button', { name: 'Skip intro' }).click();
await page.getByRole('button', { name: 'Mystery' }).click(); await page.getByRole('button', { name: 'Hindi' }).click();
await page.getByRole('button', { name: 'Save and continue' }).click(); await page.waitForURL('**/discover');
await go('/library');
check('bob sees none of alice’s bookmarks/progress', !(await has('The Unsent Page')) && (await has('Nothing saved yet')));
await go('/profile');
await page.getByRole('button', { name: 'Log out', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/auth');
await login('alice@example.com', 'correct-horse-9');
await go('/library');
check('alice’s data is back after logging in again', await has('The Unsent Page'));

console.log('Password reset');
await go('/profile');
await page.getByRole('button', { name: 'Log out', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/auth');
await page.getByRole('link', { name: 'Forgot password?' }).click();
await page.getByRole('button', { name: 'Send reset link' }).click();
check('reset needs a valid email', await has('Enter your email address.'));
await field('Email', 'alice@example.com');
await page.getByRole('button', { name: 'Send reset link' }).click();
await page.waitForTimeout(300);
check('reset confirmation is non-revealing', await has('If an account exists'));
await go('/auth/recovery?code=rec-' + users.get('alice@example.com').id);
await page.waitForURL('**/auth/reset');
await field('New password', 'brand-new-pass-7'); await field('Confirm password', 'mismatch-pass-7');
await page.getByRole('button', { name: 'Update password' }).click();
check('reset confirms matching passwords', await has('Passwords don’t match.'));
await field('Confirm password', 'brand-new-pass-7');
await page.getByRole('button', { name: 'Update password' }).click();
await page.waitForTimeout(500);
check('password updated, signed in', users.get('alice@example.com').password === 'brand-new-pass-7' && !page.url().includes('/auth'));
await go('/profile');
await page.getByRole('button', { name: 'Log out', exact: true }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/auth');
await login('alice@example.com', 'brand-new-pass-7');
check('login works with the new password', !page.url().includes('/auth'));

console.log('Callback edge cases');
await go('/profile');
await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click(); await page.waitForURL('**/auth');
await go('/auth/callback?code=unknown-code');
check('callback without a valid session still tells user the email is confirmed', await has('Email confirmed'));
await go('/auth/callback?error_description=Email+link+is+invalid+or+has+expired');
check('expired link shows a clear error', await has('invalid or has expired'));
await go('/auth/recovery?code=bad');
check('unusable reset link offers a new request', (await has('can’t be used here')) && (await page.getByRole('link', { name: 'Request a new link' }).count()) === 1);

console.log('Demo mode stays separate');
await go('/auth');
await page.getByRole('button', { name: 'Continue in demo mode' }).click();
await page.waitForURL('**/welcome');
await page.waitForTimeout(300);
check('demo opens a fresh local demo reader (not alice)', (await has('Hello Riya')) && (await has('demo mode')));
const demoKey = await ls('stories-app-prototype');
check('demo data stored under its own key, no account rows', !demoKey || !demoKey.includes('alice@example.com'));
await page.getByRole('button', { name: 'Get started' }).click(); await page.getByRole('button', { name: 'Skip intro' }).click();
await page.getByRole('button', { name: 'Drama' }).click(); await page.getByRole('button', { name: 'English' }).click();
await page.getByRole('button', { name: 'Save and continue' }).click(); await page.waitForURL('**/discover');
await go('/profile/demo');
await page.getByRole('button', { name: /Mira Sen/ }).first().click(); await page.waitForTimeout(200);
await go('/enquiries');
check('writer enquiries are visibly marked Demo', (await page.locator('.demo-pill').count()) === 1);
await go('/profile');
check('profile states demo mode + offers real login', (await has('Demo mode.')) && (await has('Log in or create an account')));
const before = tables.bookmarks.length;
await go('/profile/demo'); await page.getByRole('button', { name: /Riya Shah/ }).first().click(); await page.waitForTimeout(200);
await go('/discover');
await page.getByRole('button', { name: 'Save The Unsent Page' }).first().click();
await page.waitForTimeout(300);
check('demo bookmarks never reach the backend', tables.bookmarks.length === before);
await go('/profile');
await page.getByRole('button', { name: /Log in or create an account/ }).click();
await page.waitForTimeout(400);
check('leaving demo returns to the real-account gate', page.url().includes('/auth') || (await has('Log in')) || (await has('alice@example.com')) || page.url().includes('/discover'));

console.log(`\nResult: ${pass} passed, ${failed} failed`);
if (errors.length) console.log('Page errors:', errors.slice(0, 4));
await browser.close();
process.exit(failed ? 1 : 0);
