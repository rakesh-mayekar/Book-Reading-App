import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, Clock, PenLine, Clapperboard } from 'lucide-react';
import { ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Button, Chip, Notice, TextArea, TextField } from '../components/ui';
import { isValidUrl, ROLE_STATE_LABEL, roleApp, validateDecision, validateIntro, type RoleDecision } from '../domain/rules';
import { LANGUAGES, type RoleKind } from '../domain/types';
import { ACCOUNTS } from '../domain/seed';
import { actions, useMode } from '../store/store';
import { accountName } from '../domain/rules';
import { NotFoundState, useMe } from './common';

const LABEL: Record<RoleKind, string> = { writer: 'Writer', filmmaker: 'Filmmaker' };

/* ---------- 04.01 How will you use Stories? ---------- */
export function RoleSetup() {
  const { db, id } = useMe();
  const navigate = useNavigate();
  const [pick, setPick] = useState<RoleKind[]>([]);
  const toggle = (k: RoleKind) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const go = () => {
    actions.savePrefs(id, { roleSetup: true });
    const order = (['writer', 'filmmaker'] as RoleKind[]).filter((k) => pick.includes(k));
    if (!order.length) return navigate('/discover', { replace: true });
    navigate(`/profile/${order[0]}`, { replace: true, state: { queue: order.slice(1) } });
  };
  const Opt = ({ k, icon: I, title, sub }: { k: RoleKind | 'reader'; icon: typeof BookOpen; title: string; sub: string }) => {
    const on = k === 'reader' || pick.includes(k);
    return (
      <button type="button" className={`role-card ${on ? 'on' : ''}`} aria-pressed={on} disabled={k === 'reader'} onClick={() => k !== 'reader' && toggle(k)}>
        <span className="role-title"><I size={20} aria-hidden="true" />{title}</span>
        <span className="role-sub">{sub}</span>
      </button>
    );
  };
  void db;
  return (
    <Page noBack title="How will you use Stories?" centerTitle className="auth"
      footer={<Button arrow onClick={go}>{pick.length ? 'Continue' : 'Continue as a Reader'}</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>One account.<br />Your kind of story.</h1>
        <p className="fm-sub">Everyone starts with full Reader access. Choose the profiles you’d like to set up.</p>
        <Opt k="reader" icon={BookOpen} title="Reader" sub="Continue reading · No approval needed" />
        <Opt k="writer" icon={PenLine} title="Writer" sub="Set up Writer profile · Owner review required" />
        <Opt k="filmmaker" icon={Clapperboard} title="Filmmaker" sub="Set up Filmmaker profile · Owner review required" />
        <p className="fm-help">Approval gives platform access only. It doesn’t verify identity or story ownership. In this prototype, review is simulated on this device.</p>
      </div>
    </Page>
  );
}

/* ---------- Application form + status pages ---------- */
function WriterForm({ onDone, existing }: { onDone: () => void; existing?: boolean }) {
  const { db, id } = useMe();
  const w = db.writers[id];
  const [name, setName] = useState(w?.name ?? '');
  const [bio, setBio] = useState(w?.bio ?? '');
  const [langs, setLangs] = useState<string[]>(w?.languages ?? []);
  const [link, setLink] = useState('');
  const [tried, setTried] = useState(false);
  const [msg, setMsg] = useState('');
  const errors = {
    name: name.trim().length < 2 ? 'Enter your writing name.' : '',
    bio: bio.trim().length < 20 ? 'Write at least 20 characters about your writing.' : bio.length > 400 ? 'Keep it under 400 characters.' : '',
    langs: langs.length ? '' : 'Choose at least one language.',
    link: link.trim() && !isValidUrl(link.trim()) ? 'Enter a valid link, for example https://example.com' : '',
  };
  const toggle = (l: string) => setLangs((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));
  const submit = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const r = actions.submitRoleApp(id, 'writer', { id, name: name.trim(), bio: bio.trim(), languages: langs, photo: w?.photo });
    if (!r.ok) return setMsg(r.message);
    toast('Application sent for review');
    onDone();
  };
  return (
    <Page title="Writer profile" centerTitle fallback="/profile" footer={<Button arrow onClick={submit}>{existing ? 'Resubmit for owner approval' : 'Submit for owner approval'}</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Meet your future readers.</h1>
        <p className="fm-sub">Set up your profile before entering Stories. It stays private while the app owner reviews it.</p>
        <p className="fm-label">Profile setup · Writer</p>
        <TextField label="Writing name *" value={name} onChange={setName} error={tried ? errors.name : ''} autoComplete="off" />
        <TextArea label="About your writing *" value={bio} onChange={setBio} error={tried ? errors.bio : ''} help={`${bio.length}/400 · shown on your public profile once approved`} />
        <fieldset className="field"><legend className="label">Writing languages *</legend><div className="chips">{LANGUAGES.map((l) => <Chip key={l} selected={langs.includes(l)} onClick={() => toggle(l)}>{l}</Chip>)}</div>{tried && errors.langs && <p className="t-error" role="alert">{errors.langs}</p>}</fieldset>
        <TextField label="Portfolio / sample link · Optional" value={link} onChange={setLink} error={tried ? errors.link : ''} inputMode="url" placeholder="Add a link to your work" help="Not verified by Stories." />
        {msg && <Notice icon={Check} tone="err">{msg}</Notice>}
        <div className="fm-box"><h3>While your profile is reviewed</h3><p>You can read, save stories and use your library. Writing, publishing and writer-only enquiry actions stay locked until approval.</p></div>
      </div>
    </Page>
  );
}

function FilmmakerForm({ onDone, existing }: { onDone: () => void; existing?: boolean }) {
  const { db, id } = useMe();
  const p = db.filmmakers[id];
  const [f, setF] = useState({ name: p?.name ?? '', role: p?.role ?? '', team: p?.team ?? '', portfolio: p?.portfolio ?? '', intro: p?.intro ?? '' });
  const [tried, setTried] = useState(false);
  const [msg, setMsg] = useState('');
  const errors = validateIntro(f);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const r = actions.submitRoleApp(id, 'filmmaker', { accountId: id, name: f.name.trim(), role: f.role.trim(), team: f.team.trim(), portfolio: f.portfolio.trim(), intro: f.intro.trim(), complete: true });
    if (!r.ok) return setMsg(r.message);
    toast('Application sent for review');
    onDone();
  };
  return (
    <Page title="Filmmaker profile" centerTitle fallback="/profile" footer={<Button arrow onClick={submit}>{existing ? 'Resubmit for owner approval' : 'Submit for owner approval'}</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Introduce your work.</h1>
        <p className="fm-sub">Set up your profile before entering Stories. It stays private while the app owner reviews it.</p>
        <p className="fm-label">Profile setup · Filmmaker</p>
        <TextField label="Professional name *" value={f.name} onChange={set('name')} error={tried ? errors.name : ''} autoComplete="off" />
        <TextField label="Professional role *" value={f.role} onChange={set('role')} error={tried ? errors.role : ''} placeholder="e.g. Director, Producer" />
        <TextArea label="Professional introduction *" value={f.intro} onChange={set('intro')} error={tried ? errors.intro : ''} />
        <TextField label="Studio / team · Optional" value={f.team} onChange={set('team')} placeholder="e.g. Independent" />
        <TextField label="Portfolio / sample link · Optional" value={f.portfolio} onChange={set('portfolio')} error={tried ? errors.portfolio : ''} inputMode="url" placeholder="Add a link to your work" help="Not verified by Stories." />
        {msg && <Notice icon={Check} tone="err">{msg}</Notice>}
        <div className="fm-box"><h3>While your profile is reviewed</h3><p>You can read, save stories and use your library. Sending adaptation enquiries stays locked until approval.</p></div>
      </div>
    </Page>
  );
}

/** /profile/writer and /profile/filmmaker: application, status or (when approved) the approved-access page. */
export function RoleApplication({ kind }: { kind: RoleKind }) {
  const { db, id, name } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const app = roleApp(db, id, kind);
  const label = LABEL[kind];
  const queue = ((useLocation().state as { queue?: RoleKind[] } | null)?.queue) ?? [];
  const next = () => {
    if (queue.length) navigate(`/profile/${queue[0]}`, { replace: true, state: { queue: queue.slice(1) } });
    else navigate(`/profile/${kind}`, { replace: true });
  };
  if (mode !== 'demo') return <Navigate to="/profile" replace />;
  const who = kind === 'writer' ? db.writers[id]?.name : db.filmmakers[id]?.name;
  const detail = kind === 'writer' ? `${who ?? name} · ${(db.writers[id]?.languages ?? []).join(', ') || '—'}` : `${who ?? name} · ${db.filmmakers[id]?.role ?? ''}`;

  if (app.state === 'not_requested' || app.state === 'draft') return kind === 'writer' ? <WriterForm onDone={next} /> : <FilmmakerForm onDone={next} />;
  if (editing && (app.state === 'changes_requested' || app.state === 'rejected')) return kind === 'writer' ? <WriterForm existing onDone={() => { setEditing(false); next(); }} /> : <FilmmakerForm existing onDone={() => { setEditing(false); next(); }} />;

  const Status = ({ icon: I, text }: { icon: typeof Clock; text: string }) => <div className="fm-box"><I size={22} aria-hidden="true" /><h2 className="fm-h2" style={{ fontSize: 20 }}>{text}</h2></div>;
  if (app.state === 'pending')
    return (
      <Page title={`${label} application pending`} centerTitle fallback="/profile" footer={<Button arrow onClick={() => navigate('/discover')}>Continue reading</Button>}>
        <div className="stack">
          <Status icon={Clock} text="Pending owner approval" />
          <h1 className="fm-h1" style={{ margin: 0 }}>Your profile is with us.</h1>
          <p className="fm-sub">Check back here for the app owner’s decision. There is no promised response time.</p>
          <div className="fm-box"><h3>You’re a Reader for now</h3><p>Reading, saving and your library work as usual. {kind === 'writer' ? 'Your writing desk and publishing tools aren’t available yet.' : 'Sending adaptation enquiries isn’t available yet.'}</p></div>
          <p className="fm-help">{detail}<br />Your profile stays private until approval.</p>
        </div>
      </Page>
    );
  if (app.state === 'changes_requested' || app.state === 'rejected') {
    const changes = app.state === 'changes_requested';
    return (
      <Page title={`${label} profile · ${ROLE_STATE_LABEL[app.state]}`} centerTitle fallback="/profile" footer={<Button variant={changes ? 'secondary' : 'primary'} arrow onClick={() => navigate('/discover')}>Continue reading</Button>}>
        <div className="stack">
          <h1 className="fm-h1" style={{ margin: 0 }}>{changes ? 'A little more detail, please.' : 'Your application wasn’t approved.'}</h1>
          <p className="fm-sub">{changes ? 'The app owner has requested an update.' : 'Your account can still use Stories as a Reader.'}</p>
          <div className="fm-box"><h3>Owner feedback</h3><p>{app.feedback}</p></div>
          {changes && <div className="fm-box"><h3>Reader access continues</h3><p>Your role is not approved yet. Your library and reading access remain available.</p></div>}
          <Button arrow onClick={() => setEditing(true)}>{changes ? 'Update profile' : 'Update and reapply'}</Button>
        </div>
      </Page>
    );
  }
  // approved
  return (
    <Page title={`${label} profile approved`} centerTitle fallback="/profile" footer={kind === 'writer' ? <Button arrow onClick={() => navigate('/writer/dashboard')}>Open writing desk</Button> : <Button arrow onClick={() => navigate('/discover')}>Find stories to adapt</Button>}>
      <div className="stack">
        <Status icon={Check} text={`${label} access approved`} />
        <h1 className="fm-h1" style={{ margin: 0 }}>Your next chapter is open.</h1>
        <p className="fm-sub">{kind === 'writer' ? 'Your profile is now visible, and you can create and publish stories.' : 'You can now send adaptation enquiries to writers who are open to them.'}</p>
        <div className="fm-box"><h3>What approval means</h3><p>The app owner approved access to this role. It does not verify story ownership or grant adaptation rights.</p></div>
        <Link className="fm-link" to={`/profile/${kind}/edit`}>Edit my {label.toLowerCase()} profile</Link>
      </div>
    </Page>
  );
}

/* ---------- 08.x Owner review (demo tool) ---------- */
function useOwnerGuard() {
  const mode = useMode();
  return mode === 'demo';
}
type Row = { accountId: string; kind: RoleKind; state: string };
export function OwnerQueue() {
  const { db } = useMe();
  const ok = useOwnerGuard();
  if (!ok) return <Navigate to="/profile" replace />;
  const rows: Row[] = [];
  const ids = new Set([...Object.keys(db.roleApps ?? {}), ...ACCOUNTS.map((a) => a.id)]);
  ids.forEach((aid) => (['writer', 'filmmaker'] as RoleKind[]).forEach((kind) => {
    const app = roleApp(db, aid, kind);
    if (db.roleApps?.[aid]?.[kind]) rows.push({ accountId: aid, kind, state: app.state });
  }));
  rows.sort((a, b) => (a.state === 'pending' ? -1 : 0) - (b.state === 'pending' ? -1 : 0));
  return (
    <Page title="Profile applications" centerTitle fallback="/profile/demo" className="auth">
      <div className="stack">
        <p className="fm-label">App owner · Role review</p>
        <h1 className="fm-h1" style={{ margin: 0 }}>Review new profiles</h1>
        <p className="fm-sub">Writer and Filmmaker access is granted separately.</p>
        {rows.length === 0 && <div className="fm-box"><h3>No applications yet</h3><p>Apply as a Writer or Filmmaker from Your space, then come back here to decide.</p></div>}
        {rows.map((r) => (
          <Link key={`${r.accountId}-${r.kind}`} to={`/owner/review/${r.accountId}/${r.kind}`} className="fm-card">
            <h3>{accountName(db, r.accountId)} · {LABEL[r.kind]}</h3>
            <p>{ROLE_STATE_LABEL[r.state as keyof typeof ROLE_STATE_LABEL]} · {LABEL[r.kind]} application</p>
          </Link>
        ))}
        <div className="fm-box"><h3>Review rule</h3><p>An account remains a Reader until you explicitly approve the requested role. This screen is a demo tool; in production only an authenticated app owner may reach it, and the server must enforce that.</p></div>
      </div>
    </Page>
  );
}

export function OwnerReview() {
  const { accountId = '', kind: k = '' } = useParams();
  const kind = k as RoleKind;
  const { db } = useMe();
  const ok = useOwnerGuard();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!ok) return <Navigate to="/profile" replace />;
  if (kind !== 'writer' && kind !== 'filmmaker') return <NotFoundState what="application" to="/owner" />;
  const app = roleApp(db, accountId, kind);
  if (!db.roleApps?.[accountId]?.[kind]) return <NotFoundState what="application" to="/owner" />;
  const name = accountName(db, accountId);
  const w = db.writers[accountId];
  const f = db.filmmakers[accountId];
  const pending = app.state === 'pending';
  return (
    <Page title={`Review ${LABEL[kind].toLowerCase()}`} centerTitle fallback="/owner" className="auth">
      <div className="stack">
        <p className="fm-label">App owner · Role review</p>
        <h1 className="fm-h1" style={{ margin: 0 }}>{name}</h1>
        <p className="fm-sub">{ROLE_STATE_LABEL[app.state]} · {LABEL[kind]} application</p>
        <div className="fm-box">
          <h3>Profile details</h3>
          {kind === 'writer' ? (
            <p>Writing name: {w?.name}<br />About: {w?.bio}<br />Writing languages: {(w?.languages ?? []).join(', ') || '—'}</p>
          ) : (
            <p>Name: {f?.name}<br />Role: {f?.role}<br />Introduction: {f?.intro}<br />Studio / team: {f?.team || 'Not provided'}<br />Portfolio: {f?.portfolio || 'Not provided'}</p>
          )}
        </div>
        <div className="fm-box"><h3>Before deciding</h3><p>Approve only this role. Account sign-in and any other role approvals are independent. Approval is platform access, not identity verification or proof of story ownership.</p></div>
        {pending ? (
          <>
            <Button arrow onClick={() => setConfirm(true)}>Approve {LABEL[kind].toLowerCase()}</Button>
            <Button variant="secondary" arrow onClick={() => navigate(`/owner/review/${accountId}/${kind}/feedback?d=request_changes`)}>Request profile changes</Button>
            <Button variant="secondary" arrow onClick={() => navigate(`/owner/review/${accountId}/${kind}/feedback?d=reject`)}>Do not approve</Button>
          </>
        ) : <Notice icon={Check}>This application was already decided: {ROLE_STATE_LABEL[app.state]}.{app.feedback ? ` Feedback sent: “${app.feedback}”` : ''}</Notice>}
      </div>
      <ConfirmModal open={confirm} title={`Approve ${LABEL[kind].toLowerCase()} access?`} confirmLabel={`Approve ${LABEL[kind].toLowerCase()}`} cancelLabel="Cancel" onCancel={() => setConfirm(false)}
        body={`${name} will be able to use ${LABEL[kind]} features. This grants platform access only; it does not verify identity or ownership.`}
        onConfirm={() => { const r = actions.decideRoleApp(accountId, kind, 'approve'); setConfirm(false); if (r.ok) navigate(`/owner/done/${accountId}/${kind}?d=approve`, { replace: true }); else toast(r.message); }} />
    </Page>
  );
}

