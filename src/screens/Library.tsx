import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { isSupabaseConfigured } from '../auth/config';
import { setMode, useMode } from '../store/store';
import { Button } from '../components/ui';
import { BookMarked, BookOpen, CheckCircle2, Search } from 'lucide-react';
import { icons } from '../assets/figma';
import { Page } from '../components/Shell';
import { Chip, Cover, EmptyState, Ico, LinkButton } from '../components/ui';
import { publicStory, readingMinutes, type PubStory } from '../domain/rules';
import { useMe } from './common';

const TABS = [['all', 'All stories'], ['reading', 'Reading now'], ['want', 'Want to read'], ['finished', 'Finished']] as const;

export function Library() {
  const { db, id, role } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [hideGuest, setHideGuest] = useState(() => { try { return sessionStorage.getItem('guest-card-hidden') === '1'; } catch { return false; } });
  const guest = isSupabaseConfigured && mode === 'demo' && role === 'reader' && !hideGuest;
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as (typeof TABS)[number][0]) || 'all';
  const pub = (sid: string) => {
    const s = db.stories.find((x) => x.id === sid);
    return s && publicStory(s);
  };
  const pick = (ids: string[]) => ids.map(pub).filter((s): s is PubStory => !!s);
  const mine = db.progress.filter((p) => p.accountId === id).sort((a, b) => b.updatedAt - a.updatedAt);
  const reading = pick(mine.filter((p) => !p.completed).map((p) => p.storyId));
  const finished = pick(mine.filter((p) => p.completed).map((p) => p.storyId));
  const started = new Set(mine.map((p) => p.storyId));
  const want = pick(db.saved.filter((s) => s.accountId === id && !started.has(s.storyId)).sort((a, b) => b.savedAt - a.savedAt).map((s) => s.storyId));
  const show = { reading: tab === 'all' || tab === 'reading', want: tab === 'all' || tab === 'want', finished: tab === 'all' || tab === 'finished' };
  const savedAll = pick(db.saved.filter((s) => s.accountId === id).map((s) => s.storyId));
  const nothing = (show.reading ? reading.length : 0) + (show.want ? want.length : 0) + (show.finished ? finished.length : 0) === 0;
  const progressFor = (s: PubStory) => {
    const p = mine.find((x) => x.storyId === s.id)!;
    const f = p.completed ? 1 : Math.min(1, (p.chapterIndex + p.scroll) / s.chapters.length);
    return { p, f, left: Math.max(1, Math.round(readingMinutes(s.chapters) * (1 - f))) };
  };
  const Row = ({ s, note }: { s: PubStory; note: string }) => (
    <Link to={`/story/${s.id}`} className="lib-row" aria-label={`${s.title} by ${db.writers[s.writerId]?.name}`}>
      <Cover coverId={s.coverId} style={{ width: 66, height: 92, borderRadius: 8 }} />
      <span><b>{s.title}</b><span className="by">{db.writers[s.writerId]?.name}</span><span className="m">{readingMinutes(s.chapters)} min · {s.status === 'completed' ? 'Completed' : 'Ongoing'}</span><span className="n">{note}</span></span>
    </Link>
  );
  return (
    <Page nav noBack header={<header className="lib-head"><h1>Your library</h1><Link to="/discover" aria-label="Search stories" className="icon-btn ghost"><Ico i={Search} /></Link></header>}>
      <p className="lib-sub">Every story you want to come back to.</p>
      <div className="d-chips" role="tablist" aria-label="Library sections" style={{ marginBottom: 8 }}>
        {TABS.map(([k, l]) => <Chip key={k} radio selected={tab === k} onClick={() => setParams({ tab: k }, { replace: true })}>{l}</Chip>)}
      </div>
      <div className="stack" style={{ gap: 24 }}>
        {show.reading && reading.length > 0 && (
          <section aria-labelledby="l-pick">
            <h2 className="lib-h" id="l-pick">Pick up your story</h2>
            <div className="stack-sm">{reading.map((s) => { const { p, f, left } = progressFor(s); return (
              <Link key={s.id} className="resume" to={`/read/${s.id}/${p.chapterIndex + 1}`}>
                <Cover coverId={s.coverId} style={{ width: 64, height: 92, borderRadius: 8 }} />
                <span className="resume-info"><b>{s.title}</b><span className="t">Chapter {p.chapterIndex + 1} of {s.chapters.length} · {left} min left</span><span className="bar"><i style={{ width: `${Math.round(f * 100)}%` }} /></span><span className="go">Resume reading <img src={icons.arrowSm} alt="" width={16} height={16} /></span></span>
              </Link>); })}</div>
          </section>
        )}
        {show.want && want.length > 0 && <section aria-labelledby="l-want"><h2 className="lib-h" id="l-want">Waiting for you</h2><div className="stack" style={{ gap: 16 }}>{want.map((s) => <Row key={s.id} s={s} note="Want to read" />)}</div></section>}
        {show.finished && finished.length > 0 && <section aria-labelledby="l-fin"><h2 className="lib-h" id="l-fin">Finished</h2><div className="stack" style={{ gap: 16 }}>{finished.map((s) => <Row key={s.id} s={s} note="Finished" />)}</div></section>}
        {guest && (
          <section className="fm-guest" aria-labelledby="g-h">
            <div className="fm-card" style={{ gap: 8 }}><h2 id="g-h" className="fm-h2">Keep your stories together.</h2><p>Your place is saved on this device. Sign in to keep your reading, saved stories and preferences across devices.</p></div>
            <Button arrow onClick={() => { setMode('account'); navigate('/auth'); }}>Sign in to your library</Button>
            <button type="button" className="fm-cancel" onClick={() => { try { sessionStorage.setItem('guest-card-hidden', '1'); } catch { /* ignore */ } setHideGuest(true); }}>Keep reading as a guest</button>
          </section>
        )}
        {nothing && (
          <EmptyState
            icon={tab === 'finished' ? CheckCircle2 : tab === 'reading' ? BookOpen : BookMarked}
            title={tab === 'finished' ? 'No finished stories yet' : tab === 'reading' ? 'Nothing in progress' : tab === 'want' ? 'Nothing saved yet' : 'Your library is empty'}
            text={tab === 'finished' ? 'Stories you finish will appear here.' : 'Tap the bookmark on any story to keep it here, or start reading.'}
            action={<LinkButton to="/discover">Discover stories</LinkButton>}
          />
        )}
        {tab === 'all' && savedAll.length > 0 && want.length === 0 && reading.length + finished.length > 0 && <p className="t-help">Saved stories you’ve started appear under Reading now or Finished.</p>}
      </div>
    </Page>
  );
}
