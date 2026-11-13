import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ban, Lock } from 'lucide-react';
import { Page, toast } from '../components/Shell';
import { artwork, icons } from '../assets/figma';
import { Button, Chip, Cover, LinkButton, Notice, TextArea, TextField } from '../components/ui';
import { SAMPLE_FILMMAKER_INTRO } from '../domain/seed';
import { enquiryGate, publicStory, publishedStories, readingMinutes, validateEnquiryDraft, validateIntro, type PubStory } from '../domain/rules';
import { FORMATS } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, PermissionDenied, RoleOnly, useMe } from './common';

export const storyMeta = (s: PubStory) => `${s.genre} · ${readingMinutes(s.chapters)} min · ${s.status === 'completed' ? 'Completed' : 'Ongoing'}`;

export function StoryStrip({ story, writer, to }: { story: PubStory; writer: string; to?: string }) {
  const inner = (
    <>
      <Cover coverId={story.coverId} style={{ width: 54, height: 80, borderRadius: 6 }} />
      <div className="fm-strip-text"><h2>{story.title}</h2><p>by {writer}</p><p>{storyMeta(story)}</p></div>
    </>
  );
  return to ? <Link to={to} className="fm-strip">{inner}</Link> : <div className="fm-strip">{inner}</div>;
}

/* Filmmaker home: stories that are open to adaptation (Figma 'Filmmaker UI 01'). */
export function AdaptDiscover() {
  const { db } = useMe();
  const [q, setQ] = useState('');
  const [kb, setKb] = useState(false);
  const all = publishedStories(db).filter((s) => s.adaptationOpen);
  const needle = q.trim().toLowerCase();
  const shown = all.filter((s) => !needle || `${s.title} ${db.writers[s.writerId]?.name ?? ''} ${s.genre} ${s.synopsis}`.toLowerCase().includes(needle));
  return (
    <Page nav noBack title="Stories for the screen" className={`fm-home ${kb ? 'kb' : ''}`}>
      <div className="stack">
        <p className="fm-sub">Find a story you want to bring to life.</p>
        <div className="d-search" role="search">
          <img src={icons.search} alt="" width={24} height={24} />
          <input type="search" placeholder="Search stories or writers" id="disc-search" aria-label="Search stories or writers" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setKb(true)} onBlur={() => window.setTimeout(() => setKb(false), 300)} />
        </div>
        <div className="fm-banner"><img src={artwork.frame} alt="" /><span>From page<br />to possibility.</span></div>
        <h2 className="fm-h2">Open to adaptation</h2>
        {shown.length === 0 && <p className="fm-sub">{all.length ? 'No stories match your search.' : 'No stories are open to adaptation right now.'}</p>}
        {shown.map((s) => (
          <article key={s.id} className="fm-item">
            <StoryStrip story={s} writer={db.writers[s.writerId]?.name ?? 'Unknown writer'} to={`/story/${s.id}`} />
            <span className="pill">Open to enquiries</span>
            <p className="fm-sub" style={{ color: 'var(--ink)' }}>{s.synopsis}</p>
          </article>
        ))}
        <p className="fm-help">Availability is provided by writers. Discuss permission and terms directly before adapting a story.</p>
      </div>
    </Page>
  );
}

