import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Check, RotateCcw, Wrench, FlaskConical, UserRound } from 'lucide-react';
import { ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Avatar, Button, Chip, Ico, Notice, TextField } from '../components/ui';
import { ACCOUNTS } from '../domain/seed';
import { accountName, roleApp, ROLE_STATE_LABEL } from '../domain/rules';
import { actions, setMode, useMode } from '../store/store';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../auth/config';
import { PrefsPicker } from './Onboarding';
import { Link } from 'react-router-dom';
import { useMe } from './common';

function Row({ to, onClick, title, sub }: { to?: string; onClick?: () => void; title: string; sub: string }) {
  const inner = (<><span className="sp-text"><span className="sp-title">{title}</span><span className="sp-sub">{sub}</span></span><ChevronRight size={20} aria-hidden="true" /></>);
  return to ? <Link to={to} className="sp-row">{inner}</Link> : <button type="button" className="sp-row" onClick={onClick}>{inner}</button>;
}
const roleSub = (st: ReturnType<typeof roleApp>['state']) => st === 'not_requested' || st === 'draft' ? 'Not requested · Set up your profile' : st === 'pending' ? 'Pending · Waiting for owner review' : st === 'approved' ? 'Approved · Role access granted' : st === 'changes_requested' ? 'Changes needed · Update your profile' : `${ROLE_STATE_LABEL[st]} · Read owner feedback`;

/** 07.01 Your space */
export function Profile() {
  const { db, id, name } = useMe();
  const mode = useMode();
  const photo = mode === 'demo' ? db.writers[id]?.photo : undefined;
  const account = mode === 'account' && isSupabaseConfigured;
  const w = roleApp(db, id, 'writer');
  const f = roleApp(db, id, 'filmmaker');
  return (
    <Page nav noBack title="Your space" centerTitle className="prof">
      <div className="stack">
        <div className="fm-box space-card">
          <Avatar name={name} photo={photo} size={48} />
          <h2 className="fm-h1" style={{ margin: '4px 0 0', fontSize: 26 }}>{name}</h2>
          <p className="fm-sub">{account ? db.realUser?.email : 'A little reading, every day.'}</p>
          <Link to="/profile/edit" className="btn btn-secondary block">Edit profile<span aria-hidden="true">→</span></Link>
        </div>
        {!account && <Notice icon={FlaskConical} tone="warn"><b>Demo mode.</b> Sample data stored only on this device. {isSupabaseConfigured ? 'It is not connected to a real account.' : 'Accounts aren’t configured in this build.'}</Notice>}
        <div className="stack-sm sp-list">
          <Row to="/library" title="Your library" sub="Saved stories and reading progress" />
          {account ? (
            <Row onClick={() => { setMode('demo'); window.location.assign('/profile'); }} title="Writer & Filmmaker profiles" sub="Demo only · approval isn’t connected to your account yet" />
          ) : (
            <>
              <Row to="/profile/writer" title="Writer profile" sub={roleSub(w.state)} />
              <Row to="/profile/filmmaker" title="Filmmaker profile" sub={roleSub(f.state)} />
            </>
          )}
          <Row to="/profile/settings" title="Settings" sub="Make Stories feel like yours" />
        </div>
        <p className="fm-help">{account ? 'Writer accounts, story ownership and adaptation enquiries are still demo-only.' : 'Prototype: moderation, approval, message delivery and rights checks are simulated locally.'}</p>
      </div>
    </Page>
  );
}