export function OwnerFeedback() {
  const { accountId = '', kind: k = '' } = useParams();
  const kind = k as RoleKind;
  const [params] = useSearchParams();
  const decision = (params.get('d') === 'reject' ? 'reject' : 'request_changes') as RoleDecision;
  const navigate = useNavigate();
  const ok = useOwnerGuard();
  const { db } = useMe();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  if (!ok) return <Navigate to="/profile" replace />;
  if (!db.roleApps?.[accountId]?.[kind]) return <NotFoundState what="application" to="/owner" />;
  const err = validateDecision(decision, text);
  const changes = decision === 'request_changes';
  return (
    <Page title={changes ? 'Request changes' : 'Do not approve'} centerTitle fallback={`/owner/review/${accountId}/${kind}`} className="auth"
      footer={<Button arrow onClick={() => { setTried(true); if (err) return; const r = actions.decideRoleApp(accountId, kind, decision, text); if (r.ok) navigate(`/owner/done/${accountId}/${kind}?d=${decision}`, { replace: true }); else toast(r.message); }}>Send feedback</Button>}>
      <div className="stack">
        <p className="fm-label">App owner · Role review</p>
        <TextArea label="Feedback *" value={text} onChange={setText} error={tried ? err : ''} placeholder="Tell the applicant what to change" maxLength={400} style={{ minHeight: 120 }} />
        <div className="fm-box"><h3>Status after sending</h3><p>{changes ? 'Changes requested · Professional tools remain locked. The applicant keeps Reader access.' : 'Not approved · Professional tools remain locked. The applicant keeps Reader access and may reapply.'}</p></div>
      </div>
    </Page>
  );
}

export function OwnerDone() {
  const { accountId = '', kind: k = '' } = useParams();
  const [params] = useSearchParams();
  const { db } = useMe();
  const navigate = useNavigate();
  const d = params.get('d');
  const name = accountName(db, accountId);
  const text = d === 'approve' ? `${name} now has ${LABEL[k as RoleKind] ?? 'role'} access. Other roles are unchanged.` : d === 'reject' ? `${name} was not approved and can reapply.` : `${name} was asked for changes.`;
  return (
    <Page noBack title="Approval recorded" centerTitle fallback="/owner" className="auth" footer={<Button arrow onClick={() => navigate('/owner', { replace: true })}>Back to applications</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Decision recorded.</h1>
        <p className="fm-sub">{text}</p>
        <div className="fm-box"><h3>Demo only</h3><p>This decision is stored on this device. In production it must be enforced on the server for every protected action.</p></div>
      </div>
    </Page>
  );
}
