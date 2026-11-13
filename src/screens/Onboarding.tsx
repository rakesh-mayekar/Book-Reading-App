import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { art, genreIcon, ui } from '../assets/figma';
import { Chip } from '../components/ui';
import { GENRES, LANGUAGES } from '../domain/types';
import { setBars } from '../native/bars';
import { actions, useMode } from '../store/store';
import { useMe } from './common';

/** Chip-style picker, still used by Profile → Reading preferences. */
export function PrefsPicker({ genres, languages, setGenres, setLanguages }: { genres: string[]; languages: string[]; setGenres: (g: string[]) => void; setLanguages: (l: string[]) => void }) {
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="stack">
      <fieldset>
        <legend className="t-h3" style={{ marginBottom: 8 }}>Genres you enjoy <span className="muted">(choose at least one)</span></legend>
        <div className="chips">{GENRES.map((g) => <Chip key={g} selected={genres.includes(g)} onClick={() => setGenres(toggle(genres, g))}>{g}</Chip>)}</div>
      </fieldset>
      <fieldset>
        <legend className="t-h3" style={{ marginBottom: 8 }}>Reading languages <span className="muted">(choose at least one)</span></legend>
        <div className="chips">{LANGUAGES.map((g) => <Chip key={g} selected={languages.includes(g)} onClick={() => setLanguages(toggle(languages, g))}>{g}</Chip>)}</div>
      </fieldset>
    </div>
  );
}

const SLIDES = [
  { key: 'read', eyebrow: 'READ ORIGINAL STORIES', title: ['Your next story', 'starts here.'], body: ['Read original stories and discover', 'voices worth following.'], cta: 'Next', art: art.read },
  { key: 'write', eyebrow: 'WRITE YOUR NEXT CHAPTER', title: ['Give your story', 'a world.'], body: ['Publish your stories, chapter by chapter,', 'and connect with readers.'], cta: 'Next', art: art.write },
  { key: 'adapt', eyebrow: 'FROM PAGE TO SCREEN', title: ['Some stories', 'belong on screen.'], body: ['Discover stories open to adaptation and', 'connect directly with their writers.'], cta: 'Explore stories', art: art.adapt },
] as const;

const LANGUAGE_META: Record<string, { script: string; native: string; devanagari?: boolean }> = {
  English: { script: 'Aa', native: 'English' },
  Hindi: { script: 'अ', native: 'हिन्दी', devanagari: true },
  Marathi: { script: 'म', native: 'मराठी', devanagari: true },
};

const lines = (a: readonly string[]) => a.map((l, i) => <span key={i}>{l}{i < a.length - 1 && <br />}</span>);

function PrefStep({ step, name, title, sub, onBack, onSkip, helper, cta, canContinue, onContinue, children, note }: {
  step: 1 | 2; name: string; title: readonly string[]; sub: readonly string[]; onBack: () => void; onSkip: () => void; helper: string; cta: string; canContinue: boolean; onContinue: () => void; children: React.ReactNode; note?: React.ReactNode;
}) {
  return (
    <div className="page pref-page">
      <div className="pref-nav">
        <button className="pref-back" aria-label="Back" onClick={onBack}><img src={ui.back} alt="" width={44} height={44} /></button>
        <button className="pref-skip" onClick={onSkip}>Skip</button>
      </div>
      <div className="pref-progress"><span>STEP {step} OF 2</span><span>{name}</span></div>
      <div className="pref-track" role="progressbar" aria-valuemin={0} aria-valuemax={2} aria-valuenow={step}><i style={{ width: step === 1 ? '48.2%' : '100%' }} /></div>
      <div className="pref-intro">
        <h1>{lines(title)}</h1>
        <p>{lines(sub)}</p>
      </div>
      <div className="pref-list">{children}{note}</div>
      <div className="pref-foot">
        <p className="pref-helper" aria-live="polite">{helper}</p>
        <button className="onb-btn dark" disabled={!canContinue} onClick={onContinue}>
          <span>{cta}</span><img src={ui.arrowLight} width={18} height={18} alt="" />
        </button>
      </div>
    </div>
  );
}

