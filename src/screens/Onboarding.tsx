import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clapperboard, PenLine, Sparkles } from 'lucide-react';
import { Button, Chip, Ico } from '../components/ui';
import { GENRES, LANGUAGES } from '../domain/types';
import { actions, useMode } from '../store/store';
import { useMe } from './common';

export function PrefsPicker({ genres, languages, setGenres, setLanguages, dark }: { genres: string[]; languages: string[]; setGenres: (g: string[]) => void; setLanguages: (l: string[]) => void; dark?: boolean }) {
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="stack">
      <fieldset>
        <legend className="t-h3" style={{ marginBottom: 8 }}>Genres you enjoy <span className={dark ? 't-help' : 'muted'}>(choose at least one)</span></legend>
        <div className="chips">{GENRES.map((g) => <Chip key={g} selected={genres.includes(g)} onClick={() => setGenres(toggle(genres, g))}>{g}</Chip>)}</div>
      </fieldset>
      <fieldset>
        <legend className="t-h3" style={{ marginBottom: 8 }}>Reading languages <span className={dark ? 't-help' : 'muted'}>(choose at least one)</span></legend>
        <div className="chips">{LANGUAGES.map((g) => <Chip key={g} selected={languages.includes(g)} onClick={() => setLanguages(toggle(languages, g))}>{g}</Chip>)}</div>
      </fieldset>
    </div>
  );
}

const INTRO = [
  { icon: BookOpen, title: 'Read stories for free', text: 'Browse original stories across genres and languages. Every story is free to read, with your place saved as you go.' },
  { icon: PenLine, title: 'Write and publish', text: 'Writers draft chapters, preview them like a reader, and publish when ready, keeping drafts separate from what readers see.' },
  { icon: Clapperboard, title: 'Discover adaptations', text: 'Filmmakers can contact writers who are open to adaptation enquiries. Acceptance only opens a conversation.' },
];

export function Onboarding() {
  const { id, name } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const last = INTRO.length + 1;
  const valid = genres.length > 0 && languages.length > 0;
  return (
    <div className="page onboard">
      <main className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="step-anim" key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: step === last ? 'flex-start' : 'center', gap: 20, paddingTop: step === last ? 24 : 0 }}>
          {step === 0 && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.5)', display: 'grid', placeItems: 'center' }}><Ico i={Sparkles} size={32} /></div>
              <h1 style={{ font: '600 44px/1.1 var(--font-serif)' }}>Stories</h1>
              <p style={{ font: '400 20px/1.5 var(--font-serif)', opacity: .9 }}>Read freely. Write boldly. Let a good story find its way to the screen.</p>
              <p className="t-meta">Hello {name.split(' ')[0]}{mode === 'demo' ? ' — this is demo mode with sample data on this device.' : '.'}</p>
            </>
          )}
          {step > 0 && step < last && (
            <>
              <div className="dots" aria-label={`Step ${step} of ${INTRO.length}`}>{INTRO.map((_, i) => <i key={i} className={i === step - 1 ? 'on' : ''} />)}</div>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center' }}><Ico i={INTRO[step - 1].icon} size={30} /></div>
              <h1 style={{ font: '600 30px/1.2 var(--font-serif)' }}>{INTRO[step - 1].title}</h1>
              <p style={{ fontSize: 17, lineHeight: 1.6, opacity: .9 }}>{INTRO[step - 1].text}</p>
            </>
          )}
          {step === last && (
            <>
              <h1 style={{ font: '600 28px/1.2 var(--font-serif)' }}>Tell us what you like</h1>
              <p className="t-meta">We use this to shape your Discover page. You can change it later in your profile.</p>
              <PrefsPicker dark genres={genres} languages={languages} setGenres={setGenres} setLanguages={setLanguages} />
            </>
          )}
        </div>
      </main>
      <div className="footer-bar" style={{ background: 'var(--dark)', borderColor: 'rgba(255,255,255,.15)' }}>
        {step < last ? (
          <>
            <Button onClick={() => setStep(step + 1)}>{step === 0 ? 'Get started' : 'Continue'}</Button>
            <div className="row between">
              {step > 0 ? <button className="btn-link" onClick={() => setStep(last)}>Skip intro</button> : <span />}
              {mode === 'demo' ? <Link className="btn-link t-meta" to="/profile/demo">Demo controls</Link> : <span />}
            </div>
          </>
        ) : (
          <>
            <Button
              disabled={!valid}
              onClick={() => {
                actions.savePrefs(id, { genres, languages, onboarded: true });
                navigate('/discover', { replace: true });
              }}
            >
              Save and continue
            </Button>
            {!valid && <p className="t-help" style={{ textAlign: 'center' }}>Choose at least one genre and one language to continue.</p>}
          </>
        )}
      </div>
    </div>
  );
}
