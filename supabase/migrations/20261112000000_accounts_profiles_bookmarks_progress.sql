-- Book Reading: profiles, bookmarks, reading progress.
-- Safe to re-run: tables use IF NOT EXISTS; triggers and policies are dropped and recreated.
-- Passwords and sessions stay in Supabase Auth (auth.users). Nothing here stores credentials.
-- Story/chapter ids are the stable text ids bundled in the app catalogue (same on web and Android).

begin;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (private, one row per auth user) ----------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null default '' check (char_length(display_name) <= 80),
  genres           text[] not null default '{}',
  languages        text[] not null default '{}',
  onboarded        boolean not null default false,
  reader_font_size smallint not null default 1 check (reader_font_size between 0 and 3),
  reader_theme     text not null default 'light' check (reader_theme in ('light', 'sepia', 'dark')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile automatically when someone signs up (works before email verification).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- bookmarks (no duplicates per user + story) ----------
create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id   text not null check (char_length(story_id) between 1 and 120),
  created_at timestamptz not null default now(),
  constraint bookmarks_user_story_unique unique (user_id, story_id)
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

-- ---------- reading_progress (one row per user + story) ----------
create table if not exists public.reading_progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id   text not null check (char_length(story_id) between 1 and 120),
  chapter_id text not null check (char_length(chapter_id) between 1 and 120),
  scroll     real not null default 0 check (scroll >= 0 and scroll <= 1),
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
drop trigger if exists reading_progress_set_updated_at on public.reading_progress;
create trigger reading_progress_set_updated_at before update on public.reading_progress
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security: each user sees and changes only their own rows ----------
alter table public.profiles         enable row level security;
alter table public.bookmarks        enable row level security;
alter table public.reading_progress enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

drop policy if exists bookmarks_select_own on public.bookmarks;
create policy bookmarks_select_own on public.bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists bookmarks_insert_own on public.bookmarks;
create policy bookmarks_insert_own on public.bookmarks
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists bookmarks_update_own on public.bookmarks;
create policy bookmarks_update_own on public.bookmarks
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_delete_own on public.bookmarks
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists progress_select_own on public.reading_progress;
create policy progress_select_own on public.reading_progress
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists progress_insert_own on public.reading_progress;
create policy progress_insert_own on public.reading_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists progress_update_own on public.reading_progress;
create policy progress_update_own on public.reading_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists progress_delete_own on public.reading_progress;
create policy progress_delete_own on public.reading_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- privileges: signed-in users only; anonymous access is removed ----------
revoke all on public.profiles, public.bookmarks, public.reading_progress from anon, public;
grant select, insert, update, delete on public.profiles, public.bookmarks, public.reading_progress to authenticated;

commit;