export function Introduction() {
  const { db, id, role } = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const p = db.filmmakers[id];
  const [f, setF] = useState({ name: p?.name ?? '', role: p?.role ?? '', team: p?.team ?? '', portfolio: p?.portfolio ?? '', intro: p?.intro ?? '' });
  const [tried, setTried] = useState(false);
  if (role !== 'filmmaker') return <PermissionDenied />;
  const errors = validateIntro(f);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Page title="Your introduction" centerTitle fallback="/profile"
      footer={<Button arrow onClick={() => { setTried(true); if (Object.keys(errors).length) return; actions.saveFilmmakerProfile({ accountId: id, ...f, name: f.name.trim(), role: f.role.trim(), team: f.team.trim(), portfolio: f.portfolio.trim(), intro: f.intro.trim(), complete: true }); toast('Introduction saved'); navigate(next ?? '/profile', { replace: true }); }}>{next ? 'Continue to enquiry' : 'Save introduction'}</Button>}>
      <div className="stack">
        <h1 className="fm-h1">Let the writer<br />meet you.</h1>
        <p className="fm-sub">Add the professional details your enquiry will include. They’re saved on this device and reused next time.</p>
        <TextField label="Display name *" value={f.name} onChange={set('name')} error={tried ? errors.name : ''} autoComplete="off" />
        <TextField label="Your role *" value={f.role} onChange={set('role')} error={tried ? errors.role : ''} placeholder="e.g. Director, Producer" />
        <TextField label="Studio / team · Optional" value={f.team} onChange={set('team')} placeholder="e.g. Independent" />
        <TextField label="Portfolio link · Optional" value={f.portfolio} onChange={set('portfolio')} error={tried ? errors.portfolio : ''} inputMode="url" placeholder="Add a link to your work" help="Not verified by Stories." />
        <TextArea label="Short introduction *" value={f.intro} onChange={set('intro')} error={tried ? errors.intro : ''} />
        <Button variant="secondary" onClick={() => setF({ ...SAMPLE_FILMMAKER_INTRO })}>Fill with sample introduction</Button>
        <p className="t-help">Sample data for testing. It is not a verified credential.</p>
      </div>
    </Page>
  );
}

function useEnquiryContext() {
  const { id: storyId = '' } = useParams();
  const me = useMe();
  const raw = me.db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  const gate = enquiryGate(me.db, me.id, storyId);
  const draft = me.db.drafts.find((d) => d.accountId === me.id && d.storyId === storyId);
  return { ...me, storyId, story, gate, draft: draft ?? { accountId: me.id, storyId, projectTitle: '', format: '', proposal: '' } };
}

function Gate({ ctx, children }: { ctx: ReturnType<typeof useEnquiryContext>; children: React.ReactNode }) {
  const { gate, story, storyId, db, id } = ctx;
  if (ctx.role !== 'filmmaker') return <PermissionDenied />;
  if (!story) return <NotFoundState what="story" to="/discover" />;
  if (!gate.ok) {
    if (gate.reason === 'duplicate') return <Navigate replace to={`/enquiries/${gate.existingId}`} />;
    const blocked = gate.reason === 'blocked';
    return (
      <Page title="Adaptation enquiry" centerTitle fallback={`/story/${storyId}`}>
        <div className="stack">
          <h1 className="fm-h1">{blocked ? 'Contact is unavailable.' : 'Not open right now.'}</h1>
          <StoryStrip story={story} writer={db.writers[story.writerId]?.name ?? ''} />
          <Notice icon={blocked ? Lock : Ban} tone="err">{blocked ? 'Contact with this writer is unavailable in this prototype. You can unblock them in Profile → Privacy.' : 'The writer is not open to adaptation enquiries for this story right now. You can still read it for free.'}</Notice>
          <LinkButton to={`/story/${storyId}`}>Back to story</LinkButton>
        </div>
      </Page>
    );
  }
  if (!db.filmmakers[id]?.complete) return <Navigate replace to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire`)}`} />;
  return <>{children}</>;
}

