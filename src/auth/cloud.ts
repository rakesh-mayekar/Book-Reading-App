import { createSeed } from '../domain/seed';
import type { DB, ReadingProgress, SavedStory, ThemeName } from '../domain/types';
import { supabase } from './config';

const client = () => {
  if (!supabase) throw new Error('Accounts are not configured in this build.');
  return supabase;
};

interface ProfileRow { id: string; display_name: string; genres: string[]; languages: string[]; onboarded: boolean; reader_font_size: number; reader_theme: ThemeName }
interface BookmarkRow { story_id: string; created_at: string }
interface ProgressRow { story_id: string; chapter_id: string; scroll: number; completed: boolean; updated_at: string }

export interface AccountData { profile: ProfileRow; bookmarks: BookmarkRow[]; progress: ProgressRow[] }

export async function fetchAccountData(userId: string): Promise<AccountData> {
  const sb = client();
  const [p, b, r] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('bookmarks').select('story_id, created_at').order('created_at', { ascending: false }),
    sb.from('reading_progress').select('story_id, chapter_id, scroll, completed, updated_at'),
  ]);
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  if (r.error) throw r.error;
  let profile = p.data as ProfileRow | null;
  if (!profile) {
    const ins = await sb.from('profiles').insert({ id: userId }).select('*').single();
    if (ins.error) throw ins.error;
    profile = ins.data as ProfileRow;
  }
  return { profile, bookmarks: (b.data ?? []) as BookmarkRow[], progress: (r.data ?? []) as ProgressRow[] };
}

/** Builds the in-memory DB for a signed-in reader: shared public catalogue + this user's private rows only. */
export function buildAccountDb(user: { id: string; email: string }, data: AccountData): DB {
  const base = createSeed();
  const stories = base.stories;
  const progress: ReadingProgress[] = data.progress.map((p) => {
    const story = stories.find((s) => s.id === p.story_id);
    const idx = Math.max(0, story?.published?.chapters.findIndex((c) => c.id === p.chapter_id) ?? 0);
    return { accountId: user.id, storyId: p.story_id, chapterIndex: idx, scroll: p.scroll, completed: p.completed, updatedAt: Date.parse(p.updated_at) || Date.now() };
  });
  const saved: SavedStory[] = data.bookmarks.map((b) => ({ accountId: user.id, storyId: b.story_id, savedAt: Date.parse(b.created_at) || Date.now() }));
  return {
    ...base,
    activeAccountId: user.id,
    realUser: { id: user.id, name: data.profile.display_name, email: user.email },
    progress,
    saved,
    prefs: {
      [user.id]: { onboarded: data.profile.onboarded, genres: data.profile.genres, languages: data.profile.languages, fontSize: data.profile.reader_font_size, theme: data.profile.reader_theme },
    },
  };
}

export async function addBookmark(storyId: string) {
  const { error } = await client().from('bookmarks').upsert({ story_id: storyId }, { onConflict: 'user_id,story_id', ignoreDuplicates: true });
  if (error) throw error;
}
export async function removeBookmark(storyId: string) {
  const { error } = await client().from('bookmarks').delete().eq('story_id', storyId);
  if (error) throw error;
}
export async function upsertProgress(userId: string, storyId: string, chapterId: string, scroll: number, completed: boolean) {
  const { error } = await client().from('reading_progress').upsert({ user_id: userId, story_id: storyId, chapter_id: chapterId, scroll: Math.min(1, Math.max(0, scroll)), completed }, { onConflict: 'user_id,story_id' });
  if (error) throw error;
}
export async function updateProfile(userId: string, patch: Partial<Omit<ProfileRow, 'id'>>) {
  const { error } = await client().from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
