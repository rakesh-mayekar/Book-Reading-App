import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, List, PartyPopper, Type } from 'lucide-react';
import { BottomSheet } from '../components/Dialog';
import { Page } from '../components/Shell';
import { Button, Chip, Ico, IconButton, LinkButton, StatusBadge } from '../components/ui';
import { publicStory } from '../domain/rules';
import type { ThemeName } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, useMe } from './common';

export function Reader() {
  const { id: storyId = '', n } = useParams();
  const { db, id } = useMe();
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const timer = useRef<number>();
  const latest = useRef({ idx: 0, frac: 0 });
  const [sheet, setSheet] = useState<'' | 'chapters' | 'style'>('');
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === storyId);
  const prefs = db.prefs[id];
  const chapters = story?.chapters ?? [];
  const idx = Math.min(Math.max((parseInt(n ?? '1', 10) || 1) - 1, 0), Math.max(chapters.length - 1, 0));
  const chapter = chapters[idx];

  const save = () => {
    const el = ref.current;
    if (!el || !story) return;
    const max = el.scrollHeight - el.clientHeight;
    const frac = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
    latest.current = { idx, frac };
    actions.setProgress(id, storyId, idx, frac);
  };

  // Resume position within the saved chapter; record chapter on open.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !story) return;
    if (prog && prog.chapterIndex === idx && prog.scroll > 0) {
      el.scrollTop = prog.scroll * Math.max(0, el.scrollHeight - el.clientHeight);
    } else {
      el.scrollTop = 0;
      if (!prog || prog.chapterIndex !== idx) actions.setProgress(id, storyId, idx, 0);
    }
    latest.current = { idx, frac: prog && prog.chapterIndex === idx ? prog.scroll : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, storyId, !!story]);

  // Flush the last known position when leaving the reader (position tracked synchronously on scroll).
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (story) actions.setProgress(id, storyId, latest.current.idx, latest.current.frac);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!story || !chapter) return <NotFoundState what="story" to="/discover" />;
  if (!n) return <Navigate replace to={`/read/${storyId}/${(prog ? Math.min(prog.chapterIndex, chapters.length - 1) : 0) + 1}`} />;

  const saved = db.saved.some((s) => s.accountId === id && s.storyId === storyId);
  const last = idx === chapters.length - 1;
  const go = (i: number) => navigate(`/read/${storyId}/${i + 1}`, { replace: true });
  const size = prefs?.fontSize ?? 1;
  const theme = prefs?.theme ?? 'light';
  const paragraphs = chapter.body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <Page
      className="reading"
      fallback={`/story/${storyId}`}
      scrollRef={ref}
      theme={theme}
      onScroll={() => {
        const el = ref.current;
        if (el) {
          const max = el.scrollHeight - el.clientHeight;
          latest.current = { idx, frac: max > 0 ? Math.min(1, el.scrollTop / max) : 0 };
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(save, 250);
      }}
      right={
        <>
          <IconButton icon={List} label="Chapter list" onClick={() => setSheet('chapters')} />
          <IconButton icon={Type} label="Text size and theme" onClick={() => setSheet('style')} />
          <IconButton icon={saved ? BookmarkCheck : Bookmark} pressed={saved} label={saved ? 'Remove from saved' : 'Save story'} onClick={() => actions.toggleSaved(id, storyId)} />
        </>
      }
      footer={
        <div className="footer-row">
          <Button variant="secondary" disabled={idx === 0} onClick={() => go(idx - 1)}>Previous</Button>
          {last ? (
            <Button
              onClick={() => {
                actions.setProgress(id, storyId, idx, 1, true);
                navigate(`/read/${storyId}/done`, { replace: true });
              }}
            >
              Finish story
            </Button>
          ) : (
            <Button onClick={() => go(idx + 1)}>Next chapter</Button>
          )}
        </div>
      }
    >
      <article style={{ paddingTop: 8 }}>
        <p className="t-meta">{story.title} · Chapter {idx + 1} of {chapters.length}</p>
        <h1 className="t-title" style={{ margin: '6px 0 20px' }}>{chapter.title}</h1>
        <div className="prose" data-size={size}>{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
        <p className="t-meta" style={{ textAlign: 'center', margin: '24px 0 8px' }}>— End of chapter {idx + 1} —</p>
      </article>
      <BottomSheet open={sheet === 'chapters'} onClose={() => setSheet('')} title="Chapters">
        <div className="stack-sm">
          {chapters.map((c, i) => (
            <button key={c.id} className="list-row" aria-current={i === idx ? 'true' : undefined} onClick={() => { setSheet(''); go(i); }}>
              <span className="num">{i + 1}</span><span className="grow t-h3">{c.title}</span>{i === idx && <span className="badge ok">Reading</span>}
            </button>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'style'} onClose={() => setSheet('')} title="Reading style">
        <div className="stack-sm">
          <span className="t-h3">Text size</span>
          <div className="row">
            <Button variant="secondary" disabled={size <= 0} onClick={() => actions.savePrefs(id, { fontSize: size - 1 })} aria-label="Smaller text">A−</Button>
            <span className="size-demo" style={{ flex: 1, textAlign: 'center' }} aria-live="polite">Size {size + 1} of 4</span>
            <Button variant="secondary" disabled={size >= 3} onClick={() => actions.savePrefs(id, { fontSize: size + 1 })} aria-label="Larger text">A+</Button>
          </div>
        </div>
        <fieldset className="stack-sm" role="radiogroup" aria-label="Reading theme">
          <legend className="t-h3" style={{ marginBottom: 8 }}>Theme</legend>
          <div className="chips">{(['light', 'sepia', 'dark'] as ThemeName[]).map((t) => <Chip key={t} radio selected={theme === t} onClick={() => actions.savePrefs(id, { theme: t })}>{t[0].toUpperCase() + t.slice(1)}</Chip>)}</div>
        </fieldset>
        <Button onClick={() => setSheet('')}>Done</Button>
      </BottomSheet>
    </Page>
  );
}

export function ReadingDone() {
  const { id: storyId = '' } = useParams();
  const { db } = useMe();
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  if (!story) return <NotFoundState what="story" to="/discover" />;
  return (
    <Page title="Finished" fallback="/library" noBack>
      <div className="empty" style={{ paddingTop: 48 }}>
        <div className="ring" style={{ background: 'var(--dark)', color: '#fff' }}><Ico i={PartyPopper} size={30} /></div>
        <h1 className="t-title">You finished<br />{story.title}</h1>
        <p className="t-meta">Saved as completed in your library. You can read it again any time.</p>
        <div className="stack-sm" style={{ width: '100%', marginTop: 12 }}>
          <LinkButton to="/library?tab=completed">Go to library</LinkButton>
          <LinkButton variant="secondary" to={`/story/${story.id}`}>Story details</LinkButton>
          <LinkButton variant="secondary" to={`/author/${story.writerId}`}>More from {db.writers[story.writerId]?.name}</LinkButton>
        </div>
      </div>
    </Page>
  );
}
void Link; void StatusBadge;
