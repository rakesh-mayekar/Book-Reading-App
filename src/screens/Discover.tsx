import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { artwork, genreIcon, icons } from '../assets/figma';
import { BottomSheet } from '../components/Dialog';
import { Page } from '../components/Shell';
import { Button, Chip, Cover, EmptyState } from '../components/ui';
import { publishedStories, readingMinutes, type PubStory } from '../domain/rules';
import { GENRES, LANGUAGES, type Filters } from '../domain/types';
import { actions } from '../store/store';
import { AdaptDiscover } from './Filmmaker';
import { StoryTile, useMe } from './common';

const EMPTY: Filters = { genres: [], languages: [], status: '', query: '', openOnly: false };

function Section({ title, stories, onSeeAll }: { title: string; stories: PubStory[]; onSeeAll: () => void }) {
  if (!stories.length) return null;
  const id = title.replace(/\W+/g, '-').toLowerCase();
  return (
    <section className="d-section" aria-labelledby={id}>
      <div className="d-head"><h2 id={id}>{title}</h2><button className="d-seeall" onClick={onSeeAll}>See all</button></div>
      <div className="d-row">{stories.slice(0, 6).map((s) => <StoryTile key={s.id} story={s} />)}</div>
    </section>
  );
}

export function Discover() {
  const { role } = useMe();
  return role === 'filmmaker' ? <AdaptDiscover /> : <ReaderDiscover />;
}

