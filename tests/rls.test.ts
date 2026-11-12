// Runs the real migration on an in-process Postgres (pglite) and proves the RLS + constraints.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  db = new PGlite();
  // Minimal stand-in for Supabase's auth schema + roles.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const sql = readFileSync('supabase/migrations/20261112000000_accounts_profiles_bookmarks_progress.sql', 'utf8');
  await db.exec(sql);
  await db.exec(sql); // must be safe to run twice
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"display_name":"Alice"}'), ($2, '{}')`, [A, B]);
});

describe('migration + RLS', () => {
  it('creates a profile row for each new auth user from the signup metadata', async () => {
    const r = await db.query<{ id: string; display_name: string }>('select id, display_name from public.profiles order by display_name desc');
    expect(r.rows.map((x) => x.display_name)).toEqual(['Alice', '']);
  });
  it('users read only their own profile and cannot update another', async () => {
    expect((await as(A, 'select id from public.profiles')).rows).toHaveLength(1);
    const upd = await as(A, `update public.profiles set display_name = 'hacked' where id = $1 returning id`, [B]);
    expect(upd.rows).toHaveLength(0);
    expect((await as(B, 'select display_name from public.profiles')).rows[0]).toMatchObject({ display_name: '' });
  });
  it('bookmarks: own rows only, user_id defaults to auth.uid(), duplicates rejected', async () => {
    await as(A, `insert into public.bookmarks (story_id) values ('story-unsent-page')`);
    await expect(as(A, `insert into public.bookmarks (story_id) values ('story-unsent-page')`)).rejects.toThrow(/duplicate|unique/i);
    expect((await as(B, 'select * from public.bookmarks')).rows).toHaveLength(0);
    expect((await as(A, 'select user_id from public.bookmarks')).rows[0]).toMatchObject({ user_id: A });
  });
  it('cannot insert a row for someone else or delete someone else’s bookmark', async () => {
    await expect(as(B, `insert into public.bookmarks (user_id, story_id) values ($1, 'x')`, [A])).rejects.toThrow(/row-level security/i);
    const del = await as(B, `delete from public.bookmarks where story_id = 'story-unsent-page' returning id`);
    expect(del.rows).toHaveLength(0);
    expect((await as(A, 'select * from public.bookmarks')).rows).toHaveLength(1);
  });
  it('reading progress: upsert own, validates scroll range, isolated per user', async () => {
    await as(A, `insert into public.reading_progress (story_id, chapter_id, scroll) values ('story-unsent-page','ch-unsent-1',0.4)
                 on conflict (user_id, story_id) do update set scroll = excluded.scroll, chapter_id = excluded.chapter_id`);
    await as(A, `insert into public.reading_progress (story_id, chapter_id, scroll) values ('story-unsent-page','ch-unsent-2',0.7)
                 on conflict (user_id, story_id) do update set scroll = excluded.scroll, chapter_id = excluded.chapter_id`);
    const mine = await as(A, 'select chapter_id, scroll from public.reading_progress');
    expect(mine.rows).toEqual([{ chapter_id: 'ch-unsent-2', scroll: expect.closeTo(0.7, 3) }]);
    expect((await as(B, 'select * from public.reading_progress')).rows).toHaveLength(0);
    await expect(as(B, `insert into public.reading_progress (story_id, chapter_id, scroll) values ('s','c',1.5)`)).rejects.toThrow(/check/i);
  });
  it('anonymous (not signed in) requests get no access', async () => {
    await expect(as(null, 'select * from public.bookmarks')).rejects.toThrow(/permission denied/i);
    await expect(as(null, 'select * from public.profiles')).rejects.toThrow(/permission denied/i);
  });
});
