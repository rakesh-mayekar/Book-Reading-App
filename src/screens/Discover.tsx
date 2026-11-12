import { useMemo, useState } from 'react';
import { SearchX, Search, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '../components/Dialog';
import { Page } from '../components/Shell';
import { Button, Chip, Cover, EmptyState, Ico, IconButton } from '../components/ui';
import { publishedStories, readingMinutes } from '../domain/rules';
import { GENRES, LANGUAGES, type Filters } from '../domain/types';
import { actions } from '../store/store';
import { StoryCard, useMe } from './common';
import { Link } from 'react-router-dom';

const EMPTY: Filters = { genres: [], languages: [], status: '', query: '' };

export function Discover() {
  const { db, id, role, name } = useMe();
  const [sheet, setSheet] = useState(false);
  const mode = role === 'filmmaker' ? 'adapt' : 'read';
  const key = `${id}:discover`;
  const f = db.filters[key] ?? EMPTY;
  const set = (p: Partial<Filters>) => actions.setFilters(key, { ...f, ...p });
  const prefs = db.prefs[id];
  const all = useMemo(() => publishedStories(db).filter((s) => (mode === 'adapt' ? s.adaptationOpen : true)), [db, mode]);
  const q = f.query.trim().toLowerCase();
  const active = !!q || f.genres.length > 0 || f.languages.length > 0 || !!f.status;
  const filterCount = f.genres.length + f.languages.length + (f.status ? 1 : 0);
  const results = all.filter((s) => {
    if (f.genres.length && !f.genres.includes(s.genre)) return false;
    if (f.languages.length && !f.languages.includes(s.language)) return false;
    if (f.status && s.status !== f.status) return false;
    if (q && !`${s.title} ${db.writers[s.writerId]?.name ?? ''} ${s.genre} ${s.synopsis}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const continuing = all.filter((s) => db.progress.some((p) => p.accountId === id && p.storyId === s.id && !p.completed));
  const picked = all.filter((s) => prefs && (prefs.genres.includes(s.genre) || prefs.languages.includes(s.language)));
  const hero = all[0];
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const header = (
    <header className="hero-head">
      {hero && <div className="bgart" aria-hidden="true"><Cover coverId={hero.coverId} style={{ width: '100%', height: '100%', borderRadius: 0 }} /></div>}
      <div className="eyebrow">{mode === 'adapt' ? 'Adaptation discovery' : `Welcome, ${name.split(' ')[0]}`}</div>
      <h1>{mode === 'adapt' ? 'Find a story worth adapting' : 'Find your next story'}</h1>
      <div className="searchbar" role="search">
        <div className="searchbox">
          <Ico i={Search} size={20} />
          <label className="sr-only" htmlFor="disc-search">Search stories</label>
          <input id="disc-search" type="search" className="input" placeholder="Search title, writer or genre" value={f.query} onChange={(e) => set({ query: e.target.value })} />
        </div>
        <div style={{ position: 'relative' }}>
          <IconButton className="light" icon={SlidersHorizontal} label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} onClick={() => setSheet(true)} />
          {filterCount > 0 && <span className="nav-badge" style={{ top: -4, left: 'auto', right: -4 }} aria-hidden="true">{filterCount}</span>}
        </div>
      </div>
    </header>
  );

  return (
    <Page nav header={header} noBack>
      <div style={{ paddingTop: 20 }}>
        {active ? (
          <section aria-label="Search results">
            <div className="section-head">
              <h2 className="t-h2">{results.length} {results.length === 1 ? 'story' : 'stories'}</h2>
              <button className="btn-link" onClick={() => actions.setFilters(key, EMPTY)}>Clear filters</button>
            </div>
            {results.length ? (
              <div className="stack-sm">{results.map((s) => <StoryCard key={s.id} story={s} />)}</div>
            ) : (
              <EmptyState icon={SearchX} title="No stories match" text="Try a different search or loosen the filters." action={<Button variant="secondary" onClick={() => actions.setFilters(key, EMPTY)}>Clear filters</Button>} />
            )}
          </section>
        ) : (
          <>
            {mode === 'read' && continuing.length > 0 && (
              <section aria-labelledby="h-cont">
                <div className="section-head"><h2 className="t-h2" id="h-cont">Continue reading</h2></div>
                <div className="stack-sm">{continuing.map((s) => <StoryCard key={s.id} story={s} showProgress />)}</div>
              </section>
            )}
            {mode === 'read' && picked.length > 0 && (
              <section className="section" aria-labelledby="h-pick" style={continuing.length ? undefined : { marginTop: 0 }}>
                <div className="section-head"><h2 className="t-h2" id="h-pick">Picked for you</h2><span className="t-help">From your preferences</span></div>
                <div className="hscroll">
                  {picked.map((s) => (
                    <Link key={s.id} to={`/story/${s.id}`} className="tile">
                      <Cover coverId={s.coverId} style={{ width: 138, height: 190 }} />
                      <h3>{s.title}</h3>
                      <span className="t-meta">{db.writers[s.writerId]?.name} · {readingMinutes(s.chapters)} min</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <section className="section" aria-labelledby="h-all" style={mode === 'adapt' || (!continuing.length && !picked.length) ? { marginTop: 0 } : undefined}>
              <div className="section-head"><h2 className="t-h2" id="h-all">{mode === 'adapt' ? 'Open to adaptation enquiries' : 'All stories'}</h2></div>
              {mode === 'adapt' && <p className="t-help" style={{ marginBottom: 12 }}>Availability is declared by each writer. It is not proof of rights ownership.</p>}
              <div className="stack-sm">{all.map((s) => <StoryCard key={s.id} story={s} />)}</div>
              {!all.length && <EmptyState icon={SearchX} title="Nothing here yet" text="Stories will appear when writers publish them." />}
            </section>
          </>
        )}
      </div>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Filter stories">
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Genre</legend><div className="chips">{GENRES.map((g) => <Chip key={g} selected={f.genres.includes(g)} onClick={() => set({ genres: toggle(f.genres, g) })}>{g}</Chip>)}</div></fieldset>
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Language</legend><div className="chips">{LANGUAGES.map((g) => <Chip key={g} selected={f.languages.includes(g)} onClick={() => set({ languages: toggle(f.languages, g) })}>{g}</Chip>)}</div></fieldset>
        <fieldset><legend className="t-h3" style={{ marginBottom: 8 }}>Completion</legend>
          <div className="chips">{(['completed', 'ongoing'] as const).map((s) => <Chip key={s} selected={f.status === s} onClick={() => set({ status: f.status === s ? '' : s })}>{s === 'completed' ? 'Completed' : 'Ongoing'}</Chip>)}</div>
        </fieldset>
        <div className="stack-sm">
          <Button onClick={() => setSheet(false)}>Show {results.length} {results.length === 1 ? 'story' : 'stories'}</Button>
          <Button variant="secondary" onClick={() => actions.setFilters(key, { ...EMPTY, query: f.query })}>Clear filters</Button>
        </div>
      </BottomSheet>
    </Page>
  );
}
