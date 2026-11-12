import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Flag, Inbox, Lock, MessageCircle, Send, ShieldOff, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BottomSheet, ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Button, Chip, Cover, EmptyState, Ico, IconButton, LinkButton, Notice, StatusBadge, STATUS_LABEL, TextArea, clock, timeAgo } from '../components/ui';
import { accountName, canMessage, isBlocked, otherParty } from '../domain/rules';
import { REPORT_REASONS, type AdaptationEnquiry, type EnquiryStatus } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, PermissionDenied, useMe } from './common';

const STATUSES: EnquiryStatus[] = ['pending', 'accepted', 'declined', 'withdrawn'];

export function EnquiryList() {
  const { db, id, role } = useMe();
  const key = `${id}:list`;
  const filter = db.enquiryFilter[key] ?? '';
  if (role === 'reader') return <PermissionDenied />;
  const mine = db.enquiries.filter((e) => (role === 'writer' ? e.writerId === id : e.filmmakerId === id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const shown = filter ? mine.filter((e) => e.status === filter) : mine;
  const count = (s: EnquiryStatus) => mine.filter((e) => e.status === s).length;
  return (
    <Page nav noBack title={role === 'writer' ? 'Received enquiries' : 'Sent enquiries'}>
      <div className="stack">
        {role === 'writer' && <p className="t-meta" data-testid="pending-count">{count('pending')} pending {count('pending') === 1 ? 'request' : 'requests'}</p>}
        <div className="chips" role="group" aria-label="Filter by status">
          <Chip selected={!filter} onClick={() => actions.setEnquiryFilter(key, '')}>All ({mine.length})</Chip>
          {STATUSES.map((s) => <Chip key={s} selected={filter === s} onClick={() => actions.setEnquiryFilter(key, filter === s ? '' : s)}>{STATUS_LABEL[s]} ({count(s)})</Chip>)}
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Inbox} title={mine.length ? `No ${filter} enquiries` : role === 'writer' ? 'No enquiries yet' : 'You haven’t sent any enquiries'}
            text={mine.length ? 'Try another status filter.' : role === 'writer' ? 'Requests from filmmakers about your stories will appear here.' : 'Find a story open to adaptation and start a discussion.'}
            action={mine.length ? <Button variant="secondary" onClick={() => actions.setEnquiryFilter(key, '')}>Show all</Button> : role === 'filmmaker' ? <LinkButton to="/discover">Find stories</LinkButton> : undefined} />
        ) : (
          <div className="stack-sm">{shown.map((e) => <EnquiryItem key={e.id} e={e} />)}</div>
        )}
      </div>
    </Page>
  );
}

function EnquiryItem({ e }: { e: AdaptationEnquiry }) {
  const { db, id, role } = useMe();
  const story = db.stories.find((s) => s.id === e.storyId);
  const who = role === 'writer' ? e.intro.name : db.writers[e.writerId]?.name;
  return (
    <Link to={`/enquiries/${e.id}`} className="list-row enquiry-item">
      <div className="row between"><StatusBadge status={e.status} /><span className="t-meta">{timeAgo(e.updatedAt)}</span></div>
      <h3>{e.projectTitle}</h3>
      <p className="t-meta">{role === 'writer' ? 'From' : 'To'} {who} · {story?.published?.title ?? story?.title ?? 'Story'}</p>
      <span className="row between"><span className="t-meta">{e.format}</span><Ico i={ChevronRight} size={18} /></span>
      {void id}
    </Link>
  );
}

type Modal = '' | 'decline' | 'withdraw' | 'block' | 'report';