export function EditProfile() {
  const { db, id, name } = useMe();
  const mode = useMode();
  const navigate = useNavigate();
  const [display, setDisplay] = useState(name);
  const account = mode === 'account';
  const ok = display.trim().length >= 2;
  return (
    <Page title="Edit profile" centerTitle fallback="/profile" className="prof"
      footer={<Button arrow disabled={!account || !ok} onClick={() => { actions.saveDisplayName(id, display.trim()); toast('Profile saved'); navigate('/profile', { replace: true }); }}>Save changes</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Edit profile</h1>
        <p className="fm-sub">Your public introduction, at your pace.</p>
        <TextField label="Display name" value={display} onChange={setDisplay} maxLength={80} disabled={!account} error={account && !ok ? 'Enter your name.' : ''} />
        {!account && <p className="fm-help">Demo accounts use fixed sample names. Sign in to choose your own.</p>}
        <div className="fm-box"><h3>Public profile</h3><p>Your display name is public. Your email and phone aren’t shown.</p></div>
      </div>
      {void db}
    </Page>
  );
}

/** 07.03 Settings */
export function Settings() {
  const { db, id } = useMe();
  const mode = useMode();
  const auth = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const account = mode === 'account' && isSupabaseConfigured;
  return (
    <Page title="Settings" centerTitle fallback="/profile" className="prof">
      <div className="stack-sm sp-list">
        <Row to="/profile/reading" title="Reading preferences" sub="Text size, spacing and reading theme" />
        <Row to="/profile/preferences" title="Genres & languages" sub="Your discovery preferences" />
        <Row to="/profile/notifications" title="Notifications" sub="Choose the updates you receive" />
        {!account && <Row to="/profile/privacy" title="Privacy & blocked accounts" sub="Manage contact and visibility" />}
        {account ? <Row to="/profile/edit" title="Account" sub={db.realUser?.email ?? ''} /> : <Row to="/profile/demo" title="Demo controls" sub="Switch demo account · reset demo data" />}
        {!account && <Row to="/owner" title="Owner review (demo)" sub="Approve or decline role applications" />}
        {!account && isSupabaseConfigured && <Row onClick={() => { setMode('account'); navigate('/', { replace: true }); }} title="Log in or create an account" sub="Leave demo mode" />}
        {account && <Row onClick={() => setConfirm(true)} title="Sign out" sub="Leave this account on this device" />}
      </div>
      <ConfirmModal open={confirm} title="Sign out?" confirmLabel="Sign out" onCancel={() => setConfirm(false)} body="Your bookmarks and reading progress stay safe in your account. This device will forget them until you log in again." onConfirm={() => { setConfirm(false); void auth.signOut().then(() => navigate('/auth', { replace: true })); }} />
      {void id}
    </Page>
  );
}

const NOTIF_KEY = 'br-notifs';
const NOTIFS = [
  ['chapters', 'New chapters', 'Stories you follow'],
  ['enquiries', 'Enquiry updates', 'Accept, decline and project updates'],
  ['messages', 'New messages', 'Accepted conversations'],
  ['reminders', 'Reading reminders', 'A gentle nudge to continue'],
  ['reviews', 'Profile review updates', 'Owner decisions on Writer or Filmmaker profiles'],
] as const;
export function Notifications() {
  const read = () => { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? 'null') as Record<string, boolean> | null; } catch { return null; } };
  const [on, setOn] = useState<Record<string, boolean>>(() => read() ?? { chapters: true, enquiries: true, messages: true, reminders: false, reviews: true });
  return (
    <Page title="Notifications" centerTitle fallback="/profile/settings" className="prof"
      footer={<Button arrow onClick={() => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(on)); } catch { /* ignore */ } toast('Preferences saved'); }}>Save preferences</Button>}>
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Notifications</h1>
        <p className="fm-sub">Only the updates you choose.</p>
        <div className="sp-list">
          {NOTIFS.map(([k, t, sub]) => (
            <button key={k} type="button" role="switch" aria-checked={!!on[k]} className="sp-row" onClick={() => setOn((x) => ({ ...x, [k]: !x[k] }))}>
              <span className="sp-text"><span className="sp-title">{t}</span><span className="sp-sub">{on[k] ? 'On' : 'Off'} · {sub}</span></span>
              <span className="sp-check" aria-hidden="true">{on[k] ? <Check size={20} /> : null}</span>
            </button>
          ))}
        </div>
        <div className="fm-box"><h3>Your choice</h3><p>This prototype doesn’t send notifications yet. These preferences are saved on this device for when it does.</p></div>
      </div>
    </Page>
  );
}

