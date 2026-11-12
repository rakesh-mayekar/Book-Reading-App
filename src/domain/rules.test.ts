import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import * as R from './rules';
import type { DB } from './types';

const K = 'acc-kabir';
const M = 'acc-mira';
const STORY = 'story-unsent-page';

function withDraft(db: DB, storyId = STORY): DB {
  return {
    ...db,
    filmmakers: { ...db.filmmakers, [K]: { accountId: K, name: 'Kabir Mehta', role: 'Independent filmmaker', team: '', portfolio: '', intro: 'A concise sample professional introduction.', complete: true } },
    drafts: [{ accountId: K, storyId, projectTitle: 'The Unsent Page — Short Film', format: 'Short film', proposal: 'A quiet short film adaptation that stays close to the sisters.' }],
  };
}
function submitted(): { db: DB; id: string } {
  const r = R.submitEnquiry(withDraft(createSeed()), K, STORY, 1000, 'enq-1');
  if (!r.ok) throw new Error(r.message);
  return { db: r.db, id: r.id };
}

describe('submit', () => {
  it('creates a pending enquiry and clears the draft', () => {
    const { db } = submitted();
    expect(db.enquiries[0].status).toBe('pending');
    expect(db.drafts).toHaveLength(0);
  });
  it('rejects non-filmmakers, incomplete drafts and incomplete profiles', () => {
    expect(R.submitEnquiry(withDraft(createSeed()), 'acc-riya', STORY, 1, 'x').ok).toBe(false);
    const d = withDraft(createSeed());
    expect(R.submitEnquiry({ ...d, drafts: [{ ...d.drafts[0], format: '' }] }, K, STORY, 1, 'x')).toMatchObject({ ok: false, error: 'invalid' });
    expect(R.submitEnquiry({ ...d, filmmakers: { [K]: { ...d.filmmakers[K], complete: false, intro: '' } } }, K, STORY, 1, 'x')).toMatchObject({ ok: false, error: 'profile_incomplete' });
  });
  it('prevents duplicate active enquiries and reports the existing one', () => {
    const { db } = submitted();
    const again = R.submitEnquiry(withDraft(db), K, STORY, 2000, 'enq-2');
    expect(again).toMatchObject({ ok: false, error: 'duplicate', existingId: 'enq-1' });
  });
  it('rechecks availability on submission', () => {
    const d = withDraft(createSeed());
    const off = { ...d, stories: d.stories.map((s) => (s.id === STORY ? { ...s, adaptationOpen: false } : s)) };
    expect(R.submitEnquiry(off, K, STORY, 1, 'x')).toMatchObject({ ok: false, error: 'unavailable' });
  });
  it('rechecks blocks on submission', () => {
    const d = withDraft(createSeed());
    const b = R.blockUser(d, M, K, 1, 'b1');
    if (!b.ok) throw new Error('x');
    expect(R.submitEnquiry(b.db, K, STORY, 1, 'x')).toMatchObject({ ok: false, error: 'blocked' });
  });
  it('allows a new enquiry after decline or withdrawal', () => {
    const { db, id } = submitted();
    const w = R.transitionEnquiry(db, K, id, 'withdraw', 3);
    if (!w.ok) throw new Error('x');
    expect(R.enquiryGate(withDraft(w.db), K, STORY).ok).toBe(true);
  });
});

describe('transitions and permissions', () => {
  it('only the target writer can accept or decline', () => {
    const { db, id } = submitted();
    expect(R.transitionEnquiry(db, K, id, 'accept', 5)).toMatchObject({ ok: false, error: 'not_allowed' });
    expect(R.transitionEnquiry(db, 'acc-riya', id, 'decline', 5)).toMatchObject({ ok: false, error: 'not_allowed' });
    const ok = R.transitionEnquiry(db, M, id, 'accept', 5);
    expect(ok.ok && ok.db.enquiries[0].status).toBe('accepted');
  });
  it('only the sender can withdraw', () => {
    const { db, id } = submitted();
    expect(R.transitionEnquiry(db, M, id, 'withdraw', 5)).toMatchObject({ ok: false, error: 'not_allowed' });
    const ok = R.transitionEnquiry(db, K, id, 'withdraw', 5);
    expect(ok.ok && ok.db.enquiries[0].status).toBe('withdrawn');
  });
  it('only pending enquiries can change; decline keeps an optional reason', () => {
    const { db, id } = submitted();
    const d = R.transitionEnquiry(db, M, id, 'decline', 5, '  Not the right fit  ');
    if (!d.ok) throw new Error('x');
    expect(d.db.enquiries[0]).toMatchObject({ status: 'declined', declineReason: 'Not the right fit' });
    expect(R.transitionEnquiry(d.db, M, id, 'accept', 6)).toMatchObject({ ok: false, error: 'not_pending' });
    expect(R.transitionEnquiry(d.db, K, id, 'withdraw', 6)).toMatchObject({ ok: false, error: 'not_pending' });
    const noReason = R.transitionEnquiry(db, M, id, 'decline', 5);
    expect(noReason.ok && noReason.db.enquiries[0].declineReason).toBeUndefined();
  });
  it('turning availability off does not stop a pending enquiry being accepted', () => {
    const { db, id } = submitted();
    const off = { ...db, stories: db.stories.map((s) => (s.id === STORY ? { ...s, adaptationOpen: false } : s)) };
    expect(R.transitionEnquiry(off, M, id, 'accept', 5).ok).toBe(true);
  });
});

