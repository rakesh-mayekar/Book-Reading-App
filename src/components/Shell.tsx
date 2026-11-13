import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from './ui';
import { nav } from '../assets/figma';
import { useDB, useMode } from '../store/store';
import { roleOf } from '../domain/rules';

/* Toast */
type T = { id: number; text: string };
const toastListeners = new Set<(t: T) => void>();
let toastId = 0;
export const toast = (text: string) => toastListeners.forEach((l) => l({ id: ++toastId, text }));
function ToastHost() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const l = (t: T) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((y) => y.id !== t.id)), 3200);
    };
    toastListeners.add(l);
    return () => void toastListeners.delete(l);
  }, []);
  return <div className="toast-host" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="canvas" id="app-canvas">
      {children}
      <ToastHost />
    </div>
  );
}

const scrollMemory = new Map<string, number>();

function useTextEditing() {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const isText = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button'].includes((t as HTMLInputElement).type)));
    let t: number | undefined;
    // Delay un-hiding so a tap that blurs the field is not lost to a layout shift.
    const on = (e: FocusEvent) => { window.clearTimeout(t); setEditing(isText(e.target)); };
    const off = () => { window.clearTimeout(t); t = window.setTimeout(() => setEditing(false), 300); };
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);
  return editing;
}

export function BottomNav() {
  const db = useDB();
  const editing = useTextEditing();
  const role = roleOf(db.activeAccountId);
  const pending = db.enquiries.filter((e) => e.writerId === db.activeAccountId && e.status === 'pending').length;
  type Item = { to: string; label: string; icon: string; badge?: number };
  const home: Item = { to: '/discover', label: 'Discover', icon: nav.home };
  const me: Item = { to: '/profile', label: 'Me', icon: nav.me };
  const items: Item[] =
    role === 'writer'
      ? [home, { to: '/writer/dashboard', label: 'Write', icon: nav.write }, { to: '/enquiries', label: 'Inbox', icon: nav.inbox, badge: pending }, me]
      : role === 'filmmaker'
        ? [home, { to: '/library', label: 'Library', icon: nav.library }, { to: '/enquiries', label: 'Inbox', icon: nav.inbox }, me]
        : [home, { to: '/library', label: 'Library', icon: nav.library }, me];
  return (
    <nav className={`bottom-nav ${editing ? 'hidden' : ''}`} aria-label="Main">
      <div className="nav-pill">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} replace className="nav-item">
            <span className="nav-icon"><img src={it.icon} alt="" /></span>
            <span>{it.label}</span>
            {!!it.badge && <span className="nav-badge" aria-label={`${it.badge} pending`}>{it.badge}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function useBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

export function Page({ title, fallback = '/', right, children, footer, nav, flush, header, noBack, className = '', theme, scrollRef, onScroll, onBack, footerClass = '', centerTitle }: {
  title?: string; fallback?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode; nav?: boolean; flush?: boolean; header?: ReactNode; noBack?: boolean; className?: string; theme?: string; footerClass?: string; centerTitle?: boolean;
  scrollRef?: RefObject<HTMLElement>; onScroll?: () => void; onBack?: () => void;
}) {
  const goBack = useBack(fallback);
  const loc = useLocation();
  const mode = useMode();
  const demoArea = mode === 'demo' && /^\/(writer|enquiries|profile\/(introduction|writer|demo|privacy))|\/enquire/.test(loc.pathname);
  const inner = useRef<HTMLElement>(null);
  const ref = scrollRef ?? inner;
  useLayoutEffect(() => {
    const y = scrollMemory.get(loc.key);
    if (y && ref.current) ref.current.scrollTop = y;
  }, [loc.key, ref]);
  return (
    <div className={`page ${className}`} data-theme={theme}>
      {header ?? (
        <header className="page-header">
          {!noBack && <IconButton icon={ArrowLeft} label="Back" onClick={onBack ?? goBack} />}
          {title && <h1 className={centerTitle ? 'center' : ''}>{title}</h1>}
          {!title && <div style={{ flex: 1 }} />}
          {demoArea && <span className="demo-pill" title="Sample data stored on this device only">Demo</span>}
          {right}
          {centerTitle && !right && <span style={{ width: 44, flex: 'none' }} aria-hidden="true" />}
        </header>
      )}
      <main
        className={`scroll ${flush ? 'flush' : ''}`}
        ref={ref}
        onScroll={(e) => {
          scrollMemory.set(loc.key, e.currentTarget.scrollTop);
          onScroll?.();
        }}
      >
        {children}
      </main>
      {footer && <div className={`footer-bar ${footerClass}`}>{footer}</div>}
      {nav && <BottomNav />}
    </div>
  );
}
