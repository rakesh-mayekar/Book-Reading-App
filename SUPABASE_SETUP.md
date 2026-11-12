# Supabase setup (web + Android)

One Supabase project backs the Vercel website and the Android app. Only two **public** values are used by the client.

## 1. Environment variables

| Name | Value | Where |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Supabase → Project Settings → API Keys |

Never use the secret / `service_role` key in this app.

- **Local dev:** copy `.env.example` to `.env.local` (git-ignored), fill both values, restart `npm run dev`.
- **Vercel:** Project → Settings → Environment Variables → add both names for Production, Preview and Development → redeploy. (`vercel.json` adds the SPA rewrite so `/auth/callback` works as a direct link.)
- **Android:** Vite bakes the values into the bundle at build time. Put them in `.env.local` on the build machine, then `npm run android:debug`. Changing them requires a rebuild.

If the variables are missing the app still works in **demo mode** (sample data on the device) and the auth screen says accounts aren't configured.

## 2. Redirect URLs to register

Supabase → Authentication → URL Configuration.

**Site URL:** `https://<your-vercel-domain>`

**Redirect URLs (add all):**
```
https://<your-vercel-domain>/auth/callback
https://<your-vercel-domain>/auth/recovery
https://*-<your-vercel-team>.vercel.app/auth/callback
https://*-<your-vercel-team>.vercel.app/auth/recovery
http://localhost:5173/auth/callback
http://localhost:5173/auth/recovery
com.bookreading.prototype://auth/callback
com.bookreading.prototype://auth/recovery
```
The two `com.bookreading.prototype://` entries are the Android deep links (declared in `AndroidManifest.xml`). The `*-team.vercel.app` pair is only needed for Preview deployments.

## 3. Apply the migration

File: `supabase/migrations/20261112000000_accounts_profiles_bookmarks_progress.sql`

- **Dashboard:** SQL Editor → New query → paste the whole file → Run. Then Table Editor should show `profiles`, `bookmarks`, `reading_progress` with the RLS badge enabled.
- **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

It creates the three tables, a trigger that creates a `profiles` row on sign-up, unique `(user_id, story_id)` bookmarks, and RLS policies so each user can only read/write their own rows. `anon` has no access.

## 4. Authentication emails for external testers

1. Authentication → Sign In / Providers → **Email**: enable; turn **Confirm email** ON; set minimum password length to 8.
2. Supabase's built-in mail service is for trials only: very low hourly limit and it can only deliver to your team's own addresses. For outside testers, go to Authentication → Emails → **SMTP Settings** → enable **Custom SMTP** with a provider such as Resend, Postmark, SendGrid, Brevo or Amazon SES (verify your sending domain first), then set sender name/address.
3. Authentication → Rate Limits: raise "emails sent per hour" once custom SMTP is on.
4. Authentication → Emails → Templates: Confirm signup and Reset password should keep `{{ .ConfirmationURL }}`. Optionally edit the wording.
5. Send yourself a test sign-up and reset from the website and from the APK.

Dashboard labels move around between releases; search the dashboard for the setting name if a path differs.

## 5. Rebuild commands

```
export JAVA_HOME=$(ls -d ~/.jdks/jdk-21*/Contents/Home | head -1)
npm run android:debug      # builds web (reads .env.local), syncs, assembleDebug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Scope
Real accounts currently cover: sign-up, email verification, login, logout, password reset, session restore, private profile, bookmarks and reading progress. **Writer accounts, story ownership and adaptation enquiries are still demo-only** (sample data on the device, labelled "Demo").
