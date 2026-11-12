import { useSyncExternalStore } from 'react';
import { createSeed, DB_VERSION, STORAGE_KEY } from '../domain/seed';
import * as R from '../domain/rules';
import type { Chapter, DB, EnquiryDraft, Filters, FilmmakerProfile, Story, UserPreferences, WriterProfile, EnquiryStatus } from '../domain/types';

import { addBookmark, removeBookmark, updateProfile, upsertProgress } from '../auth/cloud';
import { isSupabaseConfigured } from '../auth/config';

export type Mode = 'demo' | 'account';
const MODE_KEY = 'stories-app-mode';

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return createSeed();
}
function loadMode(): Mode {
  if (!isSupabaseConfigured) return 'demo';
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'account';
  } catch {
    return 'account';
  }
}

/** Demo-device data: persisted locally, never mixed with real accounts. */
let demoState: DB = load();
/** Real-account data: in memory only, rebuilt from Supabase after sign-in, cleared on sign-out. */
let cloudState: DB | null = null;
let mode: Mode = loadMode();
const signedOutDb: DB = { ...createSeed(), activeAccountId: 'signed-out', prefs: {}, saved: [], progress: [], enquiries: [], messages: [], drafts: [] };
const cur = (): DB => (mode === 'demo' ? demoState : (cloudState ?? signedOutDb));
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

let syncErrorHandler: (msg: string) => void = () => {};
export const onSyncError = (fn: (msg: string) => void) => { syncErrorHandler = fn; };

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoState));
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}
function setState(next: DB) {
  if (next === cur()) return;
  if (mode === 'demo') {
    demoState = next;
    persist();
  } else {
    cloudState = next;
  }
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      demoState = load();
      emit();
    }
  });
  const flushOnHide = () => { if (document.visibilityState === 'hidden') void flushCloud(); };
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('pagehide', () => void flushCloud());
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, cur);
}
export const useMode = (): Mode => useSyncExternalStore(subscribe, () => mode);
export const getDB = () => cur();
export const getMode = () => mode;

export function setMode(m: Mode) {
  if (!isSupabaseConfigured && m === 'account') return;
  mode = m;
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
  emit();
}
export function enterAccount(db: DB) {
  cloudState = db;
  pending.clear();
  emit();
}
export function leaveAccount() {
  window.clearTimeout(progressTimer);
  pending.clear();
  cloudState = null;
  emit();
}

/* ---- background sync of a real account's progress (batched) ---- */
const pending = new Set<string>();
let progressTimer: number | undefined;
export async function flushCloud() {
  if (mode !== 'account' || !cloudState?.realUser || pending.size === 0) return;
  window.clearTimeout(progressTimer);
  const db = cloudState;
  const uid = db.realUser!.id;
  const ids = [...pending];
  pending.clear();
  for (const storyId of ids) {
    const p = db.progress.find((x) => x.accountId === uid && x.storyId === storyId);
    const chapter = db.stories.find((s) => s.id === storyId)?.published?.chapters[p?.chapterIndex ?? 0];
    if (!p || !chapter) continue;
    try {
      await upsertProgress(uid, storyId, chapter.id, p.scroll, p.completed);
    } catch {
      pending.add(storyId);
      syncErrorHandler('Couldn’t save your reading progress. It will retry.');
    }
  }
}
const isMine = (accountId: string) => mode === 'account' && cloudState?.realUser?.id === accountId;

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => Date.now();

function apply<T extends object>(r: R.Result<T>): R.Result<T> {
  if (r.ok) setState(r.db);
  return r;
}
function update(fn: (db: DB) => DB) {
  setState(fn(cur()));
}

