import { describe, expect, it } from 'vitest';
import { validateEmail, validatePassword } from './config';
import { buildAccountDb } from './cloud';
import { roleOf, accountName } from '../domain/rules';
import { cooldownFromMessage, describeAuthError, intEnv, sanitizeOtp } from './otp';
import { secondsLeft } from './pending';

describe('sanitizeOtp', () => {
  it('keeps digits only and caps at the configured length (paste-friendly)', () => {
    expect(sanitizeOtp('123 456', 6)).toBe('123456');
    expect(sanitizeOtp('123-456\n', 6)).toBe('123456');
    expect(sanitizeOtp('12ab34', 6)).toBe('1234');
    expect(sanitizeOtp('12345678', 6)).toBe('123456');
    expect(sanitizeOtp('12345678', 8)).toBe('12345678');
    expect(sanitizeOtp('１２３４５６', 6)).toBe('123456');
  });
});

describe('config helpers', () => {
  it('clamps env integers', () => {
    expect(intEnv(undefined, 6, 4, 10)).toBe(6);
    expect(intEnv('8', 6, 4, 10)).toBe(8);
    expect(intEnv('99', 6, 4, 10)).toBe(10);
    expect(intEnv('abc', 6, 4, 10)).toBe(6);
  });
  it('reads cooldown seconds from Supabase messages', () => {
    expect(cooldownFromMessage('For security purposes, you can only request this after 49 seconds.')).toBe(49);
    expect(cooldownFromMessage('nope')).toBeNull();
  });
  it('secondsLeft never goes negative', () => {
    expect(secondsLeft(10_000, 4_000)).toBe(6);
    expect(secondsLeft(1_000, 4_000)).toBe(0);
  });
});

describe('describeAuthError', () => {
  it('maps wrong / expired / reused codes to one actionable message', () => {
    for (const m of ['Token has expired or is invalid', 'OTP expired']) expect(describeAuthError({ message: m, code: 'otp_expired', status: 403 }, 'verify').message).toMatch(/incorrect, expired or already used/);
  });
  it('maps rate limits with and without a cooldown', () => {
    expect(describeAuthError({ message: 'For security purposes, you can only request this after 30 seconds.', status: 429 }, 'send')).toMatchObject({ cooldown: 30 });
    expect(describeAuthError({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 }, 'send', 60)).toMatchObject({ cooldown: 60 });
  });
  it('maps network failures, unverified email and bad credentials', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'login').message).toMatch(/reach the server/);
    expect(describeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'login').unverified).toBe(true);
    expect(describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'login').message).toBe('Email or password is incorrect.');
  });
  it('never hides unknown real errors', () => {
    expect(describeAuthError({ message: 'Database error saving new user' }, 'signup').message).toBe('Database error saving new user');
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
    expect(db.saved).toHaveLength(1);
    expect(db.enquiries).toHaveLength(0);
  });
  it('maps stable chapter ids back to the reader’s chapter index', () => {
    expect(db.progress[0]).toMatchObject({ chapterIndex: 1, scroll: 0.4, storyId: 'story-unsent-page' });
  });
});