export function EnquiryForm() {
  const ctx = useEnquiryContext();
  const navigate = useNavigate();
  const { story, draft, id, storyId, db } = ctx;
  const [tried, setTried] = useState(false);
  const errors = validateEnquiryDraft(draft);
  const valid = Object.keys(errors).length === 0;
  const set = (p: Partial<typeof draft>) => actions.saveDraft({ ...draft, ...p });
  return (
    <Gate ctx={ctx}>
      {story && (
        <Page title="New enquiry" centerTitle fallback={`/story/${storyId}`}
          footer={<><Button arrow disabled={!valid} onClick={() => navigate(`/story/${storyId}/enquire/review`)}>Review enquiry</Button>{!valid && <p className="t-help" style={{ textAlign: 'center' }}>Complete the required fields to continue.</p>}</>}>
          <div className="stack">
            <StoryStrip story={story} writer={db.writers[story.writerId]?.name ?? ''} />
            <TextField label="Project title *" value={draft.projectTitle} onChange={(v) => set({ projectTitle: v })} onBlur={() => setTried(true)} error={tried ? errors.projectTitle : ''} placeholder="e.g. The Unsent Page — Short Film" maxLength={100} />
            <fieldset className="field"><legend className="label">Intended format *</legend>
              <div className="chips" role="radiogroup" aria-label="Intended format">{FORMATS.map((f) => <Chip radio key={f} selected={draft.format === f} onClick={() => set({ format: f })}>{f}</Chip>)}</div>
              {tried && errors.format && <p className="t-error" role="alert">{errors.format}</p>}</fieldset>
            <TextArea label="Your proposal *" value={draft.proposal} onChange={(v) => set({ proposal: v })} onBlur={() => setTried(true)} error={tried ? errors.proposal : ''} help="Explain your approach and what you would like to discuss. Avoid including personal contact details." style={{ minHeight: 160 }} />
            <div className="fm-box"><h3>A request starts a discussion.</h3><p>The writer chooses whether to accept. No phone number or email is needed. Draft saved on this device as you type.</p></div>
            <Link className="fm-link" to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire`)}`}>Edit my introduction</Link>
            <span hidden>{id}</span>
          </div>
        </Page>
      )}
    </Gate>
  );
}

export function EnquiryReview() {
  const ctx = useEnquiryContext();
  const navigate = useNavigate();
  const { story, draft, id, storyId, db } = ctx;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const p = db.filmmakers[id];
  if (ctx.role === 'filmmaker' && story && Object.keys(validateEnquiryDraft(draft)).length) return <Navigate replace to={`/story/${storyId}/enquire`} />;
  const writer = story ? db.writers[story.writerId]?.name ?? '' : '';
  const submit = () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    window.setTimeout(() => {
      const r = actions.submitEnquiry(id, storyId);
      if (r.ok) {
        toast('Enquiry sent');
        navigate(`/enquiries/${r.id}`, { replace: true });
      } else if (r.error === 'duplicate' && r.existingId) {
        navigate(`/enquiries/${r.existingId}`, { replace: true });
      } else {
        setError(r.message);
        setBusy(false);
        locked.current = false;
      }
    }, 700);
  };
  return (
    <Gate ctx={ctx}>
      {story && p && (
        <Page title="Review enquiry" centerTitle fallback={`/story/${storyId}/enquire`}
          footer={<><Button arrow loading={busy} onClick={submit}>{busy ? 'Sending…' : 'Send enquiry'}</Button><Button variant="secondary" disabled={busy} onClick={() => navigate(`/story/${storyId}/enquire`)}>Edit enquiry</Button></>}>
          <div className="stack">
            <h1 className="fm-h1">A thoughtful first step.</h1>
            <p className="fm-sub">Check what {writer.split(' ')[0]} will receive.</p>
            {error && <Notice icon={Ban} tone="err">{error}</Notice>}
            <StoryStrip story={story} writer={writer} />
            <div className="fm-box">
              <h3>{p.name} · {p.role}{p.team ? ` · ${p.team}` : ''}</h3>
              <p>{p.intro}</p>
              {p.portfolio && <p>{p.portfolio}</p>}
              <Link className="fm-link" to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire/review`)}`}>Edit introduction</Link>
            </div>
            <p className="fm-label">Project</p>
            <p className="fm-val">{draft.projectTitle}<br />{draft.format}</p>
            <p className="fm-label">Proposal</p>
            <p className="fm-val" style={{ whiteSpace: 'pre-wrap' }}>{draft.proposal}</p>
            <p className="fm-help">{writer.split(' ')[0]} can accept or decline. Messaging opens only after acceptance. Acceptance does not grant adaptation rights.</p>
          </div>
        </Page>
      )}
    </Gate>
  );
}
void RoleOnly;