function ReaderDiscover() {
  const { db, id, role, name } = useMe();
  const [sheet, setSheet] = useState(false);
  const [seeAll, setSeeAll] = useState<{ title: string; stories: PubStory[] } | null>(null);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number>();
  const scrollRef = useRef<HTMLElement>(null);
  const mode = role === 'filmmaker' ? 'adapt' : 'read';
  const key = `${id}:discover`;
  const f = { ...EMPTY, ...(db.filters[key] ?? {}) };
  const set = (p: Partial<Filters>) => actions.setFilters(key, { ...f, ...p });
  const prefs = db.prefs[id];
  const all = useMemo(() => publishedStories(db).filter((s) => (mode === 'adapt' ? s.adaptationOpen : true)), [db, mode]);
  const q = f.query.trim().toLowerCase();
  const filterCount = f.languages.length + (f.status ? 1 : 0) + (f.openOnly ? 1 : 0);
  const active = !!q || f.genres.length > 0 || filterCount > 0;
  const results = all.filter((s) => {
    if (f.genres.length && !f.genres.includes(s.genre)) return false;
    if (f.languages.length && !f.languages.includes(s.language)) return false;
    if (f.status && s.status !== f.status) return false;
    if (f.openOnly && !s.adaptationOpen) return false;
    if (q && !`${s.title} ${db.writers[s.writerId]?.name ?? ''} ${s.genre} ${s.synopsis}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const chipGenres = (prefs?.genres.length ? prefs.genres : ['Mystery', 'Drama', 'Fantasy']).slice(0, 3);
  const inProgress = all.map((s) => ({ s, p: db.progress.find((p) => p.accountId === id && p.storyId === s.id && !p.completed) })).filter((x) => x.p).sort((a, b) => b.p!.updatedAt - a.p!.updatedAt)[0];
  const featured = all.find((s) => s.id === 'story-last-train') ?? all[0];
  const picked = (prefs && (prefs.genres.length || prefs.languages.length) ? all.filter((s) => prefs.genres.includes(s.genre) || prefs.languages.includes(s.language)) : all).filter((s) => s.id !== featured?.id);
  const quick = [...all].sort((a, b) => readingMinutes(a.chapters) - readingMinutes(b.chapters));
  const complete = all.filter((s) => s.status === 'completed');
  const writers = [...new Set(all.map((s) => s.writerId))].map((w) => db.writers[w]).filter(Boolean).slice(0, 4);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const top = () => scrollRef.current?.scrollTo({ top: 0 });
  const clear = () => { actions.setFilters(key, EMPTY); setSeeAll(null); };

  const hero = (
    <div className={`d-hero ${focused ? 'compact' : ''}`}>
      <img className="d-hero-art" src={artwork.hero} alt="" />
      <div className="d-hero-shade" />
      <div className="d-hero-inner">
        <div className="d-brand"><span>Stories</span><Link to="/profile" className="d-profile" aria-label={`Profile — ${name}`}><img src={icons.profileCircle} alt="" width={44} height={44} /></Link></div>
        <div className="d-title">
          <h1>{mode === 'adapt' ? <>Find a story<br />worth adapting.</> : <>One story.<br />Another world.</>}</h1>
          <p>{mode === 'adapt' ? 'Stories open to adaptation enquiries.' : 'Original stories. Extraordinary worlds.'}</p>
        </div>
        <div className="d-search" role="search">
          <img src={icons.search} alt="" width={18} height={18} />
          <label className="sr-only" htmlFor="disc-search">Search stories or writers</label>
          <input id="disc-search" type="search" placeholder="Search stories or writers" value={f.query} enterKeyHint="search"
            onChange={(e) => set({ query: e.target.value })}
            onFocus={() => { window.clearTimeout(blurTimer.current); setFocused(true); }}
            onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 300); }} />
          <button className="d-filter" aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} onClick={() => setSheet(true)}>
            <img src={icons.filterCircle} alt="" width={44} height={44} />{filterCount > 0 && <span className="d-dot" aria-hidden="true">{filterCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );

  const chips = (
    <div className="d-chips" role="group" aria-label="Genres">
      <Chip selected={f.genres.length === 0} onClick={() => set({ genres: [] })}>For you</Chip>
      {chipGenres.map((g) => <Chip key={g} selected={f.genres.length === 1 && f.genres[0] === g} onClick={() => set({ genres: f.genres[0] === g && f.genres.length === 1 ? [] : [g] })}>{g}</Chip>)}
    </div>
  );

  const grid = (stories: PubStory[], title: string) => (
    <section aria-label={title}>
      <div className="d-head"><h2>{title}</h2>{(seeAll || active) && <button className="d-seeall" onClick={clear}>{active ? 'Clear filters' : 'Back'}</button>}</div>
      {stories.length ? <div className="d-grid">{stories.map((s) => <StoryTile key={s.id} story={s} />)}</div>
        : <EmptyState icon={SearchX} title="No stories match" text="Try a different search or loosen the filters." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />}
    </section>
  );

  return (
    <Page nav noBack flush header={<></>} scrollRef={scrollRef} className="discover">
      {hero}
      <div className="d-body">
        {chips}
        {seeAll ? grid(seeAll.stories, seeAll.title) : active ? grid(results, `${results.length} ${results.length === 1 ? 'story' : 'stories'}`) : (
          <>
            {mode === 'read' && inProgress && (
              <section className="d-section" aria-labelledby="pick-up">
                <div className="d-head"><h2 id="pick-up">Pick up your story</h2></div>
                <Link className="resume" to={`/read/${inProgress.s.id}`}>
                  <Cover coverId={inProgress.s.coverId} style={{ width: 64, height: 92, borderRadius: 8 }} />
                  <span className="resume-info">
                    <b>{inProgress.s.title}</b>
                    <span className="t">Chapter {inProgress.p!.chapterIndex + 1} of {inProgress.s.chapters.length} · {Math.max(1, Math.round(readingMinutes(inProgress.s.chapters) * (1 - Math.min(1, (inProgress.p!.chapterIndex + inProgress.p!.scroll) / inProgress.s.chapters.length))))} min left</span>
                    <span className="bar"><i style={{ width: `${Math.round(Math.min(1, (inProgress.p!.chapterIndex + inProgress.p!.scroll) / inProgress.s.chapters.length) * 100)}%` }} /></span>
                    <span className="go">Resume reading <img src={icons.arrowSm} alt="" width={16} height={16} /></span>
                  </span>
                </Link>
              </section>
            )}
            {featured && (
              <Link className="feature" to={`/story/${featured.id}`} aria-label={`Editor’s pick: ${featured.title}`}>
                <img src={artwork.hero} alt="" />
                <span className="feature-shade" />
                <span className="eyebrow">EDITOR’S PICK</span>
                <span className="ftitle">{featured.title}</span>
                <span className="fsub">{featured.synopsis.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')}</span>
                <span className="fmeta">{featured.genre} · {readingMinutes(featured.chapters)} min · {featured.status === 'completed' ? 'Completed' : 'Ongoing'}</span>
                <span className="fbtn">Read story <img src={icons.dArrow} alt="" width={18} height={18} /></span>
              </Link>
            )}
            <Section title="Chosen for you" stories={picked} onSeeAll={() => { setSeeAll({ title: 'Chosen for you', stories: picked }); top(); }} />
            <Section title="A story in one sitting" stories={quick} onSeeAll={() => { setSeeAll({ title: 'A story in one sitting', stories: quick }); top(); }} />
            <Section title="Complete worlds to enter" stories={complete} onSeeAll={() => { setSeeAll({ title: 'Complete worlds to enter', stories: complete }); top(); }} />
            <section className="d-section" aria-labelledby="curious">
              <div className="d-head"><h2 id="curious">Follow your curiosity</h2></div>
              <div className="d-genres">
                {chipGenres.map((g) => (
                  <button key={g} className="d-genre" onClick={() => { set({ genres: [g] }); top(); }}>
                    <span className="gicon" style={{ ['--icon' as string]: `url(${genreIcon[g]})` }} aria-hidden="true" />
                    <span>{g}</span>
                  </button>
                ))}
              </div>
            </section>
            {mode === 'read' && (
              <section className="d-section" aria-labelledby="screen">
                <div className="d-head"><h2 id="screen">From page to screen</h2></div>
                <button className="adapt-banner" onClick={() => { set({ openOnly: true }); top(); }}>
                  <img src={artwork.frame} alt="" />
                  <span className="adapt-shade" />
                  <span className="eyebrow">STORIES OPEN TO ADAPTATION</span>
                  <span className="atitle">Find your next film.</span>
                  <span className="alink">Explore the stories</span>
                </button>
              </section>
            )}
            <section className="d-section" aria-labelledby="tellers">
              <div className="d-head"><h2 id="tellers">Meet the storytellers</h2></div>
              <div className="stack-sm">
                {writers.map((w) => (
                  <Link key={w.id} to={`/author/${w.id}`} className="teller">
                    <span className="ini" aria-hidden="true">{w.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
                    <span><b>{w.name}</b><span className="t">{w.bio.split(/(?<=\.)\s/)[0]}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Filter stories">
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Genre</legend><div className="chips">{GENRES.map((g) => <Chip key={g} selected={f.genres.includes(g)} onClick={() => set({ genres: toggle(f.genres, g) })}>{g}</Chip>)}</div></fieldset>
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Language</legend><div className="chips">{LANGUAGES.map((g) => <Chip key={g} selected={f.languages.includes(g)} onClick={() => set({ languages: toggle(f.languages, g) })}>{g}</Chip>)}</div></fieldset>
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Completion</legend>
          <div className="chips">{(['completed', 'ongoing'] as const).map((s) => <Chip key={s} selected={f.status === s} onClick={() => set({ status: f.status === s ? '' : s })}>{s === 'completed' ? 'Completed' : 'Ongoing'}</Chip>)}
            <Chip selected={!!f.openOnly} onClick={() => set({ openOnly: !f.openOnly })}>Open to adaptation</Chip></div>
        </fieldset>
        <div className="stack-sm">
          <Button onClick={() => setSheet(false)}>Show {results.length} {results.length === 1 ? 'story' : 'stories'}</Button>
          <Button variant="secondary" onClick={() => actions.setFilters(key, { ...EMPTY, query: f.query })}>Clear filters</Button>
        </div>
      </BottomSheet>
    </Page>
  );
}
