import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Flag, Lock, PenLine, RotateCcw, ShieldOff, SlidersHorizontal, UserRound, Wrench, Check } from 'lucide-react';
import { ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Avatar, Button, EmptyState, Ico, Notice } from '../components/ui';
import { ACCOUNTS } from '../domain/seed';
import { accountName } from '../domain/rules';
import { actions, setMode, useMode } from '../store/store';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../auth/config';
import { LogOut, FlaskConical, LogIn } from 'lucide-react';
import { TextField } from '../components/ui';
import { PrefsPicker } from './Onboarding';
import { Link } from 'react-router-dom';
import { useMe } from './common';

function Row({ to, icon, title, sub }: { to: string; icon: typeof Lock; title: string; sub: string }) {
  return (
    <Link to={to} className="list-row">
      <Ico i={icon} /><span className="grow"><span className="t-h3" style={{ display: 'block' }}>{title}</span><span className="t-meta">{sub}</span></span><Ico i={ChevronRight} size={20} />
    </Link>
  );
}

export function Profile() {
  const { db, id, role, name } = useMe();
  const mode = useMode();
  const auth = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const photo = role === 'writer' && mode === 'demo' ? db.writers[id]?.photo : undefined;
  const account = mode === 'account' && isSupabaseConfigured;
  return (
    <Page nav noBack title="Profile" className="prof">
      <div className="stack">
        <div className="card row" style={{ gap: 14 }}>
          <Avatar name={name} photo={photo} />
          <div style={{ minWidth: 0 }}>
            <h2 className="fm-h2">{name}</h2>
            {account ? <p className="t-meta" style={{ overflowWrap: 'anywhere' }}>{db.realUser?.email}</p> : <p className="t-meta" style={{ textTransform: 'capitalize' }}>{role} · demo account</p>}
          </div>
        </div>
        {account && <Notice icon={Check} tone="ok">Signed in. Your bookmarks and reading progress sync to your account.</Notice>}
        {!account && <Notice icon={FlaskConical} tone="warn"><b>Demo mode.</b> Sample data stored only on this device. {isSupabaseConfigured ? 'It is not connected to a real account.' : 'Accounts aren’t configured in this build.'}</Notice>}
        <div className="stack-sm">
          {role === 'reader' && <Row to="/profile/preferences" icon={SlidersHorizontal} title="Reading preferences" sub={account ? 'Name, genres and languages' : 'Genres and languages'} />}
          {role === 'writer' && <Row to="/profile/writer" icon={PenLine} title="Writer profile" sub="Demo · name, bio and photo" />}
          {role === 'filmmaker' && <Row to="/profile/introduction" icon={UserRound} title="Professional introduction" sub="Demo · reused on every enquiry" />}
          {!account && <Row to="/profile/privacy" icon={Lock} title="Privacy & blocked contacts" sub="Demo · unblock people, see local reports" />}
          {!account && <Row to="/profile/demo" icon={Wrench} title="Demo controls" sub="Switch demo account · reset demo data" />}
          {account && (
            <button className="list-row" onClick={() => { setMode('demo'); navigate('/', { replace: true }); }}>
              <Ico i={FlaskConical} /><span className="grow"><span className="t-h3" style={{ display: 'block' }}>Writer & filmmaker demo</span><span className="t-meta">Demo only · enquiries aren’t connected to your account yet</span></span><Ico i={ChevronRight} size={20} />
            </button>
          )}
          {!account && isSupabaseConfigured && (
            <button className="list-row" onClick={() => { setMode('account'); navigate('/', { replace: true }); }}>
              <Ico i={LogIn} /><span className="grow"><span className="t-h3" style={{ display: 'block' }}>Log in or create an account</span><span className="t-meta">Leave demo mode</span></span><Ico i={ChevronRight} size={20} />
            </button>
          )}
        </div>
        {account && <Button variant="secondary" arrow onClick={() => setConfirm(true)}>Log out</Button>}
        <p className="t-help">{account ? 'Writer accounts, story ownership and adaptation enquiries are still demo-only.' : 'Prototype: moderation, message delivery and rights checks are simulated locally.'}</p>
      </div>
      <ConfirmModal open={confirm} title="Log out?" confirmLabel="Log out" onCancel={() => setConfirm(false)} body="Your bookmarks and reading progress stay safe in your account. This device will forget them until you log in again." onConfirm={() => { setConfirm(false); void auth.signOut().then(() => navigate('/auth', { replace: true })); }} />
    </Page>
  );
}

