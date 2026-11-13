import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured } from '../auth/config';
import { accountName, roleOf } from '../domain/rules';
import { actions, setMode, useDB, useMode } from '../store/store';
import { BottomSheet } from './Dialog';
import { Button } from './ui';

/* Guest "Save it for your next chapter" prompt (Figma 'Sign-in prompt — Save a story').
   Only shown to a guest reader when accounts are configured. Saving always works on this device. */
type Target = { accountId: string; storyId: string; title: string } | null;
let target: Target = null;
const subs = new Set<() => void>();
const set = (t: Target) => { target = t; subs.forEach((f) => f()); };
const useTarget = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => target);
const KEY = 'save-prompt-dismissed';
const dismissed = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

export function useSaveStory() {
  const db = useDB();
  const mode = useMode();
  const id = db.activeAccountId;
  return (story: { id: string; title: string }) => {
    const saved = db.saved.some((s) => s.accountId === id && s.storyId === story.id);
    const guest = isSupabaseConfigured && mode === 'demo' && roleOf(id) === 'reader';
    if (!saved && guest && !dismissed()) set({ accountId: id, storyId: story.id, title: story.title });
    else actions.toggleSaved(id, story.id);
  };
}

export function SavePrompt() {
  const t = useTarget();
  const navigate = useNavigate();
  const close = () => set(null);
  void accountName;
  return (
    <BottomSheet open={!!t} onClose={close} title="Save it for your next chapter.">
      <p className="fm-label" style={{ margin: 0 }}>Your personal library</p>
      <p className="fm-sub">Sign in to keep {t?.title} in Want to read on every device. Until then it’s saved on this device only.</p>
      <Button arrow onClick={() => { close(); setMode('account'); navigate('/auth'); }}>Sign in / Create account</Button>
      <button type="button" className="fm-cancel" onClick={() => { if (t) actions.toggleSaved(t.accountId, t.storyId); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } close(); }}>Not now — keep exploring</button>
      <p className="fm-help" style={{ textAlign: 'center' }}>Reading stories is free. No account needed to read.</p>
    </BottomSheet>
  );
}