export function EnquiryDetail() {
  const { id: eid = '' } = useParams();
  const { db, id, role } = useMe();
  const navigate = useNavigate();
  const [modal, setModal] = useState<Modal>('');
  const [reason, setReason] = useState('');
  const [rReason, setRReason] = useState('');
  const [rDetails, setRDetails] = useState('');
  const [reported, setReported] = useState(false);
  const e = db.enquiries.find((x) => x.id === eid);
  if (!e) return <NotFoundState what="enquiry" to="/enquiries" />;
  const isWriter = e.writerId === id;
  const isSender = e.filmmakerId === id;
  if (!isWriter && !isSender) return <PermissionDenied />;
  const story = db.stories.find((s) => s.id === e.storyId);
  const other = otherParty(e, id);
  const otherName = isWriter ? e.intro.name : accountName(db, e.writerId);
  const blocked = isBlocked(db, e.writerId, e.filmmakerId);
  const iBlocked = db.blocks.some((b) => b.blockerId === id && b.blockedId === other);
  const close = () => setModal('');
  const fail = (m: string) => toast(m);
  return (
    <Page title="Enquiry" fallback="/enquiries">
      <div className="stack">
        <div className="row between"><StatusBadge status={e.status} /><span className="t-meta">Updated {clock(e.updatedAt)}</span></div>
        <h1 className="t-title" style={{ fontSize: 24 }}>{e.projectTitle}</h1>
        {blocked && <Notice icon={Lock} tone="err"><b>Contact unavailable.</b> {iBlocked ? 'You blocked this person' : 'This person blocked you'}. Messaging and new enquiries are disabled in this prototype. History is kept.</Notice>}
        {e.status === 'pending' && isSender && <Notice icon={Info} tone="warn">Waiting for {otherName} to respond. Chat opens only if they accept.</Notice>}
        {e.status === 'pending' && isWriter && <Notice icon={Info} tone="warn">This request is waiting for your decision. Accepting only opens a discussion.</Notice>}
        {e.status === 'accepted' && <Notice icon={MessageCircle} tone="ok">Accepted. Acceptance opens a discussion. Adaptation rights have not been granted.</Notice>}
        {e.status === 'declined' && <Notice icon={Info} tone="err">Declined{e.declineReason && isSender ? ` — “${e.declineReason}”` : ''}. This request is kept as history and cannot be reopened in this prototype. {isSender ? 'You can start a new enquiry if the story is open.' : ''}</Notice>}
        {e.status === 'withdrawn' && <Notice icon={Info}>Withdrawn by the sender. Kept as history; it cannot be reopened in this prototype.</Notice>}

        <Link to={`/story/${e.storyId}`} className="card row" style={{ gap: 12, textDecoration: 'none' }}>
          <Cover coverId={story?.published?.coverId ?? story?.coverId ?? 'ink'} style={{ width: 48, height: 66 }} />
          <div style={{ flex: 1, minWidth: 0 }}><p className="t-meta">Story</p><p className="t-h3">{story?.published?.title ?? story?.title}</p></div><Ico i={ChevronRight} size={18} />
        </Link>
        <section className="card stack-sm" aria-label={isWriter ? 'Sender' : 'Writer'}>
          <p className="t-meta">{isWriter ? 'From' : 'To'}</p>
          {isWriter ? (
            <><p className="t-h3">{e.intro.name}</p><p className="t-meta">{e.intro.role}{e.intro.team ? ` · ${e.intro.team}` : ''}</p><p className="t-body">{e.intro.intro}</p>
              {e.intro.portfolio && <p className="t-meta">Portfolio (not verified): <a href={e.intro.portfolio} target="_blank" rel="noreferrer noopener">{e.intro.portfolio}</a></p>}</>
          ) : <Link to={`/author/${e.writerId}`} className="t-h3">{otherName}</Link>}
        </section>
        <section className="card stack-sm"><div className="kv"><span className="k">Intended format</span><span>{e.format}</span></div><div className="kv"><span className="k">Proposal</span><p className="t-body" style={{ whiteSpace: 'pre-wrap' }}>{e.proposal}</p></div><div className="kv"><span className="k">Sent</span><span>{clock(e.createdAt)}</span></div></section>

        {e.status === 'accepted' && <LinkButton icon={MessageCircle} to={`/enquiries/${e.id}/chat`}>{blocked ? 'View conversation history' : 'Open conversation'}</LinkButton>}
        {e.status === 'pending' && isWriter && (
          <div className="stack-sm">
            <Button disabled={blocked} onClick={() => { const r = actions.transition(id, e.id, 'accept'); if (r.ok) { toast('Request accepted'); navigate(`/enquiries/${e.id}/chat`, { replace: true }); } else fail(r.message); }}>Accept request</Button>
            <Button variant="danger" onClick={() => setModal('decline')}>Decline request</Button>
          </div>
        )}
        {e.status === 'pending' && isSender && <Button variant="danger" onClick={() => setModal('withdraw')}>Withdraw enquiry</Button>}

        <section className="stack-sm" aria-labelledby="safety-h"><h2 className="t-h3" id="safety-h">Safety</h2>
          <p className="t-help">Reporting and blocking are separate. Reporting alone does not block or change the enquiry.</p>
          <div className="footer-row"><Button variant="secondary" icon={Flag} onClick={() => { setReported(false); setRReason(''); setRDetails(''); setModal('report'); }}>Report</Button><Button variant="secondary" icon={ShieldOff} disabled={iBlocked} onClick={() => setModal('block')}>{iBlocked ? 'Blocked' : 'Block'}</Button></div>
        </section>
      </div>

      <ConfirmModal open={modal === 'decline'} destructive title="Decline this request?" confirmLabel="Decline request" cancelLabel="Keep pending" onCancel={close}
        body={`${e.intro.name} will see that the request was declined. You can add a short reason if you’d like.`}
        onConfirm={() => { const r = actions.transition(id, e.id, 'decline', reason); close(); setReason(''); if (r.ok) toast('Request declined'); else fail(r.message); }}>
        <TextArea label="Reason" optional value={reason} onChange={setReason} maxLength={240} style={{ minHeight: 80 }} />
      </ConfirmModal>
      <ConfirmModal open={modal === 'withdraw'} destructive title="Withdraw this enquiry?" confirmLabel="Withdraw enquiry" cancelLabel="Keep pending" onCancel={close}
        body="The writer will see it as withdrawn. This can’t be reopened in this prototype, but you can send a new enquiry if the story is still open."
        onConfirm={() => { const r = actions.transition(id, e.id, 'withdraw'); close(); if (r.ok) toast('Enquiry withdrawn'); else fail(r.message); }} />
      <ConfirmModal open={modal === 'block'} destructive title={`Block ${otherName}?`} confirmLabel="Block" onCancel={close}
        body="This prevents further contact in this prototype: no new enquiries and no new messages between you, for both accounts. Existing history stays visible, and the enquiry status won’t change. You can unblock in Profile → Privacy."
        onConfirm={() => { const r = actions.block(id, other); close(); if (r.ok) toast(`${otherName} blocked`); }} />
      <BottomSheet open={modal === 'report'} onClose={close} title={reported ? 'Report saved' : `Report ${otherName}`}>
        {reported ? (
          <>
            <Notice icon={Flag} tone="ok">Your report was saved in this prototype only, on this device. No moderation team has received it, and nothing else changed.</Notice>
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <fieldset className="field"><legend className="label">Reason</legend><div className="chips" role="radiogroup" aria-label="Reason">{REPORT_REASONS.map((r) => <Chip radio key={r} selected={rReason === r} onClick={() => setRReason(r)}>{r}</Chip>)}</div></fieldset>
            <TextArea label="Details" optional value={rDetails} onChange={setRDetails} maxLength={500} style={{ minHeight: 90 }} />
            <Button disabled={!rReason} onClick={() => { const r = actions.report(id, e.id, rReason, rDetails); if (r.ok) setReported(true); else fail(r.message); }}>Submit report</Button>
            <Button variant="secondary" onClick={close}>Cancel</Button>
          </>
        )}
      </BottomSheet>
      {void role}
    </Page>
  );
}