describe('messaging', () => {
  it('is unavailable until accepted, then works for both participants only', () => {
    const { db, id } = submitted();
    expect(R.sendMessage(db, M, id, 'hi', 5, 'm1')).toMatchObject({ ok: false, error: 'not_accepted' });
    const acc = R.transitionEnquiry(db, M, id, 'accept', 5);
    if (!acc.ok) throw new Error('x');
    expect(R.sendMessage(acc.db, M, id, '   ', 6, 'm1')).toMatchObject({ ok: false, error: 'invalid' });
    expect(R.sendMessage(acc.db, 'acc-riya', id, 'hi', 6, 'm1')).toMatchObject({ ok: false, error: 'not_allowed' });
    const a = R.sendMessage(acc.db, M, id, ' Hello ', 6, 'm1');
    if (!a.ok) throw new Error('x');
    const b = R.sendMessage(a.db, K, id, 'Thanks', 7, 'm2');
    expect(b.ok && b.db.messages.map((m) => m.text)).toEqual(['Hello', 'Thanks']);
  });
  it('declined enquiries have no chat', () => {
    const { db, id } = submitted();
    const d = R.transitionEnquiry(db, M, id, 'decline', 5);
    if (!d.ok) throw new Error('x');
    expect(R.canMessage(d.db, K, id)).toMatchObject({ ok: false, error: 'not_accepted' });
  });
});

describe('report and block', () => {
  it('report requires a reason and changes neither status nor blocks', () => {
    const { db, id } = submitted();
    expect(R.reportUser(db, M, id, '', '', 5, 'r1')).toMatchObject({ ok: false, error: 'invalid' });
    const r = R.reportUser(db, M, id, 'Spam or misleading', 'details', 5, 'r1');
    if (!r.ok) throw new Error('x');
    expect(r.db.reports).toHaveLength(1);
    expect(r.db.blocks).toHaveLength(0);
    expect(r.db.enquiries[0].status).toBe('pending');
  });
  it('block stops messaging for both, keeps status and history; unblock restores', () => {
    const { db, id } = submitted();
    const acc = R.transitionEnquiry(db, M, id, 'accept', 5);
    if (!acc.ok) throw new Error('x');
    const msg = R.sendMessage(acc.db, K, id, 'Hello', 6, 'm1');
    if (!msg.ok) throw new Error('x');
    const blk = R.blockUser(msg.db, M, K, 7, 'b1');
    if (!blk.ok) throw new Error('x');
    expect(blk.db.enquiries[0].status).toBe('accepted');
    expect(blk.db.messages).toHaveLength(1);
    expect(R.canMessage(blk.db, K, id)).toMatchObject({ ok: false, error: 'blocked' });
    expect(R.canMessage(blk.db, M, id)).toMatchObject({ ok: false, error: 'blocked' });
    expect(R.unblockUser(blk.db, K, 'b1')).toMatchObject({ ok: false, error: 'not_allowed' });
    const un = R.unblockUser(blk.db, M, 'b1');
    if (!un.ok) throw new Error('x');
    expect(R.canMessage(un.db, K, id).ok).toBe(true);
  });
});

describe('publishing', () => {
  it('requires metadata and non-empty chapters, and snapshots on publish', () => {
    const db = createSeed();
    const draft = db.stories.find((s) => s.id === 'story-lighthouse')!;
    expect(R.publishProblems(draft)).toEqual([]);
    expect(R.publishProblems({ ...draft, chapters: [] })).toContain('Add at least one chapter.');
    expect(R.publishProblems({ ...draft, title: ' ' })).toContain('Enter a story title.');
    expect(R.publishStory(db, K, draft.id, 1)).toMatchObject({ ok: false, error: 'not_allowed' });
    const p = R.publishStory(db, M, draft.id, 1);
    if (!p.ok) throw new Error('x');
    const pub = p.db.stories.find((s) => s.id === draft.id)!;
    expect(pub.published).not.toBeNull();
    expect(R.hasUnpublishedChanges(pub)).toBe(false);
    expect(R.hasUnpublishedChanges({ ...pub, title: 'Changed' })).toBe(true);
  });
  it('seed reading time is about 12 minutes', () => {
    const s = createSeed().stories[0];
    expect(R.readingMinutes(s.chapters)).toBe(12);
  });
});

describe('validation', () => {
  it('validates the optional portfolio only when supplied', () => {
    const base = { name: 'K', role: 'R', intro: 'A sufficiently long introduction.' };
    expect(R.validateIntro({ ...base, portfolio: '' })).toEqual({});
    expect(R.validateIntro({ ...base, portfolio: 'not a url' }).portfolio).toBeTruthy();
    expect(R.validateIntro({ ...base, portfolio: 'https://example.com/work' })).toEqual({});
  });
});
