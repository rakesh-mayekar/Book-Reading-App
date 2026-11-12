import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bookmark, Compass, Inbox, LayoutGrid, User } from 'lucide-react';
import { IconButton, Ico } from './ui';
import { useDB } from '../store/store';
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

export function BottomNav() {
  const db = useDB();
  const role = roleOf(db.activeAccountId);
  const pending = db.enquiries.filter((e) => e.writerId === db.activeAccountId && e.status === 'pending').length;
  const items =
    role === 'writer'
      ? [{ to: '/writer/dashboard', label: 'Studio', icon: LayoutGrid }, { to: '/discover', label: 'Discover', icon: Compass }, { to: '/enquiries', label: 'Enquiries', icon: Inbox, badge: pending }, { to: '/profile', label: 'Profile', icon: User }]
      : role === 'filmmaker'
        ? [{ to: '/discover', label: 'Discover', icon: Compass }, { to: '/library', label: 'Saved', icon: Bookmark }, { to: '/enquiries', label: 'Enquiries', icon: Inbox }, { to: '/profile', label: 'Profile', icon: User }]
        : [{ to: '/discover', label: 'Discover', icon: Compass }, { to: '/library', label: 'Library', icon: BookOpen }, { to: '/profile', label: 'Profile', icon: User }];
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} replace>
          <Ico i={it.icon} />
          <span>{it.label}</span>
          {!!it.badge && <span className="nav-badge" aria-label={`${it.badge} pending`}>{it.badge}</span>}
        </NavLink>
      ))}
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

export function Page({ title, fallback = '/', right, children, footer, nav, flush, header, noBack, className = '', theme, scrollRef, onScroll, onBack }: {
  title?: string; fallback?: string; right?: ReactNode; children: ReactNode; footer?: ReactNode; nav?: boolean; flush?: boolean; header?: ReactNode; noBack?: boolean; className?: string; theme?: string;
  scrollRef?: RefObject<HTMLElement>; onScroll?: () => void; onBack?: () => void;
}) {
  const goBack = useBack(fallback);
  const loc = useLocation();
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
          {title && <h1>{title}</h1>}
          {!title && <div style={{ flex: 1 }} />}
          {right}
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
      {footer && <div className="footer-bar">{footer}</div>}
      {nav && <BottomNav />}
    </div>
  );
}
