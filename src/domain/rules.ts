import { ACCOUNTS } from './seed';
import type { AdaptationEnquiry, DB, EnquiryStatus, Role, Story } from './types';
import { COVER_IDS, FORMATS, GENRES, LANGUAGES, REPORT_REASONS } from './types';

export type ErrorCode =
  | 'not_allowed'
  | 'not_found'
  | 'not_pending'
  | 'unavailable'
  | 'blocked'
  | 'duplicate'
  | 'invalid'
  | 'profile_incomplete'
  | 'not_accepted';

export type Result<T = object> = ({ ok: true; db: DB } & T) | { ok: false; error: ErrorCode; message: string; existingId?: string };

const fail = (error: ErrorCode, message: string, existingId?: string): { ok: false; error: ErrorCode; message: string; existingId?: string } => ({ ok: false, error, message, existingId });

export const WORDS_PER_MINUTE = 190;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function roleOf(accountId: string): Role | null {
  // Real Supabase accounts are readers until writer accounts and story ownership are connected.
  return ACCOUNTS.find((a) => a.id === accountId)?.role ?? (UUID.test(accountId) ? 'reader' : null);
}

export function accountName(db: DB, accountId: string): string {
  if (db.realUser && db.realUser.id === accountId) return db.realUser.name || db.realUser.email.split('@')[0];
  const acc = ACCOUNTS.find((a) => a.id === accountId);
  if (!acc) return db.writers[accountId]?.name ?? 'Unknown';
  if (acc.role === 'filmmaker') return db.filmmakers[acc.id]?.name || acc.name;
  if (acc.role === 'writer') return db.writers[acc.id]?.name || acc.name;
  return acc.name;
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function readingMinutes(chapters: { body: string }[]): number {
  const words = chapters.reduce((n, c) => n + wordCount(c.body), 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function isBlocked(db: DB, a: string, b: string): boolean {
  return db.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}

/** Public (published) view of a story. */
export function publicStory(s: Story) {
  return s.published ? { ...s, ...s.published, chapters: s.published.chapters, adaptationOpen: s.adaptationOpen } : null;
}

export type PubStory = NonNullable<ReturnType<typeof publicStory>>;
export function publishedStories(db: DB): PubStory[] {
  return db.stories.filter((s) => s.published).map((s) => publicStory(s)!);
}

export function activeEnquiryFor(db: DB, filmmakerId: string, storyId: string): AdaptationEnquiry | undefined {
  return db.enquiries.find((e) => e.filmmakerId === filmmakerId && e.storyId === storyId && (e.status === 'pending' || e.status === 'accepted'));
}

export type EnquiryGate =
  | { ok: true }
  | { ok: false; reason: 'not_filmmaker' | 'missing' | 'unavailable' | 'blocked' | 'duplicate'; existingId?: string };

/** Single source of truth for "may this account start an enquiry about this story right now?" */
export function enquiryGate(db: DB, accountId: string, storyId: string): EnquiryGate {
  if (roleOf(accountId) !== 'filmmaker') return { ok: false, reason: 'not_filmmaker' };
  const story = db.stories.find((s) => s.id === storyId);
  if (!story || !story.published) return { ok: false, reason: 'missing' };
  const existing = activeEnquiryFor(db, accountId, storyId);
  if (existing) return { ok: false, reason: 'duplicate', existingId: existing.id };
  if (isBlocked(db, accountId, story.writerId)) return { ok: false, reason: 'blocked' };
  if (!story.adaptationOpen) return { ok: false, reason: 'unavailable' };
  return { ok: true };
}

export function validateIntro(i: { name: string; role: string; portfolio: string; intro: string }) {
  const errors: Partial<Record<'name' | 'role' | 'portfolio' | 'intro', string>> = {};
  if (!i.name.trim()) errors.name = 'Enter your display name.';
  if (!i.role.trim()) errors.role = 'Enter your professional role.';
  if (!i.intro.trim()) errors.intro = 'Add a short introduction.';
  else if (i.intro.trim().length < 20) errors.intro = 'Write at least 20 characters.';
  const p = i.portfolio.trim();
  if (p && !isValidUrl(p)) errors.portfolio = 'Enter a valid link, for example https://example.com';
  return errors;
}

export function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function validateEnquiryDraft(d: { projectTitle: string; format: string; proposal: string }) {
  const errors: Partial<Record<'projectTitle' | 'format' | 'proposal', string>> = {};
  if (!d.projectTitle.trim()) errors.projectTitle = 'Enter a project title.';
  if (!d.format || !(FORMATS as readonly string[]).includes(d.format)) errors.format = 'Choose an intended format.';
  if (!d.proposal.trim()) errors.proposal = 'Describe your proposal.';
  else if (d.proposal.trim().length < 30) errors.proposal = 'Write at least 30 characters so the writer has context.';
  return errors;
}

export function submitEnquiry(db: DB, accountId: string, storyId: string, now: number, id: string): Result<{ id: string }> {
  const gate = enquiryGate(db, accountId, storyId);
  if (!gate.ok) {
    switch (gate.reason) {
      case 'not_filmmaker':
        return fail('not_allowed', 'Only filmmaker accounts can send adaptation enquiries.');
      case 'missing':
        return fail('not_found', 'This story is no longer available.');
      case 'duplicate':
        return fail('duplicate', 'You already have an active enquiry for this story.', gate.existingId);
      case 'blocked':
        return fail('blocked', 'Contact is unavailable between you and this writer.');
      case 'unavailable':
        return fail('unavailable', 'The writer is not open to adaptation enquiries for this story right now.');
    }
  }
  const story = db.stories.find((s) => s.id === storyId)!;
  const profile = db.filmmakers[accountId];
  if (!profile || !profile.complete || Object.keys(validateIntro(profile)).length) return fail('profile_incomplete', 'Complete your professional introduction first.');
  const draft = db.drafts.find((d) => d.accountId === accountId && d.storyId === storyId);
  if (!draft || Object.keys(validateEnquiryDraft(draft)).length) return fail('invalid', 'Complete the required enquiry fields.');
  const enquiry: AdaptationEnquiry = {
    id,
    storyId,
    writerId: story.writerId,
    filmmakerId: accountId,
    intro: { name: profile.name.trim(), role: profile.role.trim(), team: profile.team.trim(), portfolio: profile.portfolio.trim(), intro: profile.intro.trim() },
    projectTitle: draft.projectTitle.trim(),
    format: draft.format,
    proposal: draft.proposal.trim(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  return {
    ok: true,
    id,
    db: { ...db, enquiries: [enquiry, ...db.enquiries], drafts: db.drafts.filter((d) => d !== draft) },
  };
}

type Action = 'accept' | 'decline' | 'withdraw';
const TARGET: Record<Action, EnquiryStatus> = { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn' };

export function transitionEnquiry(db: DB, accountId: string, enquiryId: string, action: Action, now: number, reason?: string): Result {
  const e = db.enquiries.find((x) => x.id === enquiryId);
  if (!e) return fail('not_found', 'This enquiry could not be found.');
  const allowedActor = action === 'withdraw' ? e.filmmakerId === accountId : e.writerId === accountId;
  if (!allowedActor) return fail('not_allowed', action === 'withdraw' ? 'Only the sender can withdraw this enquiry.' : 'Only the target writer can respond to this enquiry.');
  if (e.status !== 'pending') return fail('not_pending', 'Only pending enquiries can be changed.');
  if (action === 'accept' && isBlocked(db, e.writerId, e.filmmakerId)) return fail('blocked', 'Contact is unavailable, so this enquiry cannot be accepted.');
  const next: AdaptationEnquiry = { ...e, status: TARGET[action], updatedAt: now };
  if (action === 'decline' && reason && reason.trim()) next.declineReason = reason.trim().slice(0, 240);
  return { ok: true, db: { ...db, enquiries: db.enquiries.map((x) => (x.id === e.id ? next : x)) } };
}

export function canMessage(db: DB, accountId: string, enquiryId: string): { ok: true } | { ok: false; error: ErrorCode; message: string } {
  const e = db.enquiries.find((x) => x.id === enquiryId);
  if (!e) return fail('not_found', 'This conversation could not be found.');
  if (e.writerId !== accountId && e.filmmakerId !== accountId) return fail('not_allowed', 'You are not a participant in this conversation.');
  if (e.status !== 'accepted') return fail('not_accepted', 'Conversation opens only after the writer accepts.');
  if (isBlocked(db, e.writerId, e.filmmakerId)) return fail('blocked', 'Contact is unavailable. Existing messages are kept as history.');
  return { ok: true };
}

export function sendMessage(db: DB, accountId: string, enquiryId: string, text: string, now: number, id: string): Result<{ id: string }> {
  const can = canMessage(db, accountId, enquiryId);
  if (!can.ok) return can;
  if (!text.trim()) return fail('invalid', 'Write a message before sending.');
  const composer = { ...db.composer };
  delete composer[`${accountId}:${enquiryId}`];
  return { ok: true, id, db: { ...db, messages: [...db.messages, { id, enquiryId, senderId: accountId, text: text.trim(), createdAt: now }], composer } };
}

export function otherParty(e: AdaptationEnquiry, accountId: string): string {
  return e.writerId === accountId ? e.filmmakerId : e.writerId;
}

export function reportUser(db: DB, accountId: string, enquiryId: string, reason: string, details: string, now: number, id: string): Result<{ id: string }> {
  const e = db.enquiries.find((x) => x.id === enquiryId);
  if (!e) return fail('not_found', 'This enquiry could not be found.');
  if (e.writerId !== accountId && e.filmmakerId !== accountId) return fail('not_allowed', 'You are not a participant in this enquiry.');
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return fail('invalid', 'Choose a reason for the report.');
  // Deliberately does not touch enquiry status or blocks.
  return { ok: true, id, db: { ...db, reports: [...db.reports, { id, reporterId: accountId, targetId: otherParty(e, accountId), enquiryId, reason, details: details.trim().slice(0, 500), createdAt: now }] } };
}

export function blockUser(db: DB, blockerId: string, targetId: string, now: number, id: string): Result {
  if (blockerId === targetId) return fail('invalid', 'You cannot block yourself.');
  if (db.blocks.some((b) => b.blockerId === blockerId && b.blockedId === targetId)) return { ok: true, db };
  // Deliberately does not touch enquiry status.
  return { ok: true, db: { ...db, blocks: [...db.blocks, { id, blockerId, blockedId: targetId, createdAt: now }] } };
}

export function unblockUser(db: DB, blockerId: string, blockId: string): Result {
  const b = db.blocks.find((x) => x.id === blockId);
  if (!b) return fail('not_found', 'Block not found.');
  if (b.blockerId !== blockerId) return fail('not_allowed', 'Only the person who blocked can unblock.');
  return { ok: true, db: { ...db, blocks: db.blocks.filter((x) => x.id !== blockId) } };
}

/* ---------- Story validation & publishing ---------- */

export interface StoryMetaInput {
  title: string;
  synopsis: string;
  genre: string;
  language: string;
  coverId: string;
}

export function validateStoryMeta(s: StoryMetaInput) {
  const errors: Partial<Record<keyof StoryMetaInput, string>> = {};
  if (!s.title.trim()) errors.title = 'Enter a story title.';
  if (!s.synopsis.trim()) errors.synopsis = 'Add a synopsis.';
  else if (s.synopsis.trim().length < 20) errors.synopsis = 'Write at least 20 characters.';
  if (!(GENRES as readonly string[]).includes(s.genre)) errors.genre = 'Choose a genre.';
  if (!(LANGUAGES as readonly string[]).includes(s.language)) errors.language = 'Choose a language.';
  if (!(COVER_IDS as readonly string[]).includes(s.coverId)) errors.coverId = 'Choose a cover.';
  return errors;
}

export function publishProblems(s: Story): string[] {
  const out = Object.values(validateStoryMeta(s));
  if (s.chapters.length === 0) out.push('Add at least one chapter.');
  s.chapters.forEach((c, i) => {
    if (!c.title.trim()) out.push(`Chapter ${i + 1} needs a title.`);
    if (!c.body.trim()) out.push(`Chapter ${i + 1} has no content.`);
  });
  return out;
}

export type ChapterState = 'published' | 'changed' | 'new';
export function chapterState(s: Story, chapterId: string): ChapterState {
  const p = s.published?.chapters.find((c) => c.id === chapterId);
  if (!p) return 'new';
  const d = s.chapters.find((c) => c.id === chapterId);
  return d && d.title === p.title && d.body === p.body ? 'published' : 'changed';
}

export function hasUnpublishedChanges(s: Story): boolean {
  const p = s.published;
  if (!p) return false;
  if (p.title !== s.title || p.synopsis !== s.synopsis || p.genre !== s.genre || p.language !== s.language || p.coverId !== s.coverId || p.status !== s.status) return true;
  if (p.chapters.length !== s.chapters.length) return true;
  return s.chapters.some((c, i) => p.chapters[i].id !== c.id || chapterState(s, c.id) !== 'published');
}

export function publishStory(db: DB, accountId: string, storyId: string, now: number): Result {
  const s = db.stories.find((x) => x.id === storyId);
  if (!s) return fail('not_found', 'Story not found.');
  if (s.writerId !== accountId) return fail('not_allowed', 'Only the writer can publish this story.');
  const problems = publishProblems(s);
  if (problems.length) return fail('invalid', problems[0]);
  const next: Story = {
    ...s,
    updatedAt: now,
    published: {
      title: s.title.trim(),
      synopsis: s.synopsis.trim(),
      genre: s.genre,
      language: s.language,
      coverId: s.coverId,
      status: s.status,
      chapters: s.chapters.map((c) => ({ ...c, title: c.title.trim() })),
      publishedAt: now,
    },
  };
  return { ok: true, db: { ...db, stories: db.stories.map((x) => (x.id === s.id ? next : x)) } };
}