export function Conversation() {
  const { id: eid = '' } = useParams();
  const { db, id } = useMe();
  const e = db.enquiries.find((x) => x.id === eid);
  const endRef = useRef<HTMLDivElement>(null);
  const key = `${id}:${eid}`;
  const text = db.composer[key] ?? '';
  const msgs = db.messages.filter((m) => m.enquiryId === eid);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  if (!e) return <NotFoundState what="conversation" to="/enquiries" />;
  if (e.writerId !== id && e.filmmakerId !== id) return <PermissionDenied />;
  const can = canMessage(db, id, eid);
  const otherName = e.writerId === id ? e.intro.name : accountName(db, e.writerId);
  const send = () => {
    const r = actions.sendMessage(id, eid, text);
    if (!r.ok) toast(r.message);
  };
  if (e.status !== 'accepted')
    return (
      <Page title="Conversation" fallback={`/enquiries/${eid}`}>
        <EmptyState icon={MessageCircle} title="Conversation not available" text={e.status === 'pending' ? 'Chat opens only after the writer accepts this enquiry.' : `This enquiry was ${e.status}, so there is no conversation. The request remains as history.`} action={<LinkButton to={`/enquiries/${eid}`}>View enquiry</LinkButton>} />
      </Page>
    );
  return (
    <Page title={otherName} fallback={`/enquiries/${eid}`}
      footer={can.ok ? (
        <form className="composer" onSubmit={(ev) => { ev.preventDefault(); if (text.trim()) send(); }}>
          <div style={{ flex: 1 }}><label className="sr-only" htmlFor="msg">Message</label>
            <textarea id="msg" className="input" rows={1} placeholder="Write a message" value={text} onChange={(ev) => actions.setComposer(key, ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); if (text.trim()) send(); } }} /></div>
          <IconButton className="send-btn" type="submit" icon={Send} label="Send message" disabled={!text.trim()} />
        </form>
      ) : (
        <Notice icon={Lock} tone="err">{can.message} Messaging is disabled for both accounts.</Notice>
      )}>
      <div className="stack">
        <Link to={`/enquiries/${eid}`} className="card row" style={{ textDecoration: 'none', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}><p className="t-meta">{db.stories.find((s) => s.id === e.storyId)?.published?.title}</p><p className="t-h3">{e.projectTitle} · {e.format}</p></div><Ico i={ChevronRight} size={18} />
        </Link>
        <Notice icon={Info}>Acceptance opens a discussion. Adaptation rights have not been granted.</Notice>
        {msgs.length === 0 && <p className="t-meta" style={{ textAlign: 'center' }}>No messages yet. Say hello to get started.</p>}
        <div className="chat" role="log" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === id ? 'mine' : ''}`}>
              <span className="who">{m.senderId === id ? 'You' : accountName(db, m.senderId)} · {clock(m.createdAt)}</span>
              <p>{m.text}</p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </Page>
  );
}
