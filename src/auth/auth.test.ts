import { describe, expect, it } from 'vitest';
import { parseAuthLink, redirectUrl, validateEmail, validatePassword } from './config';
import { buildAccountDb } from './cloud';
import { roleOf, accountName } from '../domain/rules';

describe('redirect URLs', () => {
  it('uses the website origin on web and the custom scheme on Android', () => {
    expect(redirectUrl('callback', false, 'https://book-reading.vercel.app')).toBe('https://book-reading.vercel.app/auth/callback');
    expect(redirectUrl('recovery', false, 'http://localhost:5173')).toBe('http://localhost:5173/auth/recovery');
    expect(redirectUrl('callback', true)).toBe('com.bookreading.prototype://auth/callback');
    expect(redirectUrl('recovery', true)).toBe('com.bookreading.prototype://auth/recovery');
  });
});

describe('parseAuthLink', () => {
  it('reads codes from web and deep-link URLs', () => {
    expect(parseAuthLink('https://x.app/auth/callback?code=abc')).toEqual({ kind: 'callback', code: 'abc', error: null });
    expect(parseAuthLink('com.bookreading.prototype://auth/recovery?code=zzz')).toEqual({ kind: 'recovery', code: 'zzz', error: null });
  });
  it('reads errors from the query or hash', () => {
    expect(parseAuthLink('https://x.app/auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired').error).toContain('invalid');
    expect(parseAuthLink('com.bookreading.prototype://auth/callback?error_description=expired').error).toBe('expired');
  });
  it('ignores unrelated or malformed links', () => {
    expect(parseAuthLink('https://x.app/story/1').kind).toBeNull();
    expect(parseAuthLink('not a url')).toEqual({ kind: null, code: null, error: null });
  });
});

describe('validation', () => {
  it('validates email and password', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail('a@b')).toBeTruthy();
    expect(validateEmail(' me@example.com ')).toBe('');
    expect(validatePassword('short')).toBeTruthy();
    expect(validatePassword('longenough')).toBe('');
  });
});

describe('buildAccountDb', () => {
  const uid = '3f2b1c9e-1111-4222-8333-444455556666';
  const db = buildAccountDb({ id: uid, email: 'me@example.com' }, {
    profile: { id: uid, display_name: 'Asha', genres: ['Drama'], languages: ['English'], onboarded: true, reader_font_size: 2, reader_theme: 'sepia' },
    bookmarks: [{ story_id: 'story-unsent-page', created_at: '2026-11-01T10:00:00Z' }],
    progress: [{ story_id: 'story-unsent-page', chapter_id: 'ch-unsent-2', scroll: 0.4, completed: false, updated_at: '2026-11-01T10:00:00Z' }],
  });
  it('is a reader session holding only this user’s private rows, with no demo enquiries', () => {
    expect(roleOf(uid)).toBe('reader');
    expect(accountName(db, uid)).toBe('Asha');
    expect(db.activeAccountId).toBe(uid);
    expect(db.saved).toHaveLength(1);
    expect(db.enquiries).toHaveLength(0);
    expect(db.messages).toHaveLength(0);
  });
  it('maps stable chapter ids back to the reader’s chapter index', () => {
    expect(db.progress[0]).toMatchObject({ chapterIndex: 1, scroll: 0.4, storyId: 'story-unsent-page' });
    expect(db.prefs[uid]).toMatchObject({ onboarded: true, fontSize: 2, theme: 'sepia', genres: ['Drama'] });
  });
});
