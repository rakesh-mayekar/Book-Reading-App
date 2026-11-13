import { useCallback, useState } from 'react';

/** Reader settings that are local to this device (font, line spacing, margins). Text size and theme sync with the account. */
export interface ReaderExtras { font: 'serif' | 'sans'; spacing: 0 | 1 | 2; margin: 0 | 1 | 2 }
const KEY = 'br-reader-extras';
const DEFAULT: ReaderExtras = { font: 'serif', spacing: 1, margin: 1 };
export const SPACING = ['Compact', 'Comfortable', 'Airy'] as const;
export const MARGINS = ['Narrow', 'Standard', 'Wide'] as const;

function read(): ReaderExtras {
  try {
    return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ReaderExtras>) };
  } catch {
    return DEFAULT;
  }
}
export function useReaderExtras(): [ReaderExtras, (p: Partial<ReaderExtras>) => void] {
  const [v, setV] = useState<ReaderExtras>(read);
  const update = useCallback((p: Partial<ReaderExtras>) => {
    setV((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [v, update];
}
export const FONT_PX = [16, 18, 20, 22] as const;
