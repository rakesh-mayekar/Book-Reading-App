import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, label, center, children }: { open: boolean; onClose: () => void; label: string; center?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return e.preventDefault();
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && (document.activeElement === z || !el.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      trigger?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  const host = document.getElementById('app-canvas') ?? document.body;
  return createPortal(
    <div className={`dialog-root ${center ? 'center' : ''}`}>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
        {!center && <div className="grab" aria-hidden="true" />}
        {children}
      </div>
    </div>,
    host,
  );
}

export function BottomSheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Dialog open={props.open} onClose={props.onClose} label={props.title}>
      <h2 className="t-h2">{props.title}</h2>
      {props.children}
    </Dialog>
  );
}

export function ConfirmModal({ open, title, body, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel, children }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onCancel} label={title} center>
      <h2 className="t-h2">{title}</h2>
      <div className="t-body muted">{body}</div>
      {children}
      <div className="stack-sm">
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={destructive ? 'dangerSolid' : 'primary'} loading={busy} onClick={() => { setBusy(true); try { onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