export function ReadingPrefs() {
  const { db, id } = useMe();
  const p = db.prefs[id];
  const themes = [['sepia', 'Paper'], ['light', 'White'], ['dark', 'Dark']] as const;
  const sizes = ['Small', 'Medium', 'Large', 'Extra large'];
  return (
    <Page title="Reading preferences" centerTitle fallback="/profile/settings" className="prof">
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Reading preferences</h1>
        <p className="fm-sub">Text size, spacing and reading theme. You can also change these while reading.</p>
        <fieldset className="field"><legend className="label">Theme</legend><div className="chips" role="radiogroup" aria-label="Theme">{themes.map(([k, l]) => <Chip radio key={k} selected={p?.theme === k} onClick={() => actions.savePrefs(id, { theme: k })}>{l}</Chip>)}</div></fieldset>
        <fieldset className="field"><legend className="label">Text size</legend><div className="chips" role="radiogroup" aria-label="Text size">{sizes.map((l, i) => <Chip radio key={l} selected={p?.fontSize === i} onClick={() => actions.savePrefs(id, { fontSize: i })}>{l}</Chip>)}</div></fieldset>
      </div>
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

/** 07.05 Privacy & safety + 07.06 Blocked accounts */
export function Privacy() {
  const { db, id } = useMe();
  const reports = db.reports.filter((r) => r.reporterId === id);
  return (
    <Page title="Privacy & safety" centerTitle fallback="/profile/settings" className="prof">
      <div className="stack">
        <div className="sp-list"><Row to="/profile/blocked" title="Blocked accounts" sub="Manage accounts that can’t contact you" /></div>
        <div className="fm-box"><h3>Contact details</h3><p>Your personal email and phone aren’t shared automatically.</p></div>
        <div className="fm-box"><h3>Adaptation discussions</h3><p>Enquiry acceptance opens a conversation. It doesn’t grant adaptation rights.</p></div>
        <div className="sp-list"><Row to="/enquiries" title="Report a concern" sub="Use a request or conversation’s menu" /></div>
        <h2 className="fm-h2" id="rp-h">Reports you saved</h2>
        <p className="fm-help">Reports are saved on this device for the prototype. No moderation team receives them.</p>
        {reports.length === 0 ? <p className="fm-sub">No reports yet.</p> : reports.map((r) => (
          <div key={r.id} className="fm-box"><h3>{r.reason}</h3><p>About {accountName(db, r.targetId)} · {new Date(r.createdAt).toLocaleString()}</p>{r.details && <p>{r.details}</p>}</div>
        ))}
      </div>
    </Page>
  );
}

export function Blocked() {
  const { db, id } = useMe();
  const mine = db.blocks.filter((b) => b.blockerId === id);
  return (
    <Page title="Blocked accounts" centerTitle fallback="/profile/privacy" className="prof">
      <div className="stack">
        <h1 className="fm-h1" style={{ margin: 0 }}>Blocked accounts</h1>
        <p className="fm-sub">Blocked participants can’t send you new requests or messages. Existing history is kept.</p>
        {mine.length === 0 && <div className="fm-box"><h3>No blocked accounts</h3><p>People you block will appear here so you can unblock them.</p></div>}
        {mine.map((b) => (
          <div key={b.id} className="fm-box">
            <h3>{accountName(db, b.blockedId)}</h3>
            <p>Blocked {new Date(b.createdAt).toLocaleDateString()}</p>
            <Button variant="secondary" arrow onClick={() => { actions.unblock(id, b.id); toast(`${accountName(db, b.blockedId)} unblocked`); }}>Unblock</Button>
          </div>
        ))}
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
