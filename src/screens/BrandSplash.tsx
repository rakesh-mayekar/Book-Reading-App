import { useEffect, useState } from 'react';
import { logo } from '../assets/figma';

const SEEN_KEY = 'br-splash-seen';
export const splashSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

/** Figma 1.1A → 1.1B → 1.1C: initial stroke, book reveal, "Stories" wordmark. Shown once per launch. */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'a' | 'b' | 'c' | 'out'>(reduced ? 'c' : 'a');
  useEffect(() => {
    const t = reduced
      ? [setTimeout(() => setPhase('out'), 900), setTimeout(done, 1200)]
      : [setTimeout(() => setPhase('b'), 700), setTimeout(() => setPhase('c'), 1350), setTimeout(() => setPhase('out'), 2650), setTimeout(done, 3000)];
    function done() {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
      onDone();
    }
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`splash phase-${phase}`} role="img" aria-label="Stories">
      <div className="splash-logo" aria-hidden="true">
        <div className="splash-mark">
          <img className="splash-stroke" src={logo.stroke} width={66.4} height={2.4} alt="" />
          <img className="splash-book" src={logo.book} width={66.4} height={49.75} alt="" />
        </div>
        <span className="splash-word">Stories</span>
      </div>
    </div>
  );
}
