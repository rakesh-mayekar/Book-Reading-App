import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ban, Film, Info, Lock, PencilLine } from 'lucide-react';
import { Page, toast } from '../components/Shell';
import { Button, Chip, Cover, LinkButton, Notice, TextArea, TextField } from '../components/ui';
import { SAMPLE_FILMMAKER_INTRO } from '../domain/seed';
import { enquiryGate, publicStory, validateEnquiryDraft, validateIntro } from '../domain/rules';
import { FORMATS } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, PermissionDenied, RoleOnly, useMe } from './common';

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
    <Page title="Professional introduction" fallback="/profile"
      footer={<Button onClick={() => { setTried(true); if (Object.keys(errors).length) return; actions.saveFilmmakerProfile({ accountId: id, ...f, name: f.name.trim(), role: f.role.trim(), team: f.team.trim(), portfolio: f.portfolio.trim(), intro: f.intro.trim(), complete: true }); toast('Introduction saved'); navigate(next ?? '/profile', { replace: true }); }}>{next ? 'Save and continue' : 'Save introduction'}</Button>}>
      <div className="stack">
        <p className="t-meta">Writers see this with your enquiry. It’s saved on this device and reused next time; you can edit it before you submit.</p>
        <TextField label="Display name" value={f.name} onChange={set('name')} error={tried ? errors.name : ''} autoComplete="off" />
        <TextField label="Professional role" value={f.role} onChange={set('role')} error={tried ? errors.role : ''} placeholder="e.g. Director, Producer" />
        <TextField label="Team or company" optional value={f.team} onChange={set('team')} placeholder="e.g. Independent" />
        <TextField label="Portfolio link" optional value={f.portfolio} onChange={set('portfolio')} error={tried ? errors.portfolio : ''} inputMode="url" placeholder="https://" help="Not verified by Stories." />
        <TextArea label="Short introduction" value={f.intro} onChange={set('intro')} error={tried ? errors.intro : ''} />
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
      <Page title="Adaptation enquiry" fallback={`/story/${storyId}`}>
        <div className="stack">
          <Notice icon={blocked ? Lock : Ban} tone="err">{blocked ? 'Contact with this writer is unavailable in this prototype. You can unblock them in Profile → Privacy.' : 'The writer is not open to adaptation enquiries for this story right now. You can still read it for free.'}</Notice>
          <LinkButton to={`/story/${storyId}`}>Back to story</LinkButton>
        </div>
      </Page>
    );
  }
  if (!db.filmmakers[id]?.complete) return <Navigate replace to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire`)}`} />;
  return <>{children}</>;
}

function StoryStrip({ coverId, title, writer }: { coverId: string; title: string; writer: string }) {
  return (
    <div className="card row" style={{ gap: 12 }}>
      <Cover coverId={coverId} style={{ width: 48, height: 66 }} />
      <div><p className="t-meta">Enquiring about</p><p className="t-h3">{title}</p><p className="t-meta">by {writer}</p></div>
    </div>
  );
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
        <Page title="New enquiry" fallback={`/story/${storyId}`}
          footer={<><Button disabled={!valid} onClick={() => navigate(`/story/${storyId}/enquire/review`)}>Review enquiry</Button>{!valid && <p className="t-help" style={{ textAlign: 'center' }}>Complete the required fields to continue.</p>}</>}>
          <div className="stack">
            <StoryStrip coverId={story.coverId} title={story.title} writer={db.writers[story.writerId]?.name ?? ''} />
            <Notice icon={Info}>Submitting starts a discussion request. The writer chooses whether to accept. No phone number or email is needed.</Notice>
            <TextField label="Project title" value={draft.projectTitle} onChange={(v) => set({ projectTitle: v })} onBlur={() => setTried(true)} error={tried ? errors.projectTitle : ''} placeholder="e.g. The Unsent Page — Short Film" maxLength={100} />
            <fieldset className="field"><legend className="label">Intended format</legend>
              <div className="chips" role="radiogroup" aria-label="Intended format">{FORMATS.map((f) => <Chip radio key={f} selected={draft.format === f} onClick={() => set({ format: f })}>{f}</Chip>)}</div>
              {tried && errors.format && <p className="t-error" role="alert">{errors.format}</p>}</fieldset>
            <TextArea label="Proposal" value={draft.proposal} onChange={(v) => set({ proposal: v })} onBlur={() => setTried(true)} error={tried ? errors.proposal : ''} help="What you’d like to make and how you’d involve the writer." style={{ minHeight: 160 }} />
            <p className="t-help">Draft saved on this device as you type.</p>
            <Link className="btn-link" to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire`)}`}><PencilLine size={18} aria-hidden="true" /> Edit my introduction</Link>
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
        <Page title="Review enquiry" fallback={`/story/${storyId}/enquire`}
          footer={<><Button loading={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit enquiry'}</Button><Button variant="secondary" disabled={busy} onClick={() => navigate(`/story/${storyId}/enquire`)}>Edit enquiry</Button></>}>
          <div className="stack">
            {error && <Notice icon={Ban} tone="err">{error}</Notice>}
            <StoryStrip coverId={story.coverId} title={story.title} writer={db.writers[story.writerId]?.name ?? ''} />
            <section className="card stack-sm"><div className="row between"><h2 className="t-h3">From</h2><Link className="btn-link t-meta" to={`/profile/introduction?next=${encodeURIComponent(`/story/${storyId}/enquire/review`)}`}>Edit</Link></div>
              <p className="t-h3">{p.name}</p><p className="t-meta">{p.role}{p.team ? ` · ${p.team}` : ''}</p>{p.portfolio && <p className="t-meta">{p.portfolio}</p>}<p className="t-body">{p.intro}</p></section>
            <section className="card stack-sm"><div className="kv"><span className="k">Project title</span><span className="t-h3">{draft.projectTitle}</span></div><div className="kv"><span className="k">Intended format</span><span>{draft.format}</span></div><div className="kv"><span className="k">Proposal</span><p className="t-body" style={{ whiteSpace: 'pre-wrap' }}>{draft.proposal}</p></div></section>
            <Notice icon={Film}>Submitting starts a discussion request. Acceptance opens a conversation only; adaptation rights are not granted.</Notice>
          </div>
        </Page>
      )}
    </Gate>
  );
}
void RoleOnly;