export function Preferences() {
  const { db, id, name } = useMe();
  const mode = useMode();
  const [display, setDisplay] = useState(name);
  const p = db.prefs[id];
  const [genres, setGenres] = useState(p.genres);
  const [languages, setLanguages] = useState(p.languages);
  const ok = genres.length > 0 && languages.length > 0 && (mode !== 'account' || display.trim().length >= 2);
  return (
    <Page title="Reading preferences" fallback="/profile" footer={<Button disabled={!ok} onClick={() => { actions.savePrefs(id, { genres, languages }); if (mode === 'account' && display.trim().length >= 2) actions.saveDisplayName(id, display.trim()); toast('Preferences saved'); }}>Save preferences</Button>}>
      {mode === 'account' && <div style={{ marginBottom: 20 }}><TextField label="Display name" value={display} onChange={setDisplay} maxLength={80} error={display.trim().length < 2 ? 'Enter your name.' : ''} /></div>}
      <PrefsPicker genres={genres} languages={languages} setGenres={setGenres} setLanguages={setLanguages} />
      {!ok && <p className="t-error" style={{ marginTop: 12 }}>Choose at least one genre and one language.</p>}
    </Page>
  );
}

export function Privacy() {
  const { db, id } = useMe();
  const mine = db.blocks.filter((b) => b.blockerId === id);
  const reports = db.reports.filter((r) => r.reporterId === id);
  return (
    <Page title="Privacy & blocked contacts" fallback="/profile" className="prof">
      <div className="stack">
        <section className="stack-sm" aria-labelledby="bl-h">
          <h2 className="t-h2" id="bl-h">Blocked contacts</h2>
          <p className="t-help">Blocking prevents new enquiries and messages between you and that person in this prototype. Existing history is kept.</p>
          {mine.length === 0 ? <EmptyState icon={ShieldOff} title="No blocked contacts" text="People you block will appear here so you can unblock them." /> : mine.map((b) => (
            <div key={b.id} className="card row between">
              <div><span className="t-h3">{accountName(db, b.blockedId)}</span><p className="t-meta">Blocked {new Date(b.createdAt).toLocaleDateString()}</p></div>
              <Button block={false} variant="secondary" onClick={() => { actions.unblock(id, b.id); toast(`${accountName(db, b.blockedId)} unblocked`); }}>Unblock</Button>
            </div>
          ))}
        </section>
        <section className="stack-sm" aria-labelledby="rp-h">
          <h2 className="t-h2" id="rp-h">Reports you saved</h2>
          <Notice icon={Flag}>Reports are saved on this device for the prototype. No moderation team receives them.</Notice>
          {reports.length === 0 ? <p className="t-meta">No reports yet.</p> : reports.map((r) => (
            <div key={r.id} className="card"><span className="t-h3">{r.reason}</span><p className="t-meta">About {accountName(db, r.targetId)} · {new Date(r.createdAt).toLocaleString()}</p>{r.details && <p className="t-body" style={{ marginTop: 6 }}>{r.details}</p>}</div>
          ))}
        </section>
      </div>
    </Page>
  );
}

export function Demo() {
  const { id } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const active = ACCOUNTS.find((a) => a.id === id);
  if (mode !== 'demo') return <Navigate to="/profile" replace />;
  return (
    <Page title="Demo controls" fallback="/profile" className="prof">
      <div className="stack">
        <Notice icon={Wrench}>Testing tools for this prototype. Account switching is not a product feature. Stories, enquiries and messages are shared across accounts.</Notice>
        <div className="kv"><span className="k">Active account</span><span className="t-h3" data-testid="active-account">{active?.name} · {active?.tagline}</span></div>
        <section className="stack-sm" aria-labelledby="sw-h">
          <h2 className="t-h2" id="sw-h">Switch demo account</h2>
          {ACCOUNTS.map((a) => (
            <button key={a.id} className="list-row" aria-current={a.id === id ? 'true' : undefined} onClick={() => { if (a.id !== id) { actions.switchAccount(a.id); toast(`Switched to ${a.name}`); } navigate('/', { replace: true }); }}>
              <Avatar name={a.name} size={40} /><span className="grow"><span className="t-h3" style={{ display: 'block' }}>{a.name}</span><span className="t-meta">{a.tagline}</span></span>
              {a.id === id && <span className="badge ok"><Ico i={Check} size={14} /> Active</span>}
            </button>
          ))}
        </section>
        <Button variant="danger" icon={RotateCcw} onClick={() => setConfirm(true)}>Reset all demo data</Button>
      </div>
      <ConfirmModal open={confirm} destructive title="Reset all demo data?" confirmLabel="Reset everything" onCancel={() => setConfirm(false)} onConfirm={() => { actions.reset(); setConfirm(false); toast('Demo data reset'); navigate('/', { replace: true }); }} body="This removes every story you created, enquiry, message, report, block and reading record on this device, and restores the original sample content." />
    </Page>
  );
}
void accountName;