export const actions = {
  switchAccount(id: string) {
    update((db) => ({ ...db, activeAccountId: id }));
  },
  /** Resets demo-device data only. Real accounts are never touched. */
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    demoState = createSeed();
    persist();
    if (mode === 'demo') emit();
  },
  savePrefs(accountId: string, patch: Partial<UserPreferences>) {
    if (mode === 'account' && !isMine(accountId)) return;
    update((db) => ({ ...db, prefs: { ...db.prefs, [accountId]: { ...db.prefs[accountId], ...patch } } }));
    if (isMine(accountId)) {
      const row: Record<string, unknown> = {};
      if (patch.genres) row.genres = patch.genres;
      if (patch.languages) row.languages = patch.languages;
      if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
      if (patch.fontSize !== undefined) row.reader_font_size = patch.fontSize;
      if (patch.theme) row.reader_theme = patch.theme;
      updateProfile(accountId, row).catch(() => syncErrorHandler('Couldn’t save your preferences. Check your connection.'));
    }
  },
  saveDisplayName(accountId: string, name: string) {
    if (!isMine(accountId)) return;
    update((db) => (db.realUser ? { ...db, realUser: { ...db.realUser, name } } : db));
    updateProfile(accountId, { display_name: name.slice(0, 80) }).catch(() => syncErrorHandler('Couldn’t save your name. Check your connection.'));
  },
  toggleSaved(accountId: string, storyId: string) {
    if (mode === 'account' && !isMine(accountId)) return;
    const had = cur().saved.some((s) => s.accountId === accountId && s.storyId === storyId);
    update((db) => ({ ...db, saved: had ? db.saved.filter((s) => !(s.accountId === accountId && s.storyId === storyId)) : [...db.saved, { accountId, storyId, savedAt: now() }] }));
    if (isMine(accountId)) {
      (had ? removeBookmark(storyId) : addBookmark(storyId)).catch(() => {
        // revert the optimistic change
        update((db) => ({ ...db, saved: had ? [...db.saved, { accountId, storyId, savedAt: now() }] : db.saved.filter((s) => !(s.accountId === accountId && s.storyId === storyId)) }));
        syncErrorHandler('Couldn’t update your bookmark. Check your connection.');
      });
    }
  },
  setProgress(accountId: string, storyId: string, chapterIndex: number, scroll: number, completed?: boolean) {
    if (mode === 'account' && !isMine(accountId)) return;
    if (isMine(accountId)) {
      pending.add(storyId);
      window.clearTimeout(progressTimer);
      progressTimer = window.setTimeout(() => void flushCloud(), completed ? 0 : 1500);
    }
    update((db) => {
      const prev = db.progress.find((p) => p.accountId === accountId && p.storyId === storyId);
      const next = { accountId, storyId, chapterIndex, scroll, completed: completed ?? prev?.completed ?? false, updatedAt: now() };
      return { ...db, progress: prev ? db.progress.map((p) => (p === prev ? next : p)) : [...db.progress, next] };
    });
  },
  setFilters(key: string, f: Filters) {
    update((db) => ({ ...db, filters: { ...db.filters, [key]: f } }));
  },
  setEnquiryFilter(key: string, f: '' | EnquiryStatus) {
    update((db) => ({ ...db, enquiryFilter: { ...db.enquiryFilter, [key]: f } }));
  },
  saveWriterProfile(p: WriterProfile) {
    update((db) => ({ ...db, writers: { ...db.writers, [p.id]: p } }));
  },
  saveFilmmakerProfile(p: FilmmakerProfile) {
    update((db) => ({ ...db, filmmakers: { ...db.filmmakers, [p.accountId]: p } }));
  },

  /* writer stories */
  createStory(writerId: string, meta: Pick<Story, 'title' | 'synopsis' | 'genre' | 'language' | 'coverId' | 'status' | 'adaptationOpen'>): string {
    const id = uid('story');
    const t = now();
    update((db) => ({ ...db, stories: [...db.stories, { ...meta, id, writerId, chapters: [], published: null, createdAt: t, updatedAt: t }] }));
    return id;
  },
  updateStory(storyId: string, patch: Partial<Story>) {
    update((db) => ({ ...db, stories: db.stories.map((s) => (s.id === storyId ? { ...s, ...patch, updatedAt: now() } : s)) }));
  },
  addChapter(storyId: string): string {
    const id = uid('ch');
    update((db) => ({
      ...db,
      stories: db.stories.map((s) => (s.id === storyId ? { ...s, updatedAt: now(), chapters: [...s.chapters, { id, title: '', body: '' }] } : s)),
    }));
    return id;
  },
  saveChapter(storyId: string, chapter: Chapter) {
    update((db) => ({ ...db, stories: db.stories.map((s) => (s.id === storyId ? { ...s, updatedAt: now(), chapters: s.chapters.map((c) => (c.id === chapter.id ? chapter : c)) } : s)) }));
  },
  moveChapter(storyId: string, chapterId: string, dir: -1 | 1) {
    update((db) => ({
      ...db,
      stories: db.stories.map((s) => {
        if (s.id !== storyId) return s;
        const i = s.chapters.findIndex((c) => c.id === chapterId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.chapters.length) return s;
        const chapters = [...s.chapters];
        [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
        return { ...s, chapters, updatedAt: now() };
      }),
    }));
  },
  deleteChapter(storyId: string, chapterId: string) {
    update((db) => ({ ...db, stories: db.stories.map((s) => (s.id === storyId ? { ...s, updatedAt: now(), chapters: s.chapters.filter((c) => c.id !== chapterId) } : s)) }));
  },
  publish(accountId: string, storyId: string) {
    return apply(R.publishStory(cur(), accountId, storyId, now()));
  },

  /* enquiries */
  saveDraft(d: EnquiryDraft) {
    update((db) => {
      const rest = db.drafts.filter((x) => !(x.accountId === d.accountId && x.storyId === d.storyId));
      return { ...db, drafts: [...rest, d] };
    });
  },
  clearDraft(accountId: string, storyId: string) {
    update((db) => ({ ...db, drafts: db.drafts.filter((x) => !(x.accountId === accountId && x.storyId === storyId)) }));
  },
  submitEnquiry(accountId: string, storyId: string) {
    return apply(R.submitEnquiry(cur(), accountId, storyId, now(), uid('enq')));
  },
  transition(accountId: string, enquiryId: string, action: 'accept' | 'decline' | 'withdraw', reason?: string) {
    return apply(R.transitionEnquiry(cur(), accountId, enquiryId, action, now(), reason));
  },
  setComposer(key: string, text: string) {
    update((db) => ({ ...db, composer: { ...db.composer, [key]: text } }));
  },
  sendMessage(accountId: string, enquiryId: string, text: string) {
    return apply(R.sendMessage(cur(), accountId, enquiryId, text, now(), uid('msg')));
  },
  report(accountId: string, enquiryId: string, reason: string, details: string) {
    return apply(R.reportUser(cur(), accountId, enquiryId, reason, details, now(), uid('rep')));
  },
  block(blockerId: string, targetId: string) {
    return apply(R.blockUser(cur(), blockerId, targetId, now(), uid('blk')));
  },
  unblock(blockerId: string, blockId: string) {
    return apply(R.unblockUser(cur(), blockerId, blockId));
  },
};
