import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronRight, Clock, Film, Globe, Info, Lock, Pencil } from 'lucide-react';
import { Page, useBack } from '../components/Shell';
import { Badge, Button, Cover, Ico, IconButton, LinkButton, Notice } from '../components/ui';
import { enquiryGate, publicStory, readingMinutes } from '../domain/rules';
import { actions } from '../store/store';
import { NotFoundState, useMe } from './common';

export function StoryDetails() {
  const { id: storyId } = useParams();
  const { db, id, role } = useMe();
  const back = useBack('/discover');
  const raw = db.stories.find((s) => s.id === storyId);
  const story = raw && publicStory(raw);
  if (!raw || !story) return <NotFoundState what="story" to="/discover" />;
  const writer = db.writers[story.writerId];
  const saved = db.saved.some((s) => s.accountId === id && s.storyId === story.id);
  const prog = db.progress.find((p) => p.accountId === id && p.storyId === story.id);
  const inProgress = prog && !prog.completed;
  const gate = role === 'filmmaker' ? enquiryGate(db, id, story.id) : null;
  const readTo = `/read/${story.id}/${inProgress ? Math.min(prog.chapterIndex, story.chapters.length - 1) + 1 : 1}`;

  const header = (
    <header className="page-header overlay">
      <IconButton tone="dark" icon={ArrowLeft} label="Back" onClick={back} />
      <div style={{ flex: 1 }} />
      <IconButton tone="dark" icon={saved ? BookmarkCheck : Bookmark} pressed={saved} label={saved ? 'Remove from saved' : 'Save story'} onClick={() => actions.toggleSaved(id, story.id)} />
    </header>
  );

  return (
    <Page
      flush
      header={header}
      footer={<LinkButton to={readTo}>{prog?.completed ? 'Read again' : inProgress ? `Continue reading · Chapter ${prog.chapterIndex + 1}` : 'Start reading'}</LinkButton>}
    >
      <div className="details-hero">
        <Cover coverId={story.coverId} style={{ width: '100%', height: '100%' }} />
        <div className="overlay-text">
          <div className="row wrap"><span className="badge">{story.genre}</span><span className="badge">{story.language}</span><span className="badge">{story.status === 'completed' ? 'Completed' : 'Ongoing'}</span></div>
          <h1>{story.title}</h1>
          <Link to={`/author/${story.writerId}`} className="row" style={{ fontWeight: 600, minHeight: 44 }}>By {writer?.name ?? 'Unknown'} <Ico i={ChevronRight} size={18} /></Link>
        </div>
      </div>
      <div className="stack" style={{ padding: '20px 16px 8px' }}>
        <p className="t-body">{story.synopsis}</p>
        <div className="meta-grid">
          <div className="meta-box"><span className="t-meta"><Ico i={Clock} size={14} /> Time</span><b>{readingMinutes(story.chapters)} min</b></div>
          <div className="meta-box"><span className="t-meta">Chapters</span><b>{story.chapters.length}</b></div>
          <div className="meta-box"><span className="t-meta"><Ico i={Globe} size={14} /> Price</span><b>Free</b></div>
        </div>

        <section className="card stack-sm" aria-labelledby="adapt-h">
          <div className="row between">
            <h2 className="t-h3" id="adapt-h"><Ico i={Film} size={18} /> Adaptation</h2>
            {story.adaptationOpen ? <Badge tone="open">Open to enquiries</Badge> : <Badge>Not open right now</Badge>}
          </div>
          <p className="t-help">Declared by the writer. This is not proof of rights ownership.</p>
          {role === 'filmmaker' && gate && (
            gate.ok ? (
              <LinkButton to={`/story/${story.id}/enquire`} icon={Film}>Discuss adaptation</LinkButton>
            ) : gate.reason === 'duplicate' ? (
              <LinkButton to={`/enquiries/${gate.existingId}`} variant="secondary">View your enquiry</LinkButton>
            ) : gate.reason === 'blocked' ? (
              <Notice icon={Lock} tone="err">Contact with this writer is unavailable in this prototype.</Notice>
            ) : (
              <Notice icon={Info}>The writer is not taking adaptation enquiries for this story right now. You can still read it for free.</Notice>
            )
          )}
          {role !== 'filmmaker' && <p className="t-help">Only filmmaker accounts can send adaptation enquiries.</p>}
        </section>

        <section aria-labelledby="chap-h">
          <h2 className="t-h2" id="chap-h" style={{ marginBottom: 12 }}>Chapters</h2>
          <div className="stack-sm">
            {story.chapters.map((c, i) => (
              <Link key={c.id} className="list-row" to={`/read/${story.id}/${i + 1}`}>
                <span className="num">{i + 1}</span>
                <span className="grow t-h3">{c.title}</span>
                <Ico i={ChevronRight} size={20} />
              </Link>
            ))}
          </div>
        </section>
        {story.writerId === id && <LinkButton variant="secondary" icon={Pencil} to={`/writer/story/${story.id}/chapters`}>Manage this story</LinkButton>}
        <Button variant="secondary" onClick={() => actions.toggleSaved(id, story.id)}>{saved ? 'Remove from saved' : 'Save for later'}</Button>
      </div>
    </Page>
  );
}
