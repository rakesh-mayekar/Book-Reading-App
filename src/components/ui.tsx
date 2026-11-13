import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { EnquiryStatus } from '../domain/types';
import { painted, ui as figmaUi } from '../assets/figma';

export const Ico = ({ i: Icon, size = 22 }: { i: LucideIcon; size?: number }) => <Icon size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;

/* ---------- Cover art (bundled, no network) ---------- */
const PALETTE: Record<string, [string, string]> = {
  dusk: ['#e9a36a', '#3f3260'],
  ink: ['#3b4a43', '#10150f'],
  tide: ['#3a8793', '#0f2a36'],
  ember: ['#e0713f', '#40170f'],
  moss: ['#86a664', '#1b2f20'],
  night: ['#2b3560', '#05060d'],
};
export function Cover({ coverId, style, className = '' }: { coverId: string; style?: CSSProperties; className?: string }) {
  const gid = useId().replace(/:/g, '');
  if (painted[coverId]) {
    return (
      <div className={`cover ${className}`} style={style} role="img" aria-label="Story cover artwork">
        <img src={painted[coverId]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
    );
  }
  const [a, b] = PALETTE[coverId] ?? PALETTE.ink;
  let art: ReactNode = null;
  switch (coverId) {
    case 'dusk':
      art = (<><circle cx="60" cy="68" r="24" fill="#f9dcaa" opacity=".92" /><path d="M0 118 Q30 92 62 112 T120 100 V160 H0Z" fill="#2a2145" opacity=".9" /><path d="M0 134 Q40 112 80 134 T120 126 V160 H0Z" fill="#161029" /></>);
      break;
    case 'ink':
      art = (<g stroke="#fff" opacity=".22" strokeWidth="1.5">{Array.from({ length: 14 }, (_, k) => <line key={k} x1={-20 + k * 14} y1="0" x2={40 + k * 14} y2="160" />)}</g>);
      break;
    case 'tide':
      art = (<g fill="none" stroke="#bfe6e8" strokeWidth="2" opacity=".5">{[60, 80, 100, 120].map((y) => <path key={y} d={`M0 ${y} Q15 ${y - 10} 30 ${y} T60 ${y} T90 ${y} T120 ${y}`} />)}</g>);
      break;
    case 'ember':
      art = (<><circle cx="60" cy="90" r="38" fill="#ffb27a" opacity=".35" /><circle cx="60" cy="90" r="22" fill="#ffd2a3" opacity=".6" /><circle cx="60" cy="90" r="9" fill="#fff0d8" /></>);
      break;
    case 'moss':
      art = (<><rect x="57" y="96" width="6" height="40" fill="#14221a" /><circle cx="60" cy="78" r="28" fill="#c6dca0" opacity=".55" /><circle cx="48" cy="88" r="18" fill="#a9c680" opacity=".6" /><circle cx="74" cy="86" r="16" fill="#d7e7b6" opacity=".6" /></>);
      break;
    default:
      art = (<><circle cx="78" cy="52" r="16" fill="#f1eedc" opacity=".92" /><circle cx="84" cy="48" r="14" fill="#2b3560" /><g fill="#fff" opacity=".8">{[[20, 30], [38, 62], [96, 100], [30, 110], [64, 24], [100, 20]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="1.4" />)}</g><path d="M0 140 H120 V160 H0Z" fill="#05060d" /></>);
  }
  return (
    <div className={`cover ${className}`} style={style} role="img" aria-label="Story cover artwork">
      <svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
        <rect width="120" height="160" fill={`url(#${gid})`} />
        {art}
      </svg>
    </div>
  );
}

/* ---------- Buttons ---------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerSolid';
  block?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  arrow?: boolean;
}
const VARIANT = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', dangerSolid: 'btn-danger-solid' } as const;
export function Button({ variant = 'primary', block = true, loading, icon, arrow, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={`btn ${VARIANT[variant]} ${block ? 'block' : ''} ${loading ? 'loading' : ''} ${className}`}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Ico i={icon} size={20} /> : null}
      {children}
      {arrow && !loading && <img src={variant === 'primary' || variant === 'dangerSolid' ? figmaUi.arrowLight : figmaUi.arrowDark} width={18} height={18} alt="" />}
    </button>
  );
}
export function LinkButton({ to, variant = 'primary', icon, children, state, replace, block = true, arrow }: { block?: boolean; arrow?: boolean; to: string; variant?: 'primary' | 'secondary'; icon?: LucideIcon; children: ReactNode; state?: unknown; replace?: boolean }) {
  return (
    <Link to={to} state={state} replace={replace} className={`btn ${VARIANT[variant]} ${block ? 'block' : ''}`}>
      {icon && <Ico i={icon} size={20} />}
      {children}
      {arrow && <img src={variant === 'primary' ? figmaUi.arrowLight : figmaUi.arrowDark} width={18} height={18} alt="" />}
    </Link>
  );
}
export function IconButton({ icon, label, tone, pressed, ...rest }: { icon: LucideIcon; label: string; tone?: 'dark' | 'ghost'; pressed?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} {...rest} className={`icon-btn ${tone ?? ''} ${rest.className ?? ''}`}>
      <Ico i={icon} />
    </button>
  );
}
export function IconLink({ icon, label, to, tone }: { icon: LucideIcon; label: string; to: string; tone?: 'dark' | 'ghost' }) {
  return (
    <Link to={to} aria-label={label} title={label} className={`icon-btn ${tone ?? ''}`}>
      <Ico i={icon} />
    </Link>
  );
}

/* ---------- Forms ---------- */
interface FieldCommon { label: string; error?: string; help?: string; optional?: boolean }
export function TextField({ label, error, help, optional, value, onChange, ...rest }: FieldCommon & { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} {optional && <span className="opt">(optional)</span>}</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-d`} {...rest} />
      <div id={`${id}-d`}>{error ? <p className="t-error" role="alert">{error}</p> : help ? <p className="t-help">{help}</p> : null}</div>
    </div>
  );
}
export function TextArea({ label, error, help, optional, value, onChange, ...rest }: FieldCommon & { value: string; onChange: (v: string) => void } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} {optional && <span className="opt">(optional)</span>}</label>
      <textarea id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`${id}-d`} {...rest} />
      <div id={`${id}-d`}>{error ? <p className="t-error" role="alert">{error}</p> : help ? <p className="t-help">{help}</p> : null}</div>
    </div>
  );
}
export function Chip({ selected, onClick, children, radio }: { selected: boolean; onClick: () => void; children: ReactNode; radio?: boolean }) {
  return radio ? (
    <button type="button" role="radio" aria-checked={selected} className="chip" onClick={onClick}>{children}</button>
  ) : (
    <button type="button" aria-pressed={selected} className="chip" onClick={onClick}>{children}</button>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/* ---------- Display ---------- */
export const STATUS_LABEL: Record<EnquiryStatus, string> = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn' };
export const StatusBadge = ({ status }: { status: EnquiryStatus }) => <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
export const Badge = ({ tone, children }: { tone?: 'open' | 'ok' | 'pending'; children: ReactNode }) => <span className={`badge ${tone ?? ''}`}>{children}</span>;
export const MetaItem = ({ icon, children }: { icon?: LucideIcon; children: ReactNode }) => (
  <span className="meta-item">{icon && <Ico i={icon} size={15} />}{children}</span>
);
export function EmptyState({ icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ring"><Ico i={icon} size={28} /></div>
      <h2 className="t-h2">{title}</h2>
      {text && <p className="t-meta" style={{ maxWidth: 280 }}>{text}</p>}
      {action && <div style={{ width: '100%', maxWidth: 280 }}>{action}</div>}
    </div>
  );
}
export const Avatar = ({ name, photo, size = 56 }: { name: string; photo?: string; size?: number }) => (
  <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
    {photo ? <img src={photo} alt="" /> : (name.trim()[0] ?? '?').toUpperCase()}
  </div>
);
export const Progress = ({ value }: { value: number }) => (
  <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.round(value * 100)}%` }} /></div>
);
export const Notice = ({ icon, tone, children }: { icon: LucideIcon; tone?: 'warn' | 'err' | 'ok'; children: ReactNode }) => (
  <div className={`notice ${tone ?? ''}`} role={tone === 'err' ? 'alert' : undefined}><Ico i={icon} size={20} /><div>{children}</div></div>
);

export function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'Just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export const clock = (ts: number) => new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
