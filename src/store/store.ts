import { useSyncExternalStore } from 'react';
import { createSeed, DB_VERSION, STORAGE_KEY } from '../domain/seed';
import * as R from '../domain/rules';
import type { Chapter, DB, EnquiryDraft, Filters, FilmmakerProfile, Story, UserPreferences, WriterProfile, EnquiryStatus } from '../domain/types';

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

let state: DB = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}
function setState(next: DB) {
  if (next === state) return;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
export const getDB = () => state;

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => Date.now();

function apply<T extends object>(r: R.Result<T>): R.Result<T> {
  if (r.ok) setState(r.db);
  return r;
}
function update(fn: (db: DB) => DB) {
  setState(fn(state));
}

export const actions = {
  switchAccount(id: string) {
    update((db) => ({ ...db, activeAccountId: id }));
  },
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(createSeed());
  },
  savePrefs(accountId: string, patch: Partial<UserPreferences>) {
    update((db) => ({ ...db, prefs: { ...db.prefs, [accountId]: { ...db.prefs[accountId], ...patch } } }));
  },
  toggleSaved(accountId: string, storyId: string) {
    update((db) => {
      const has = db.saved.some((s) => s.accountId === accountId && s.storyId === storyId);
      return { ...db, saved: has ? db.saved.filter((s) => !(s.accountId === accountId && s.storyId === storyId)) : [...db.saved, { accountId, storyId, savedAt: now() }] };
    });
  },
  setProgress(accountId: string, storyId: string, chapterIndex: number, scroll: number, completed?: boolean) {
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
    return apply(R.publishStory(state, accountId, storyId, now()));
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
    return apply(R.submitEnquiry(state, accountId, storyId, now(), uid('enq')));
  },
  transition(accountId: string, enquiryId: string, action: 'accept' | 'decline' | 'withdraw', reason?: string) {
    return apply(R.transitionEnquiry(state, accountId, enquiryId, action, now(), reason));
  },
  setComposer(key: string, text: string) {
    update((db) => ({ ...db, composer: { ...db.composer, [key]: text } }));
  },
  sendMessage(accountId: string, enquiryId: string, text: string) {
    return apply(R.sendMessage(state, accountId, enquiryId, text, now(), uid('msg')));
  },
  report(accountId: string, enquiryId: string, reason: string, details: string) {
    return apply(R.reportUser(state, accountId, enquiryId, reason, details, now(), uid('rep')));
  },
  block(blockerId: string, targetId: string) {
    return apply(R.blockUser(state, blockerId, targetId, now(), uid('blk')));
  },
  unblock(blockerId: string, blockId: string) {
    return apply(R.unblockUser(state, blockerId, blockId));
  },
};
