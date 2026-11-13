# Supabase setup (web + Android) — email + password with OTP codes

Sign-up verification and password reset both use a **code typed into the app** (no email links, so no redirect URLs or deep links are needed). One Supabase project backs the Vercel website and the Android app.

## 1. Environment variables (public values only)

| Name | Value | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Project Settings → API Keys → Publishable key |
| `VITE_OTP_LENGTH` *(optional, default 6)* | e.g. `6` | must equal the dashboard's **Email OTP Length** |
| `VITE_OTP_RESEND_SECONDS` *(optional, default 60)* | e.g. `60` | should equal the dashboard's minimum interval between emails |

Never use the secret / `service_role` key in this app.

- **Local:** copy `.env.example` → `.env.local`, fill in, restart `npm run dev`.
- **Vercel:** Project → Settings → Environment Variables → add the names above for Production, Preview and Development → redeploy.
- **Android:** the values are baked in at build time. Put them in `.env.local`, then `npm run android:debug`.

If the two required values are missing, the app still runs in demo mode and the login screen says accounts aren't configured. Real auth errors (wrong code, rate limit, network, server) are always shown, never hidden.

## 2. Dashboard settings

(Dashboard labels move between releases; search for the setting name if a path differs.)

1. **Authentication → Sign In / Providers → Email:** Enable Email provider ON · **Confirm email ON** · Secure email change as you prefer.
2. Same page: **Email OTP Expiration** — e.g. `900` (15 min). **Email OTP Length** — keep `6` (or set 6–10 and put the same number in `VITE_OTP_LENGTH`).
3. **Minimum password length:** 8.
4. **Authentication → URL Configuration → Site URL:** `https://bookreadingapp.vercel.app`. (Redirect URLs are not used by OTP flows; existing entries are harmless.)
5. **Authentication → Rate Limits:** raise *emails sent per hour* once custom SMTP is on. Note the per-user minimum interval (default 60 s) — keep `VITE_OTP_RESEND_SECONDS` equal to it.
6. **Custom SMTP (required for outside testers):** Authentication → Emails → SMTP Settings → enable custom SMTP with Resend, Postmark, SendGrid, Brevo or Amazon SES, using a verified sending domain. Supabase's built-in mailer only delivers to your own team's addresses and is heavily rate-limited.
7. Apply the database migration once (see section 4).

## 3. Email templates (Authentication → Emails → Templates)

Both templates must show `{{ .Token }}` (the code). Do **not** use `{{ .ConfirmationURL }}`.

### Confirm signup
Subject: `Your Book Reading verification code`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#22251F">
  <h2 style="margin:0 0 12px;font-family:Georgia,serif">Verify your email</h2>
  <p style="margin:0 0 16px;line-height:1.5">Enter this code in the Book Reading app to finish creating your account:</p>
  <p style="margin:0 0 16px;font-size:32px;letter-spacing:8px;font-weight:700;background:#F3EFE0;padding:16px;text-align:center;border-radius:12px">{{ .Token }}</p>
  <p style="margin:0;font-size:13px;color:#686B61;line-height:1.5">The code expires soon and works once. If you didn’t create an account, you can ignore this email.</p>
</div>
```

### Reset password
Subject: `Your Book Reading password reset code`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#22251F">
  <h2 style="margin:0 0 12px;font-family:Georgia,serif">Reset your password</h2>
  <p style="margin:0 0 16px;line-height:1.5">Enter this code in the Book Reading app to choose a new password:</p>
  <p style="margin:0 0 16px;font-size:32px;letter-spacing:8px;font-weight:700;background:#F3EFE0;padding:16px;text-align:center;border-radius:12px">{{ .Token }}</p>
  <p style="margin:0;font-size:13px;color:#686B61;line-height:1.5">The code expires soon and works once. If you didn’t ask to reset your password, ignore this email; your password stays the same.</p>
</div>
```

## 4. Apply the database migration (once)

File: `supabase/migrations/20261112000000_accounts_profiles_bookmarks_progress.sql` (safe to re-run).
Dashboard → SQL Editor → New query → paste the file → Run. Tables `profiles`, `bookmarks`, `reading_progress` appear with RLS enabled. The `handle_new_user` trigger copies the sign-up display name into `profiles`; the app also repairs a missing name after verification.

## 5. What each flow does

- **Sign up:** display name + email + password → `signUp` → "Verify your email" (shows the email; paste or type the code; resend after the cooldown; "Use a different email") → `verifyOtp(type: signup)` → Discover only once Supabase returns a session.
- **Log in:** email + password. If the email isn't verified, "Verify my email" sends a fresh code and opens the verification screen.
- **Forgot password:** email → code screen with the same acknowledgement for any address → `verifyOtp(type: recovery)` → **New password** screen. The app stays on that screen (even after reload) until the password is saved, then signs out and returns to Login.
- **Session:** restored on reopen; logout clears the session and private data.

## 6. Rebuild commands
```
export JAVA_HOME=$(ls -d ~/.jdks/jdk-21*/Contents/Home | head -1)
npm run android:debug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Scope
Real accounts: sign-up, verification, login, logout, password reset, session restore, profile, bookmarks, reading progress. Writer accounts, story ownership and adaptation enquiries remain **demo-only** (labelled "Demo").