/** Figma 1.2 (Read / Write / Adapt), 1.3 (genre) and 1.4 (language). */
export function Onboarding() {
  const { id } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0-2 slides, 3 genre, 4 language
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  useEffect(() => setBars({ darkBackground: step < 3 }), [step]);
  useEffect(() => () => setBars({ darkBackground: false }), []);

  const finish = () => {
    actions.savePrefs(id, { genres, languages, onboarded: true });
    navigate('/discover', { replace: true });
  };

  if (step === 3)
    return (
      <PrefStep step={1} name="YOUR TASTE" title={['What draws you', 'into a story?']} sub={['Pick your favourites. You can change', 'these anytime.']}
        onBack={() => setStep(2)} onSkip={() => setStep(4)}
        helper={genres.length ? `${genres.length} ${genres.length === 1 ? 'genre' : 'genres'} selected` : 'Select at least one genre'}
        cta="Continue" canContinue={genres.length > 0} onContinue={() => setStep(4)}>
        <div className="genre-grid">
          {GENRES.map((g) => {
            const on = genres.includes(g);
            return (
              <button key={g} className={`gcard ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setGenres(toggle(genres, g))}>
                <span className="gcard-top">
                  <span className="gicon" style={{ ['--icon' as string]: `url(${genreIcon[g]})` }} aria-hidden="true" />
                  <img src={on ? ui.checkOn : ui.checkOff} width={16} height={16} alt="" />
                </span>
                <span className="gname">{g}</span>
              </button>
            );
          })}
        </div>
      </PrefStep>
    );

  if (step === 4)
    return (
      <PrefStep step={2} name="YOUR LANGUAGES" title={['Which languages', 'do you read?']} sub={['Choose the languages you enjoy.', 'You can pick more than one.']}
        onBack={() => setStep(3)} onSkip={finish}
        helper={languages.length ? `${languages.length} ${languages.length === 1 ? 'language' : 'languages'} selected` : 'Select at least one language'}
        cta="Explore stories" canContinue={languages.length > 0} onContinue={finish}
        note={<div className="lang-note"><p>Your stories, in your languages.</p><p>This changes story recommendations,<br />not the app language.</p></div>}>
        <div className="lang-list">
          {LANGUAGES.map((l) => {
            const on = languages.includes(l);
            const m = LANGUAGE_META[l];
            return (
              <button key={l} className={`lcard ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setLanguages(toggle(languages, l))}>
                <span className={`lscript ${m.devanagari ? 'deva' : ''}`} aria-hidden="true">{m.script}</span>
                <span className="llabels"><span className="lname">{l}</span><span className={`lnative ${m.devanagari ? 'deva' : ''}`}>{m.native}</span></span>
                <img src={on ? ui.langOn : ui.langOff} width={18} height={18} alt="" />
              </button>
            );
          })}
        </div>
      </PrefStep>
    );

  const s = SLIDES[step];
  return (
    <div className="page onb-slide">
      {SLIDES.map((x, i) => <img key={x.key} className={`onb-art ${i === step ? 'on' : ''}`} src={x.art} alt="" />)}
      <div className="onb-shade" />
      <header className="onb-top">
        <span className="onb-brand">Stories</span>
        <button className="onb-skip" onClick={() => setStep(3)}>Skip</button>
      </header>
      <div className="onb-content" key={s.key}>
        <p className="onb-eyebrow">{s.eyebrow}</p>
        <h1 className="onb-title">{lines(s.title)}</h1>
        <p className="onb-body">{lines(s.body)}</p>
        <button className="onb-btn light" onClick={() => setStep(step + 1)}>
          <span>{s.cta}</span><img src={ui.arrowDark} width={18} height={18} alt="" />
        </button>
        <div className="onb-dots-row">
          <div className="onb-dots" role="group" aria-label="Introduction steps">
            {SLIDES.map((x, i) => <button key={x.key} className={i === step ? 'on' : ''} aria-label={`Go to step ${i + 1} of ${SLIDES.length}`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)} />)}
          </div>
          {mode === 'demo' && <Link className="onb-demo" to="/profile/demo">Demo controls</Link>}
        </div>
      </div>
    </div>
  );
}
