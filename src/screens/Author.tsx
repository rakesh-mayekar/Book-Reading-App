import { useParams } from 'react-router-dom';
import { Film, Info } from 'lucide-react';
import { Page } from '../components/Shell';
import { Avatar, Badge, EmptyState, LinkButton, Notice } from '../components/ui';
import { enquiryGate, publishedStories } from '../domain/rules';
import { NotFoundState, StoryCard, useMe } from './common';
import { BookOpen } from 'lucide-react';

export function Author() {
  const { id: wid = '' } = useParams();
  const { db, id, role } = useMe();
  const w = db.writers[wid];
  if (!w) return <NotFoundState what="writer" to="/discover" />;
  const stories = publishedStories(db).filter((s) => s.writerId === wid);
  const open = stories.filter((s) => s.adaptationOpen);
  return (
    <Page title="Writer">
      <div className="stack">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={w.name} photo={w.photo} size={72} />
          <div>
            <h1 className="t-title" style={{ fontSize: 24 }}>{w.name}</h1>
            <p className="t-meta">{stories.length} published {stories.length === 1 ? 'story' : 'stories'}</p>
            {w.sample && <Badge>Sample profile</Badge>}
          </div>
        </div>
        <p className="t-body">{w.bio}</p>
        {wid === id && <LinkButton variant="secondary" to="/profile/writer">Edit my profile</LinkButton>}
        <Notice icon={Info}>Writers’ personal email and phone numbers are never shown. Adaptation enquiries happen inside the app.</Notice>
        {role === 'filmmaker' && open.length > 0 && (
          <section className="stack-sm" aria-labelledby="ad-h">
            <h2 className="t-h2" id="ad-h">Open to adaptation enquiries</h2>
            {open.map((s) => {
              const g = enquiryGate(db, id, s.id);
              return (
                <div className="card stack-sm" key={s.id}>
                  <span className="t-h3">{s.title}</span>
                  {g.ok ? <LinkButton icon={Film} to={`/story/${s.id}/enquire`}>Discuss adaptation</LinkButton>
                    : g.reason === 'duplicate' ? <LinkButton variant="secondary" to={`/enquiries/${g.existingId}`}>View your enquiry</LinkButton>
                    : <p className="t-help">Contact is unavailable for this story.</p>}
                </div>
              );
            })}
          </section>
        )}
        <section aria-labelledby="st-h">
          <h2 className="t-h2" id="st-h" style={{ marginBottom: 12 }}>Published stories</h2>
          {stories.length ? <div className="stack-sm">{stories.map((s) => <StoryCard key={s.id} story={s} />)}</div> : <EmptyState icon={BookOpen} title="No published stories" text="This writer hasn’t published anything yet." />}
        </section>
      </div>
    </Page>
  );
}
