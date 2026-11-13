import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSaveStory } from '../components/SavePrompt';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, ChevronLeft, List, PartyPopper, X } from 'lucide-react';
import { icons } from '../assets/figma';
import { Dialog } from '../components/Dialog';
import { RichText } from '../components/RichText';
import { Page } from '../components/Shell';
import { Button, Ico, IconButton, LinkButton } from '../components/ui';
import { publicStory, readingMinutes } from '../domain/rules';
import type { ThemeName } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, useMe } from './common';
import { FONT_PX, MARGINS, SPACING, useReaderExtras } from './readerExtras';

const ORD = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
const THEMES: { key: ThemeName; label: string }[] = [{ key: 'light', label: 'Light' }, { key: 'sepia', label: 'Warm' }, { key: 'dark', label: 'Dark' }];

export function Reader() {
  const { id: storyId = '', n } = useParams();
  const { db, id } = useMe();
  const saveStory = useSaveStory();
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const timer = useRef<number>();
  const latest = useRef({ idx: 0, frac: 0 });
  const [frac, setFrac] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [extras, setExtras] = useReaderExtras();
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === storyId);
  const prefs = db.prefs[id];
  const chapters = story?.chapters ?? [];
  const idx = Math.min(Math.max((parseInt(n ?? '1', 10) || 1) - 1, 0), Math.max(chapters.length - 1, 0));
  const chapter = chapters[idx];

  const measure = () => {
    const el = ref.current;
    if (!el) return 0;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? Math.min(1, el.scrollTop / max) : 0;
  };
  const save = () => {
    if (!story) return;
    const f = measure();
    latest.current = { idx, frac: f };
    actions.setProgress(id, storyId, idx, f);
  };

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
    setFrac(latest.current.frac);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, storyId, !!story]);

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
  const theme = prefs?.theme ?? 'sepia';
  const chapMin = readingMinutes([chapter]);
  const storyPct = Math.round(((idx + frac) / chapters.length) * 100);
  const minLeft = Math.max(0, Math.ceil(chapMin * (1 - frac)));
  const finish = () => {
    actions.setProgress(id, storyId, idx, 1, true);
    navigate(`/read/${storyId}/done`, { replace: true });
  };

  return (
    <Page
      className="reading"
      fallback={`/story/${storyId}`}
      scrollRef={ref}
      theme={theme}
      onScroll={() => {
        const f = measure();
        latest.current = { idx, frac: f };
        setFrac(f);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(save, 250);
      }}
      header={
        <header className="page-header r-head">
          <IconButton icon={ChevronLeft} label="Back" tone="ghost" onClick={() => navigate(`/story/${storyId}`)} />
          <h1>{story.title}</h1>
          <IconButton icon={Bookmark} pressed={saved} tone="ghost" className={saved ? 'filled' : ''} label={saved ? 'Remove from saved' : 'Save story'} onClick={() => saveStory({ id: storyId, title: story.title })} />
          <button className="r-aa" aria-label="Text size and theme" onClick={() => setSheet(true)}>Aa</button>
        </header>
      }
      footerClass="r-foot"
      footer={
        <>
          <div className="r-progress" role="progressbar" aria-label="Story progress" aria-valuenow={storyPct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${storyPct}%` }} /></div>
          <div className="r-stats"><span>{storyPct}% of story</span><span>{minLeft} min left in chapter</span></div>
          <div className="r-actions">
            <Link to={`/story/${storyId}/contents`} className="r-chap"><Ico i={List} size={20} /><span>Chapter {idx + 1} of {chapters.length}</span></Link>
            {last ? <button className="r-next" onClick={finish}>Finish story <img src={icons.dArrow} width={16} height={16} alt="" /></button>
              : <button className="r-next" onClick={() => go(idx + 1)}>Next chapter <img src={icons.dArrow} width={16} height={16} alt="" /></button>}
          </div>
        </>
      }
    >
      <article className="r-article" data-margin={extras.margin}>
        <p className="r-eyebrow">CHAPTER {ORD[idx] ?? idx + 1}</p>
        <h1 className="r-title">{chapter.title}</h1>
        <p className="r-meta">{chapMin} min read · {story.title}</p>
        <div className="prose" data-font={extras.font} data-spacing={extras.spacing} style={{ fontSize: FONT_PX[size] }}><RichText text={chapter.body} /></div>
        {idx > 0 && <Button variant="secondary" onClick={() => go(idx - 1)}>Previous chapter</Button>}
      </article>

      <Dialog open={sheet} onClose={() => setSheet(false)} label="Reading settings">
        <div className="rs-head"><h2>Make yourself comfortable</h2><button className="rs-x" aria-label="Close" onClick={() => setSheet(false)}><Ico i={X} size={24} /></button></div>
        <div className="rs-preview" data-theme={theme}><p className="prose" data-font={extras.font} data-spacing={extras.spacing} style={{ fontSize: FONT_PX[size] }}>A little room for another world.</p></div>
        <div className="rs-row"><span>Text size</span>
          <div className="rs-step">
            <button aria-label="Smaller text" disabled={size <= 0} onClick={() => actions.savePrefs(id, { fontSize: size - 1 })}>A<small>−</small></button>
            <span aria-live="polite">{FONT_PX[size]}</span>
            <button aria-label="Larger text" disabled={size >= 3} onClick={() => actions.savePrefs(id, { fontSize: size + 1 })}>A<small>+</small></button>
          </div>
        </div>
        <div className="rs-fonts" role="radiogroup" aria-label="Font">
          <button role="radio" aria-checked={extras.font === 'serif'} onClick={() => setExtras({ font: 'serif' })}>Noto Serif</button>
          <button role="radio" aria-checked={extras.font === 'sans'} className="sans" onClick={() => setExtras({ font: 'sans' })}>Exo</button>
        </div>
        <div className="rs-themes" role="radiogroup" aria-label="Reading theme">
          {THEMES.map((t) => (
            <button key={t.key} role="radio" aria-checked={theme === t.key} aria-label={t.label} className={`rs-theme ${t.key}`} onClick={() => actions.savePrefs(id, { theme: t.key })}>
              <span className="aa">Aa</span><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="rs-cycle">
          <button onClick={() => setExtras({ spacing: ((extras.spacing + 1) % 3) as 0 | 1 | 2 })}><small>Line spacing</small><span>{SPACING[extras.spacing]}</span></button>
          <button onClick={() => setExtras({ margin: ((extras.margin + 1) % 3) as 0 | 1 | 2 })}><small>Margins</small><span>{MARGINS[extras.margin]}</span></button>
        </div>
        <Button onClick={() => setSheet(false)}>Back to story <img src={icons.dArrow} width={18} height={18} alt="" style={{ filter: 'invert(1)' }} /></Button>
      </Dialog>
    </Page>
  );
}

/** Figma 03C — "Inside the story": all chapters with your place saved. */
export function Contents() {
  const { id: storyId = '' } = useParams();
  const { db, id } = useMe();
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === storyId);
  if (!story) return <NotFoundState what="story" to="/discover" />;
  const writer = db.writers[story.writerId]?.name;
  return (
    <Page title="Inside the story" fallback={`/story/${storyId}`}>
      <div className="ct-summary">
        <Link to={`/story/${storyId}`} aria-label={`${story.title} details`}><CoverMini id={story.coverId} /></Link>
        <div><h2>{story.title}</h2><p>{writer}</p><p className="t">{story.chapters.length} chapters · {readingMinutes(story.chapters)} min · {story.status === 'completed' ? 'Completed' : 'Ongoing'}</p></div>
      </div>
      {prog && <p className="ct-label">YOUR PLACE IS SAVED</p>}
      <ol className="ct-list">
        {story.chapters.map((c, i) => {
          const read = !!prog && (prog.completed || i < prog.chapterIndex);
          const now = !!prog && !prog.completed && i === prog.chapterIndex;
          return (
            <li key={c.id}>
              <Link to={`/read/${storyId}/${i + 1}`} className={now ? 'now' : ''}>
                <span className="n">{read ? '✓' : String(i + 1).padStart(2, '0')}</span>
                <span><b>{c.title}</b><small>{now ? 'Reading now' : read ? 'Read' : ''}{now || read ? ' · ' : ''}{readingMinutes([c])} min{!now && !read ? ' read' : ''}</small></span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
import { Cover } from '../components/ui';
const CoverMini = ({ id }: { id: string }) => <Cover coverId={id} style={{ width: 66, height: 96, borderRadius: 8 }} />;

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
        <p className="t-meta">Saved as finished in your library. You can read it again any time.</p>
        <div className="stack-sm" style={{ width: '100%', marginTop: 12 }}>
          <LinkButton to="/library?tab=finished">Go to library</LinkButton>
          <LinkButton variant="secondary" to={`/story/${story.id}`}>Story details</LinkButton>
          <LinkButton variant="secondary" to={`/author/${story.writerId}`}>More from {db.writers[story.writerId]?.name}</LinkButton>
        </div>
      </div>
    </Page>
  );
}
