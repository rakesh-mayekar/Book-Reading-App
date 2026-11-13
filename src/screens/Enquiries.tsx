import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Inbox, Lock, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BottomSheet, ConfirmModal } from '../components/Dialog';
import { Page, toast } from '../components/Shell';
import { Button, Cover, EmptyState, Ico, IconButton, LinkButton, Notice, STATUS_LABEL, TextArea, clock, timeAgo } from '../components/ui';
import { accountName, canMessage, isBlocked, otherParty, publicStory } from '../domain/rules';
import { REPORT_REASONS, type AdaptationEnquiry, type EnquiryStatus } from '../domain/types';
import { actions } from '../store/store';
import { NotFoundState, PermissionDenied, useMe } from './common';
import { StoryStrip } from './Filmmaker';

const STATUSES: EnquiryStatus[] = ['pending', 'accepted', 'declined', 'withdrawn'];
const first = (n: string) => n.trim().split(/\s+/)[0] || n;
const StatusPill = ({ status }: { status: EnquiryStatus }) => <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;

function useStory(storyId: string) {
  const { db } = useMe();
  const raw = db.stories.find((x) => x.id === storyId);
  return raw && publicStory(raw);
}

export function EnquiryList() {
  const { db, id, role } = useMe();
  const key = `${id}:list`;
  const filter = db.enquiryFilter[key] ?? '';
  if (role === 'reader') return <PermissionDenied />;
  const mine = db.enquiries.filter((e) => (role === 'writer' ? e.writerId === id : e.filmmakerId === id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const shown = filter ? mine.filter((e) => e.status === filter) : mine;
  const count = (s: EnquiryStatus) => mine.filter((e) => e.status === s).length;
  return (
    <Page nav noBack title="Inbox" className="fm-inbox">
      <div className="stack">
        <div className="fm-tabs" role="group" aria-label="Filter by status">
          <button type="button" aria-pressed={!filter} onClick={() => actions.setEnquiryFilter(key, '')}>{role === 'writer' ? 'Received' : 'Sent'} ({mine.length})</button>
          {STATUSES.map((s) => <button type="button" key={s} aria-pressed={filter === s} onClick={() => actions.setEnquiryFilter(key, filter === s ? '' : s)}>{STATUS_LABEL[s]} ({count(s)})</button>)}
        </div>
        <h2 className="fm-h2">{role === 'writer' ? 'Requests for your stories' : 'Your enquiries'}</h2>
        {role === 'writer' && <p className="fm-sub" data-testid="pending-count">{count('pending')} pending {count('pending') === 1 ? 'request' : 'requests'}</p>}
        {shown.length === 0 ? (
          <EmptyState icon={Inbox} title={mine.length ? `No ${filter} enquiries` : role === 'writer' ? 'No enquiries yet' : 'You haven’t sent any enquiries'}
            text={mine.length ? 'Try another status filter.' : role === 'writer' ? 'Requests from filmmakers about your stories will appear here.' : 'Find a story open to adaptation and start a discussion.'}
            action={mine.length ? <Button variant="secondary" onClick={() => actions.setEnquiryFilter(key, '')}>Show all</Button> : role === 'filmmaker' ? <LinkButton to="/discover">Find stories</LinkButton> : undefined} />
        ) : (
          <div className="stack-sm">{shown.map((e) => <EnquiryItem key={e.id} e={e} />)}</div>
        )}
        <p className="fm-help">Accepted requests become conversations. Pending requests stay here until they are answered or withdrawn.</p>
      </div>
    </Page>
  );
}

function EnquiryItem({ e }: { e: AdaptationEnquiry }) {
  const { db, role } = useMe();
  const story = db.stories.find((s) => s.id === e.storyId);
  const who = role === 'writer' ? e.intro.name : db.writers[e.writerId]?.name;
  return (
    <Link to={`/enquiries/${e.id}`} className="fm-card">
      <h3>{e.projectTitle}</h3>
      <p>{role === 'writer' ? 'From' : 'To'} {who} · {e.format}</p>
      <p>{story?.published?.title ?? story?.title ?? 'Story'} · {timeAgo(e.updatedAt)}</p>
      <StatusPill status={e.status} />
    </Link>
  );
}

type Modal = '' | 'menu' | 'decline' | 'withdraw' | 'block' | 'report';

export function EnquiryDetail() {
  const { id: eid = '' } = useParams();
  const { db, id } = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [modal, setModal] = useState<Modal>(params.get('options') ? 'menu' : '');
  const [reason, setReason] = useState('');
  const [rReason, setRReason] = useState('');
  const [rDetails, setRDetails] = useState('');
  const [reported, setReported] = useState(false);
  const e = db.enquiries.find((x) => x.id === eid);
  const story = useStory(e?.storyId ?? '');
  if (!e) return <NotFoundState what="enquiry" to="/enquiries" />;
  const isWriter = e.writerId === id;
  const isSender = e.filmmakerId === id;
  if (!isWriter && !isSender) return <PermissionDenied />;
  const other = otherParty(e, id);
  const otherName = isWriter ? e.intro.name : accountName(db, e.writerId);
  const writerName = accountName(db, e.writerId);
  const blocked = isBlocked(db, e.writerId, e.filmmakerId);
  const iBlocked = db.blocks.some((b) => b.blockerId === id && b.blockedId === other);
  const close = () => setModal('');
  const fail = (m: string) => toast(m);

  if (modal === 'report') {
    return (
      <Page title="Report a concern" centerTitle fallback={`/enquiries/${eid}`} onBack={close}
        footer={reported ? <Button arrow onClick={close}>Done</Button> : <Button arrow disabled={!rReason} onClick={() => { const r = actions.report(id, e.id, rReason, rDetails); if (r.ok) setReported(true); else fail(r.message); }}>Submit report</Button>}>
        <div className="stack">
          {reported ? (
            <>
              <h1 className="fm-h1">Report saved.</h1>
              <Notice icon={MessageCircle} tone="ok">Your report was saved in this prototype only, on this device. No moderation team has received it, and nothing else changed.</Notice>
            </>
          ) : (
            <>
              <h1 className="fm-h1">Tell us what happened.</h1>
              <p className="fm-sub">Reporting {otherName}’s enquiry for {story?.title ?? 'this story'}.</p>
              <div role="radiogroup" aria-label="Reason" className="stack-sm">
                {REPORT_REASONS.map((r) => <button type="button" key={r} role="radio" aria-checked={rReason === r} className="fm-opt" onClick={() => setRReason(r)}><i aria-hidden="true" />{r}</button>)}
              </div>
              <TextArea label="Additional details · Optional" value={rDetails} onChange={setRDetails} maxLength={500} placeholder="Add context for the review team" style={{ minHeight: 120 }} />
              <p className="fm-help">Reporting does not automatically block the account. In this prototype the report is stored on this device only.</p>
            </>
          )}
        </div>
      </Page>
    );
  }

  const menu = <IconButton icon={MoreHorizontal} label="More options" onClick={() => setModal('menu')} />;
  const strip = story && <StoryStrip story={story} writer={writerName} to={`/story/${e.storyId}`} />;
  const pendingWriter = e.status === 'pending' && isWriter;
  const footer = pendingWriter ? (
    <div className="footer-row">
      <Button variant="secondary" arrow onClick={() => setModal('decline')}>Decline</Button>
      <Button arrow disabled={blocked} onClick={() => { const r = actions.transition(id, e.id, 'accept'); if (r.ok) { toast('Request accepted'); navigate(`/enquiries/${e.id}/chat`, { replace: true }); } else fail(r.message); }}>Accept request</Button>
    </div>
  ) : e.status === 'accepted' ? (
    <Button arrow onClick={() => navigate(`/enquiries/${e.id}/chat`)}>{blocked ? 'View conversation history' : 'Open conversation'}</Button>
  ) : (
    <Button arrow onClick={() => navigate('/enquiries')}>Back to Inbox</Button>
  );
  const headline = isWriter ? null : e.status === 'pending' ? `Your proposal is with ${first(writerName)}.` : e.status === 'accepted' ? `${first(writerName)} accepted.` : e.status === 'declined' ? 'Not this time.' : 'Enquiry withdrawn.';
  const subline = isWriter ? null : e.status === 'pending' ? 'You can check its status here.' : e.status === 'accepted' ? 'Acceptance opens a conversation.' : e.status === 'declined' ? 'Thank you for asking. Declined requests are kept as history.' : 'You withdrew this request. It is kept as history.';

  return (
    <Page title={isWriter ? 'Review request' : 'Enquiry details'} centerTitle fallback="/enquiries" right={menu} footer={footer}>
      <div className="stack">
        <StatusPill status={e.status} />
        {headline && <h1 className="fm-h1">{headline}</h1>}
        {subline && <p className="fm-sub">{subline}</p>}
        {strip}
        {blocked && <Notice icon={Lock} tone="err"><b>Contact unavailable.</b> {iBlocked ? 'You blocked this person' : 'This person blocked you'}. Messaging and new enquiries are disabled in this prototype. History is kept.</Notice>}
        {isWriter && (
          <div className="fm-box">
            <h3>{e.intro.name} · {e.intro.role}{e.intro.team ? ` · ${e.intro.team}` : ''}</h3>
            <p>{e.intro.intro}</p>
            {e.intro.portfolio && <p>Portfolio (not verified): <a href={e.intro.portfolio} target="_blank" rel="noreferrer noopener">{e.intro.portfolio}</a></p>}
          </div>
        )}
        {e.status === 'pending' && isSender && <div className="fm-box"><h3>Waiting for writer response</h3><p>Waiting for {writerName} to respond. Conversation opens if {first(writerName)} accepts. There is no promised response time.</p></div>}
        {e.status === 'accepted' && <div className="fm-box"><h3>Accepted</h3><p>Acceptance opens a discussion. Adaptation rights have not been granted.</p></div>}
        {e.status === 'declined' && <div className="fm-box"><h3>Declined{e.declineReason && isSender ? ` — “${e.declineReason}”` : ''}</h3><p>This request is kept as history and cannot be reopened in this prototype.{isSender ? ' You can start a new enquiry if the story is open.' : ''}</p></div>}
        {e.status === 'withdrawn' && <div className="fm-box"><h3>Withdrawn</h3><p>Withdrawn by the sender. Kept as history; it cannot be reopened in this prototype.</p></div>}
        {pendingWriter && <p className="fm-sub">This request is waiting for your decision.</p>}
        <p className="fm-label">{isWriter ? 'Project' : 'Your project'}</p>
        <h2 className="fm-h2" style={{ fontSize: 22 }}>{e.projectTitle}</h2>
        <p className="fm-sub">{e.format}</p>
        <p className="fm-val" style={{ whiteSpace: 'pre-wrap' }}>{e.proposal}</p>
        <p className="fm-help">Sent {clock(e.createdAt)}. {isWriter ? 'Accepting opens a conversation. It does not approve an adaptation or transfer any rights.' : ''}</p>
        {e.status === 'pending' && isSender && <button type="button" className="fm-link" onClick={() => setModal('withdraw')}>Withdraw enquiry</button>}
      </div>

      <BottomSheet open={modal === 'menu'} onClose={close} title="Conversation options">
        <Button variant="secondary" arrow onClick={() => { setReported(false); setRReason(''); setRDetails(''); setModal('report'); }}>Report a concern</Button>
        <Button variant="secondary" arrow disabled={iBlocked} onClick={() => setModal('block')}>{iBlocked ? 'Blocked' : `Block ${otherName}`}</Button>
        <button type="button" className="fm-cancel" onClick={close}>Cancel</button>
      </BottomSheet>
      <ConfirmModal open={modal === 'decline'} title="Decline this enquiry?" confirmLabel="Decline enquiry" cancelLabel="Cancel" onCancel={close}
        body="The request will be marked Declined and no conversation will be opened. You do not have to give a reason."
        onConfirm={() => { const r = actions.transition(id, e.id, 'decline', reason); close(); setReason(''); if (r.ok) toast('Request declined'); else fail(r.message); }}>
        <TextArea label="Reason" optional value={reason} onChange={setReason} maxLength={240} style={{ minHeight: 80 }} />
      </ConfirmModal>
      <ConfirmModal open={modal === 'withdraw'} title="Withdraw this enquiry?" confirmLabel="Withdraw enquiry" cancelLabel="Keep pending" onCancel={close}
        body="The writer will see it as withdrawn. This can’t be reopened in this prototype, but you can send a new enquiry if the story is still open."
        onConfirm={() => { const r = actions.transition(id, e.id, 'withdraw'); close(); if (r.ok) toast('Enquiry withdrawn'); else fail(r.message); }} />
      <ConfirmModal open={modal === 'block'} title={`Block ${otherName}?`} confirmLabel="Block" onCancel={close}
        body="This prevents further contact in this prototype: no new enquiries and no new messages between you, for both accounts. Existing history stays visible, and the enquiry status won’t change. You can unblock in Profile → Privacy."
        onConfirm={() => { const r = actions.block(id, other); close(); if (r.ok) toast(`${otherName} blocked`); }} />
    </Page>
  );
}

export function Conversation() {
  const { id: eid = '' } = useParams();
  const { db, id } = useMe();
  const navigate = useNavigate();
  const e = db.enquiries.find((x) => x.id === eid);
  const story = useStory(e?.storyId ?? '');
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
      <Page title="Conversation" centerTitle fallback={`/enquiries/${eid}`}>
        <EmptyState icon={MessageCircle} title="Conversation not available" text={e.status === 'pending' ? 'Chat opens only after the writer accepts this enquiry.' : `This enquiry was ${e.status}, so there is no conversation. The request remains as history.`} action={<LinkButton to={`/enquiries/${eid}`}>View enquiry</LinkButton>} />
      </Page>
    );
  const writerName = accountName(db, e.writerId);
  return (
    <Page title={otherName} centerTitle fallback={`/enquiries/${eid}`}
      right={<IconButton icon={MoreHorizontal} label="More options" onClick={() => navigate(`/enquiries/${eid}?options=1`)} />}
      footer={can.ok ? (
        <form className="fm-composer" onSubmit={(ev) => { ev.preventDefault(); if (text.trim()) send(); }}>
          <label className="sr-only" htmlFor="msg">Message</label>
          <textarea id="msg" rows={1} placeholder={`Message ${first(otherName)}…`} value={text} onChange={(ev) => actions.setComposer(key, ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); if (text.trim()) send(); } }} />
          <IconButton className="send-btn" type="submit" icon={Send} label="Send message" disabled={!text.trim()} />
        </form>
      ) : (
        <Notice icon={Lock} tone="err">{can.message} Messaging is disabled for both accounts.</Notice>
      )}>
      <div className="stack">
        <StatusPill status={e.status} />
        {story && <StoryStrip story={story} writer={writerName} to={`/enquiries/${eid}`} />}
        <p className="fm-help" style={{ marginTop: 0 }}>Acceptance opens this conversation. Agree adaptation permission and terms separately. Adaptation rights have not been granted.</p>
        {msgs.length === 0 && <p className="fm-sub" style={{ textAlign: 'center' }}>No messages yet. Say hello to get started.</p>}
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
