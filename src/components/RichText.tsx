import type { ReactNode } from 'react';

/** Tiny, safe formatter for chapter text: **bold**, *italic*, "# Heading", "- list". No HTML is ever injected. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={k++}>{t.slice(2, -2)}</strong> : <em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) return <h3 key={i}>{inline(lines[0].replace(/^#{1,3}\s+/, ''))}</h3>;
        if (lines.every((l) => /^[-*]\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s+/, ''))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </>
  );
}
